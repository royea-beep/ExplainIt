import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { createCheckoutUrl } from '@/lib/payments';

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const planRaw = (body.plan as string)?.toLowerCase();
    if (planRaw !== 'pro' && planRaw !== 'team') {
      return NextResponse.json({ error: 'Invalid plan. Use "pro" or "team".' }, { status: 400 });
    }
    const plan = planRaw === 'team' ? 'TEAM' : 'PRO';

    const baseUrl = request.nextUrl.origin;
    const url = await createCheckoutUrl(
      userId,
      plan,
      `${baseUrl}/?checkout=success`,
      `${baseUrl}/?checkout=cancelled`
    );
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
