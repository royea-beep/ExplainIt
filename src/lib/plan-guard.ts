/**
 * Plan guard — check user plan and enforce feature gates.
 */

import { prisma } from '@/lib/db';
import type { PlanId } from '@/lib/payments';

/** Maximum free Smart Mode generations for FREE plan users. */
const FREE_SMART_MODE_LIMIT = 1;

export async function getUserPlan(userId: string | null): Promise<PlanId> {
  if (!userId) return 'FREE';
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  return (user?.plan as PlanId) ?? 'FREE';
}

/** Returns true if plan allows unlimited Smart Mode (PRO or TEAM). */
export function canUseSmartMode(plan: PlanId): boolean {
  return plan === 'PRO' || plan === 'TEAM';
}

/**
 * Count how many Smart Mode generations a user has done.
 * Uses Pipeline records with currentAgent='SmartEngine'.
 */
export async function getSmartModeUsageCount(userId: string): Promise<number> {
  return prisma.pipeline.count({
    where: {
      userId,
      currentAgent: 'SmartEngine',
      stage: 'done',
    },
  });
}

/**
 * Check if a FREE user can still use Smart Mode (within free trial limit).
 * Returns { allowed, used, limit }.
 */
export async function canUseSmartModeFree(userId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const used = await getSmartModeUsageCount(userId);
  return {
    allowed: used < FREE_SMART_MODE_LIMIT,
    used,
    limit: FREE_SMART_MODE_LIMIT,
  };
}

/** Returns true if output should be watermarked (FREE plan only). */
export function shouldWatermark(plan: PlanId): boolean {
  return plan === 'FREE';
}
