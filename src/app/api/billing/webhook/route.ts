import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@/lib/db';

const WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

/** Verify LemonSqueezy webhook: HMAC-SHA256 of raw body vs X-Signature header. */
function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET || !signature) return false;
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(rawBody);
  const digest = hmac.digest('hex');
  try {
    const a = Buffer.from(digest, 'hex');
    const b = Buffer.from(signature.trim(), 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

interface WebhookPayload {
  meta?: {
    event_name?: string;
    custom_data?: { user_id?: string; plan?: string };
  };
  data?: {
    id?: string;
    attributes?: {
      status?: string;
      ends_at?: string | null;
      renews_at?: string | null;
      first_order_item?: { variant_id?: number } | null;
      customer_id?: number;
    };
  };
}

/** Resolve the user for this webhook: try custom_data.user_id first, then lemonCustomerId lookup. */
async function resolveUserId(
  customUserId: string | undefined,
  customerId: string | null,
): Promise<string | null> {
  if (customUserId) {
    const user = await prisma.user.findUnique({ where: { id: customUserId }, select: { id: true } });
    if (user) return user.id;
  }
  if (customerId) {
    const user = await prisma.user.findUnique({ where: { lemonCustomerId: customerId }, select: { id: true } });
    if (user) return user.id;
  }
  return null;
}

function determinePlan(customPlan: string | undefined, variantId: number | undefined): 'PRO' | 'TEAM' {
  const upper = customPlan?.toUpperCase();
  if (upper === 'TEAM' || upper === 'PRO') return upper as 'PRO' | 'TEAM';
  const variantTeam = Number(process.env.LEMONSQUEEZY_TEAM_VARIANT_ID);
  return !Number.isNaN(variantTeam) && variantId === variantTeam ? 'TEAM' : 'PRO';
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-signature') ?? null;
  const rawBody = await request.text();

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventName = payload.meta?.event_name;
  const data = payload.data;
  if (!eventName || !data) {
    return NextResponse.json({ ok: true });
  }

  const attrs = data.attributes ?? {};
  const customerId = attrs.customer_id != null ? String(attrs.customer_id) : null;
  const userId = await resolveUserId(payload.meta?.custom_data?.user_id, customerId);

  if (!userId) {
    console.error(`[billing/webhook] Could not resolve user for event=${eventName} customerId=${customerId}`);
    return NextResponse.json({ ok: true }); // ACK so LemonSqueezy doesn't retry
  }

  const subId = data.id ? String(data.id) : null;
  const status = attrs.status ?? 'inactive';
  const endsAt = attrs.ends_at ? new Date(attrs.ends_at) : null;
  const renewsAt = attrs.renews_at ? new Date(attrs.renews_at) : null;
  const variantId = attrs.first_order_item?.variant_id;
  const plan = determinePlan(payload.meta?.custom_data?.plan, variantId);

  console.log(`[billing/webhook] event=${eventName} userId=${userId} plan=${plan} status=${status}`);

  try {
    if (
      eventName === 'subscription_created' ||
      eventName === 'subscription_updated' ||
      eventName === 'subscription_resumed'
    ) {
      // Activate or update subscription
      await prisma.user.update({
        where: { id: userId },
        data: {
          plan,
          lemonSubscriptionId: subId,
          lemonCustomerId: customerId ?? undefined,
          subscriptionStatus: status === 'active' ? 'active' : status,
          currentPeriodEnd: renewsAt ?? endsAt,
        },
      });
    } else if (eventName === 'subscription_cancelled') {
      // Cancelled but still active until period end — keep plan until ends_at
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionStatus: 'cancelled',
          currentPeriodEnd: endsAt,
          // Plan stays active until expiry — downgrade happens on subscription_expired
        },
      });
    } else if (eventName === 'subscription_expired') {
      // Period ended — downgrade to FREE
      await prisma.user.update({
        where: { id: userId },
        data: {
          plan: 'FREE',
          subscriptionStatus: 'inactive',
          lemonSubscriptionId: null,
          currentPeriodEnd: null,
        },
      });
    } else if (
      eventName === 'subscription_renewed' ||
      eventName === 'subscription_payment_success'
    ) {
      // Successful renewal — reset monthly pipeline counter
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionStatus: 'active',
          pipelinesThisMonth: 0,
          billingCycleStart: new Date(),
          currentPeriodEnd: renewsAt ?? endsAt ?? undefined,
        },
      });
    } else if (eventName === 'subscription_payment_failed') {
      // Payment failed — mark as past_due but don't downgrade yet
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionStatus: 'past_due',
        },
      });
    }
  } catch (err) {
    console.error(`[billing/webhook] DB update failed for event=${eventName} userId=${userId}:`, err);
    // Still ACK — we don't want LemonSqueezy retrying a DB error forever
  }

  return NextResponse.json({ ok: true });
}
