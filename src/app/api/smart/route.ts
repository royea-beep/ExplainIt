import { NextRequest, NextResponse } from 'next/server';
import { SmartEngine } from '@/lib/smart-engine';
import { sanitizeForLlm } from '@royea/prompt-guard';
import { getUserIdFromRequest } from '@/lib/auth';
import { getUserPlan, canUseSmartMode, canUseSmartModeFree } from '@/lib/plan-guard';

export async function POST(request: NextRequest) {
  try {
    // Plan gating: Smart Mode requires PRO+ or free trial
    const userId = await getUserIdFromRequest(request);
    const plan = await getUserPlan(userId);
    if (!canUseSmartMode(plan)) {
      // Check free trial for authenticated FREE users
      if (userId) {
        const trial = await canUseSmartModeFree(userId);
        if (!trial.allowed) {
          return NextResponse.json(
            {
              error: `You've used your free Smart Mode trial (${trial.used}/${trial.limit}). Upgrade to PRO for unlimited access.`,
              upgradeRequired: true,
              currentPlan: plan,
              trialUsed: trial.used,
              trialLimit: trial.limit,
            },
            { status: 403 }
          );
        }
        // Free trial allowed — continue
      } else {
        // Not authenticated
        return NextResponse.json(
          {
            error: 'Sign in to try Smart Mode for free, or upgrade to PRO.',
            upgradeRequired: true,
            authRequired: true,
            currentPlan: plan,
          },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const engine = new SmartEngine();

    // Sanitize user free-text input: mask PII, block injection phrases
    const sanitizedRequest = sanitizeForLlm(body.request || '', { maskPii: false });

    const project = engine.analyze({
      request: sanitizedRequest,
      answers: body.answers || {},
      language: body.language || 'he',
    });

    // If ready, generate mockup HTML files for each step
    if (project.ready) {
      for (const step of project.steps) {
        await engine.generateStepMockupImage(step, 'exports/mockups');
      }
    }

    return NextResponse.json(project);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
