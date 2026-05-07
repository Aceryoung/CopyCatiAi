import { createClient } from '@/lib/supabase/server';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/* ─────────────────────────────────────────
   분류 결과 스키마
   ───────────────────────────────────────── */
const classifySchema = z.object({
  headline: z
    .string()
    .describe(
      '원문에서 "후킹 헤드라인"에 해당하는 텍스트 전체. 독자의 시선을 즉시 사로잡는 제목/소제목/슬로건 등을 포함.'
    ),
  structure: z
    .string()
    .describe(
      '원문에서 "블로그 구조 설계"에 해당하는 텍스트 전체. 목차, 소제목, 단락 구조, 글의 흐름을 구성하는 요소들을 포함.'
    ),
  bodyText: z
    .string()
    .describe(
      '원문에서 "본문 내용"에 해당하는 텍스트 전체. 제품/서비스 설명, 혜택, 이유, 결론 등 실제 본문 내용을 포함.'
    ),
});

/* ─────────────────────────────────────────
   POST /api/classify
   ───────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ──
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // ── 2. Parse body ──
    const body = await req.json();
    const rawText: string | undefined = body?.raw_text;

    if (!rawText || rawText.trim().length < 20) {
      return NextResponse.json(
        { error: 'MISSING_TEXT: 분류할 텍스트를 20자 이상 입력해 주세요.' },
        { status: 400 }
      );
    }

    const trimmedText = rawText.trim().slice(0, 8000); // 최대 8000자

    // ── 3. AI 분류 ──
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: classifySchema,
      system: `당신은 블로그 콘텐츠 전략 전문가입니다.
사용자가 입력한 블로그 초안(원문 텍스트)을 분석하여, 반드시 아래 3가지 영역으로 분류해주세요.

[분류 기준]
1. headline (후킹 헤드라인): 독자의 시선을 즉시 끌 수 있는 제목, 소제목, 슬로건, 키 카피라이팅 문구. 클릭을 유도하거나 강력한 인상을 줄 수 있는 문구가 이에 해당합니다.
2. structure (블로그 구조 설계): 글의 전체적인 흐름과 뼈대. 목차, 단락 구조, 소제목 목록, 내용 전개 방식, 서론-본론-결론의 로드맵이 이에 해당합니다.
3. bodyText (본문 내용): 실제 본문 서술. 제품/서비스 설명, 혜택, 사용 후기, 이유, 데이터, 결론 등 독자에게 가치를 전달하는 핵심 내용이 이에 해당합니다.

[절대 규칙]
- 원문 텍스트를 임의로 재창작하거나 요약하지 마세요. 원문 그대로 분류하여 각 영역에 배치하세요.
- 원문에 해당 영역이 없거나 매우 적을 경우에는, 원문을 기반으로 해당 영역에 맞게 적절히 보완하여 작성하세요.
- 각 영역은 반드시 비어있지 않아야 합니다. 모든 필드에 내용을 채워야 합니다.
- 100% 자연스러운 한국어로만 응답하세요.`,
      prompt: `아래 블로그 초안 원문을 분석하여 3가지 영역으로 분류해주세요:\n\n${trimmedText}`,
    });

    return NextResponse.json({ result: object }, { status: 200 });
  } catch (err) {
    console.error('[classify] Error:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('ECONNRESET') ||
      errorMessage.includes('fetch failed')
    ) {
      return NextResponse.json(
        { error: 'NETWORK_ERROR: 네트워크 연결이 불안정합니다.' },
        { status: 503 }
      );
    }

    if (errorMessage.includes('insufficient_quota') || errorMessage.includes('exceeded your current quota')) {
      return NextResponse.json(
        { error: 'OPENAI_QUOTA_EXCEEDED: AI 서비스가 일시적으로 불가합니다.' },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: `INTERNAL_ERROR: ${errorMessage}` },
      { status: 500 }
    );
  }
}
