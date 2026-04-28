/**
 * Finalize Endpoint
 *
 * POST /api/voice/calls/[callId]/finalize
 *   Called by the Python voice agent after every call.
 *   Saves transcript and runs Claude Haiku analysis synchronously.
 *   Authenticated by internal VOICE_AGENT_API_KEY header.
 *
 * GET /api/voice/calls/[callId]/finalize
 *   Returns transcript + analysis for the call log UI.
 *   Authenticated by user session (same pattern as other voice routes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Valid outcome values from the Prisma schema
type CallOutcome =
  | 'qualified'
  | 'appointment_booked'
  | 'callback_requested'
  | 'not_interested'
  | 'no_answer'
  | 'unknown';

interface TranscriptMessage {
  role: string;
  text: string;
  timestamp: number;
}

interface FinalizeBody {
  transcript: TranscriptMessage[];
  fullText?: string;
}

interface AnalysisResult {
  outcome: CallOutcome;
  summary: string;
  follow_up_required: boolean;
}

function buildFullText(transcript: TranscriptMessage[]): string {
  return transcript.map((m) => `${m.role}: ${m.text}`).join('\n');
}

export async function POST(
  req: NextRequest,
  { params }: { params: { callId: string } }
) {
  // 1. Authenticate — internal API key from voice agent
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.VOICE_AGENT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { callId } = params;

  // 2. Parse body
  let body: FinalizeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.transcript || !Array.isArray(body.transcript)) {
    return NextResponse.json(
      { error: 'transcript array required' },
      { status: 400 }
    );
  }

  // 3. Verify call exists
  const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
  if (!call) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 });
  }

  const fullText = body.fullText ?? buildFullText(body.transcript);

  // 4. Upsert transcript — idempotent so retries are safe
  await prisma.voiceTranscript.upsert({
    where: { callId },
    create: {
      callId,
      content: body.transcript as unknown as import('@prisma/client').Prisma.InputJsonValue,
      fullText,
    },
    update: {
      content: body.transcript as unknown as import('@prisma/client').Prisma.InputJsonValue,
      fullText,
    },
  });

  // 5. Claude Haiku analysis
  let outcome: CallOutcome = 'unknown';
  let summary = '';
  let followUpRequired = false;

  if (fullText.trim().length > 0) {
    try {
      const analysis = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: `Analyze this sales call transcript and return ONLY valid JSON with no other text:
{
  "outcome": "qualified" | "appointment_booked" | "callback_requested" | "not_interested" | "no_answer",
  "summary": "2-3 sentence summary of the call",
  "follow_up_required": true | false
}

Transcript:
${fullText.slice(0, 8000)}`,
          },
        ],
      });

      const rawText =
        analysis.content[0].type === 'text'
          ? analysis.content[0].text.trim()
          : '{}';

      // Strip markdown code fences if the model wraps the JSON
      const jsonStr = rawText
        .replace(/^```json?\n?/, '')
        .replace(/\n?```$/, '');

      const parsed: Partial<AnalysisResult> = JSON.parse(jsonStr);
      outcome = (parsed.outcome as CallOutcome) ?? 'unknown';
      summary = parsed.summary ?? '';
      followUpRequired = Boolean(parsed.follow_up_required);
    } catch (err) {
      // Analysis failure is non-fatal — transcript is already saved
      console.error('[finalize] Claude analysis failed for call', callId, err);
    }
  }

  // 6. Update VoiceCall with outcome, summary, and status
  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      outcome,
      summary,
      ...(call.status === 'in_progress'
        ? { status: 'completed', endedAt: new Date() }
        : {}),
    },
  });

  // 7. Create follow-up task if needed and contactId is available
  if (followUpRequired && call.contactId) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    await prisma.task.create({
      data: {
        contactId: call.contactId,
        tenantId: call.tenantId,
        type: 'followup',
        notes: `Follow up from voice call: ${summary}`,
        dueAt: tomorrow,
        source: 'voice_agent',
        callId,
      },
    });
  }

  return NextResponse.json({ success: true, outcome, summary, followUpRequired });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { callId: string } }
) {
  // Auth — same pattern as other voice routes
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tenantId } = session.user;
  if (!tenantId) {
    return NextResponse.json(
      { error: 'No tenant associated with this account' },
      { status: 403 }
    );
  }

  const { callId } = params;

  const [call, transcript] = await Promise.all([
    prisma.voiceCall.findUnique({
      where: { id: callId },
      select: { outcome: true, summary: true, tenantId: true },
    }),
    prisma.voiceTranscript.findUnique({
      where: { callId },
      select: { content: true, fullText: true },
    }),
  ]);

  if (!call) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Scope check — prevent cross-tenant access
  if (call.tenantId !== tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    outcome: call.outcome,
    summary: call.summary,
    transcript: transcript?.content ?? [],
    fullText: transcript?.fullText ?? '',
  });
}
