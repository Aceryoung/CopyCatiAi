import { createClient } from '@/lib/supabase/server';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel 504 방어

// 코드 레벨 강제 주입 — AI에 위임하지 않음
const DISCLAIMER =
  '❗[주의: 이 부분은 대표님의 실제 스토어 링크와 사용 후기로 한 줄만 수정해 주세요]\n\n';

// Jina 본문 추출 (generate/route.ts와 동일 유틸)
function extractBodyText(markdown: string, maxLen = 4000): string {
  const lines = markdown.split('\n');
  const navLinePattern = /^(\s*[-*]?\s*\[.+?\]\(.+?\)\s*)+$/;
  const shortMenuPattern = /^\s*[|\-*>]?\s*[\w가-힣]{1,8}\s*([|\-*>]\s*[\w가-힣]{1,8}\s*)*$/;
  let bodyStart = 0;
  let navLineCount = 0;
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (navLinePattern.test(line) || (shortMenuPattern.test(line) && line.length < 30)) {
      navLineCount++;
    } else if (navLineCount >= 5) {
      bodyStart = i;
      break;
    } else {
      bodyStart = i;
      break;
    }
  }
  const bodyText = lines.slice(bodyStart).join('\n');
  return bodyText
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLen);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  let userId: string | null = null;

  try {
    // ── 1. Auth ──
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    userId = user.id;

    // ── 2. Parse body ──
    const body = await req.json();
    const sourceUrl: string = body?.source_url ?? '';
    const manualText: string = body?.manual_text ?? '';
    const userReview: string = body?.userReview ?? '';

    // ── 3. 크레딧 확인 (선차감 없이 잔액만 확인) ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    if (!profile || profile.credits <= 0) {
      return Response.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 });
    }

    // ── 4. 콘텐츠 수집 (URL 크롤링 or 수동 텍스트) ──
    let contentText = manualText;
    if (!contentText && sourceUrl) {
      try {
        const headers: Record<string, string> = { Accept: 'text/markdown' };
        if (process.env.JINA_API_KEY) {
          headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;
        }
        const scrapeRes = await fetch(`https://r.jina.ai/${sourceUrl}`, { headers });
        if (!scrapeRes.ok) throw new Error(`JINA_HTTP_${scrapeRes.status}`);
        contentText = await scrapeRes.text();
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        return Response.json(
          { error: `CRAWL_FAILED: ${msg.includes('429') ? '접속 과다' : 'URL 크롤링 실패'} — 텍스트 직접 입력을 이용해 주세요.` },
          { status: 400 }
        );
      }
    }

    if (!contentText || contentText.trim().length < 30) {
      return Response.json({ error: 'CONTENT_TOO_SHORT: 내용이 너무 짧습니다.' }, { status: 400 });
    }

    const cleanText = extractBodyText(contentText, 4000);

    // ── 5. 시스템 프롬프트 구성 ──
    let systemPrompt = `당신은 10년 차 탑티어 마케터이자 전문 리뷰 블로거입니다.
제공된 상품 정보를 바탕으로 1,500자 이상의 완성도 높은 네이버 블로그 본문을 단 한 편 작성하세요.

[절대 규칙]
1. 100% 자연스러운 한국어로만 작성 (기계 번역 어투 절대 금지)
2. 도입부 → 본문(소제목 4개 이상, 특수기호 ✔️, 📌, • 등을 활용하여 리스트 작성) → 마무리(CTA 포함) 구조 필수
3. 중요 단어에 볼드(**강조**), 내용에 맞는 이모지 적절히 사용
4. SEO 최적화: 핵심 키워드를 제목과 본문에 자연스럽게 녹여내기
5. 배송 안내·교환환불 등 마케팅과 무관한 내용 제외
6. 저품질 방지: 독자가 직접 채워야 할 영역 2~3곳을 대괄호+이모지로 표시
   예) [ 📷 실제 사용 사진을 여기에 넣어주세요 ] / [ ✍️ 나만의 솔직한 한 줄 후기 ]
7. 마크다운(##, **) 사용 가능, 최종 출력은 본문 텍스트만 (JSON 형식 불필요)
8. [가독성 및 포맷팅 절대 규칙]
   - 모바일 환경을 최우선으로 고려해라. 절대 3문장 이상을 한 문단으로 묶지 마라.
   - 2문장이 끝날 때마다 반드시 줄바꿈(\n\n)을 넣어 모바일 화면의 여백을 확보해라.
   - 핵심 키워드나 결론은 문단 맨 앞(두괄식)에 배치해라.
   - 단락이 전환될 때는 마크다운 소제목(###)을 적극 활용하고, 그 위아래로 빈 줄을 넉넉히 추가해라.
   - 네이버 블로그 복사 시 숫자 정렬이 깨지는 것을 방지하기 위해, 문장 맨 앞에 마크다운 숫자 목록(1., 2., 3.)이나 기본 불릿(-, *) 사용을 엄격히 금지한다. 리스트가 필요할 경우 무조건 문장 맨 앞에 기호(✔️, 📌, ✨)를 텍스트로 직접 입력해라.`;

    // 유저 경험담 동적 주입 (비어있으면 스킵)
    if (userReview.trim().length > 0) {
      systemPrompt += `\n\n[유저 실제 경험담 — 본문 중간에 이웃과 소통하듯 자연스럽게 녹여라]\n${userReview}`;
    }

    // ── 6. 스트리밍 생성 (504 방어) ──
    const streamResult = streamText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      prompt: `다음 상품/서비스 정보를 바탕으로 완전한 네이버 블로그 본문을 작성해주세요:\n\n${cleanText}`,
      maxOutputTokens: 3000,
      onFinish: async ({ text }) => {
        // ── 7. 스트리밍 완료 후 DB 저장 + 크레딧 차감 (원자적) ──
        try {
          const fullContent = `${DISCLAIMER}${text}\n\n${DISCLAIMER}`;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).rpc('save_generation_and_deduct', {
            p_user_id: userId,
            p_source_url: sourceUrl || '수동입력',
            p_content_json: { full_blog: fullContent, mode: 'full' },
          });
          console.log('[generate-full] ✅ 저장+차감 완료');
        } catch (dbErr) {
          // DB 저장 실패는 non-fatal (스트리밍 결과는 이미 전달됨)
          console.error('[generate-full] DB save failed (non-fatal):', dbErr);
        }
      },
    });

    // 크레딧은 onFinish 성공 시만 차감 → 스트림 실패 시 자동 롤백 없음 (미차감 상태)
    return streamResult.toTextStreamResponse();

  } catch (err) {
    console.error('[generate-full] Error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `INTERNAL_ERROR: ${msg}` }, { status: 500 });
  }
}
