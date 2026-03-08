import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@/lib/db';

const WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

/** Verify LemonSqueezy webhook: HMAC-SHA256 of raw body, compare to X-Signature header. */
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

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-signature') ?? null;
  const rawBody = await request.text();
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let payload: {
    meta?: {
      event_name?: string;
      custom_data?: { user_id?: string; plan?: string };
    };
    data?: {
      id?: string;
      type?: string;
      attributes?: {
        status?: string;
        ends_at?: string | null;
        first_order_item?: { variant_id?: number } | null;
        customer_id?: number;
      };
    };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventName = payload.meta?.event_name;
  const customData = payload.meta?.custom_data;
  const userId = customData?.user_id;
  const customPlan = customData?.plan?.toUpperCase();
  const data = payload.data;

  if (!eventName || !data) {
    return NextResponse.json({ ok: true });
  }

  const subId = data.id ? String(data.id) : null;
  const attrs = data.attributes ?? {};
  const status = attrs.status ?? 'inactive';
  const endsAt = attrs.ends_at ? new Date(attrs.ends_at) : null;
  const variantId = attrs.first_order_item?.variant_id;
  const customerId = attrs.customer_id != null ? String(attrs.customer_id) : null;

  const variantTeam = Number(process.env.LEMONSQUEEZY_TEAM_VARIANT_ID);
  const planFromVariant =
    !Number.isNaN(variantTeam) && variantId === variantTeam ? 'TEAM' : 'PRO';
  const plan = (customPlan === 'TEAM' || customPlan === 'PRO' ? customPlan : planFromVariant) as 'PRO' | 'TEAM';

  if (
    eventName === 'subscription_created' ||
    eventName === 'subscription_updated' ||
    eventName === 'subscription_resumed'
  ) {
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          plan,
          lemonSubscriptionId: subId,
          lemonCustomerId: customerId ?? undefined,
          subscriptionStatus: status,
          currentPeriodEnd: endsAt,
        },
      });
    }
  } else if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          plan: 'FREE',
          subscriptionStatus: 'cancelled',
          lemonSubscriptionId: null,
          currentPeriodEnd: null,
        },
      });
    }
  } else if (eventName === 'subscription_renewed' || eventName === 'subscription_payment_success') {
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          pipelinesThisMonth: 0,
          billingCycleStart: new Date(),
          currentPeriodEnd: endsAt ?? undefined,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
