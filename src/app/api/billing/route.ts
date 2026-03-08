import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { getSubscription } from '@/lib/payments';

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sub = await getSubscription(userId);
  if (!sub) {
    return NextResponse.json({ plan: 'free' });
  }

  return NextResponse.json({
    plan: sub.plan.toLowerCase(),
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    subscriptionId: sub.subscriptionId,
  });
}
