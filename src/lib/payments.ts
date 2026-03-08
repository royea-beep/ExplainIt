/**
 * LemonSqueezy billing for ExplainIt.
 * Plans: FREE (3 pipelines/mo), PRO $19/mo (50 pipelines), TEAM $49/mo (unlimited).
 *
 * Setup: see LEMONSQUEEZY_SETUP.md. Create 2 products in LemonSqueezy (store 309460):
 * Pro $19/mo, Team $49/mo; set variant IDs in .env (LEMONSQUEEZY_PRO_VARIANT_ID, LEMONSQUEEZY_TEAM_VARIANT_ID).
 */

import { prisma } from '@/lib/db';

const LEMON_API = 'https://api.lemonsqueezy.com/v1';

export type PlanId = 'FREE' | 'PRO' | 'TEAM';

export const PLANS = {
  FREE: { pipelinesPerMonth: 3, price: 0 },
  PRO: { pipelinesPerMonth: 50, price: 19 },
  TEAM: { pipelinesPerMonth: -1, price: 49 }, // -1 = unlimited
} as const;

/** Placeholder variant IDs — set real IDs in .env after creating products in LemonSqueezy. */
export const PRO_VARIANT_ID = process.env.LEMONSQUEEZY_PRO_VARIANT_ID ?? 'placeholder_pro';
export const TEAM_VARIANT_ID = process.env.LEMONSQUEEZY_TEAM_VARIANT_ID ?? 'placeholder_team';

const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID ?? '309460';

function getApiKey(): string {
  const key = process.env.LEMONSQUEEZY_API_KEY;
  if (!key) throw new Error('LEMONSQUEEZY_API_KEY is not set');
  return key;
}

function getVariantId(plan: 'PRO' | 'TEAM'): number {
  const raw = plan === 'PRO' ? PRO_VARIANT_ID : TEAM_VARIANT_ID;
  const n = Number(raw);
  if (Number.isNaN(n) || raw === 'placeholder_pro' || raw === 'placeholder_team') {
    throw new Error(
      `Set LEMONSQUEEZY_${plan}_VARIANT_ID (and LEMONSQUEEZY_TEAM_VARIANT_ID) in .env with real LemonSqueezy variant IDs`
    );
  }
  return n;
}

/**
 * Create a LemonSqueezy checkout URL for PRO or TEAM.
 * FREE does not require checkout.
 */
export async function createCheckoutUrl(
  userId: string,
  plan: 'PRO' | 'TEAM',
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  void cancelUrl; // LemonSqueezy uses redirect_url for success; cancel uses default
  const variantId = getVariantId(plan);
  const apiKey = getApiKey();

  const body = {
    data: {
      type: 'checkouts',
      attributes: {
        store_id: Number(STORE_ID),
        variant_id: variantId,
        product_options: {
          redirect_url: successUrl,
        },
        checkout_options: {
          button_color: undefined,
          embed: false,
          media: false,
          desc: false,
          discount: true,
          dark: false,
        },
        checkout_data: {
          custom: {
            user_id: userId,
            plan,
          },
        },
      },
    },
  };

  const res = await fetch(`${LEMON_API}/checkouts`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LemonSqueezy checkout failed: ${res.status} ${err}`);
  }

  const json = (await res.json()) as { data?: { attributes?: { url?: string } } };
  const url = json.data?.attributes?.url;
  if (!url) throw new Error('No checkout URL in response');
  return url;
}

export interface SubscriptionInfo {
  plan: PlanId;
  status: string;
  currentPeriodEnd: Date | null;
  subscriptionId: string | null;
}

/**
 * Get subscription for a user by userId (reads from DB).
 */
export async function getSubscription(userId: string): Promise<SubscriptionInfo | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      lemonSubscriptionId: true,
    },
  });
  if (!user) return null;
  return {
    plan: user.plan as PlanId,
    status: user.subscriptionStatus,
    currentPeriodEnd: user.currentPeriodEnd,
    subscriptionId: user.lemonSubscriptionId,
  };
}

/**
 * Cancel subscription for a user (cancels at period end via LemonSqueezy).
 */
export async function cancelSubscription(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lemonSubscriptionId: true },
  });
  if (!user?.lemonSubscriptionId) {
    throw new Error('No active subscription to cancel');
  }
  const apiKey = getApiKey();
  const res = await fetch(`${LEMON_API}/subscriptions/${user.lemonSubscriptionId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/vnd.api+json',
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LemonSqueezy cancel failed: ${res.status} ${err}`);
  }
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
