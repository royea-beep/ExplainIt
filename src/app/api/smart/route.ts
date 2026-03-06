import { NextRequest, NextResponse } from 'next/server';
import { SmartEngine } from '@/lib/smart-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const engine = new SmartEngine();

    const project = engine.analyze({
      request: body.request || '',
      answers: body.answers || {},
      language: body.language || 'he',
    });

    // If ready, generate mockup HTML files for each step
    if (project.ready) {
      for (const step of project.steps) {
        engine.generateStepMockupImage(step, 'exports/mockups');
      }
    }

    return NextResponse.json(project);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
