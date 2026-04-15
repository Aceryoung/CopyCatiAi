import { createClient } from '@supabase/supabase-js';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const contentSchema = z.object({
  instagram: z.object({
    info: z.string().describe('카드뉴스용 정보성 문구 (혜택 중심)'),
    emotional: z.string().describe('스토리텔링 감성형 문구 (라이프스타일 중심)'),
    sale: z.string().describe('구매 유도 중심의 직설적 판매형 문구 (CTA 포함)'),
    hashtags: z.array(z.string()).describe('관련 해시태그 15개'),
  }),
  blog: z.object({
    title_suggestions: z.array(z.string()).describe('클릭을 유도하는 블로그 제목 3개'),
    body_markdown: z.string().describe('SEO에 최적화된 1000자 내외의 네이버 블로그 포스팅 초안'),
  }),
});

// ── [이슈 3] Jina 마크다운 네비게이션 스킵 파서 ──
// Jina가 반환하는 마크다운에서 불필요한 네비게이션(메뉴, 헤더) 부분을 건너뛰고
// 본문 위주의 3500자를 추출합니다.
function extractBodyText(markdown: string, maxLen = 3500): string {
  // 1) 줄 단위로 분리
  const lines = markdown.split('\n');

  // 2) 네비게이션성 라인 패턴: 링크만 있거나 1~3 단어 짧은 메뉴 항목
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
      // 네비게이션 덩어리가 끝난 지점을 본문 시작으로
      bodyStart = i;
      break;
    } else {
      // 네비게이션이 아닌 첫 줄부터 본문으로 간주
      bodyStart = i;
      break;
    }
  }

  const bodyText = lines.slice(bodyStart).join('\n');
  // 3) 여전히 앞부분 네비 잔재 제거: 마크다운 이미지·링크 라인 건너뜀
  const cleaned = bodyText
    .replace(/!\[.*?\]\(.*?\)/g, '')         // 마크다운 이미지 제거
    .replace(/\[.*?\]\(.*?\)/g, '')          // 마크다운 링크 텍스트만 남기지 않음
    .replace(/\n{3,}/g, '\n\n')             // 과도한 빈줄 압축
    .trim();

  return cleaned.slice(0, maxLen);
}

export async function POST(req: NextRequest) {
  // ── 이슈 1·2를 위해 크레딧 선차감 여부 추적 ──
  let creditDeducted = false;
  let supabase: ReturnType<typeof createClient> | null = null;
  let userId: string | null = null;

  try {
    // ── 1. Auth ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    const accessToken = authHeader.slice(7);

    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    userId = user.id;

    // ── 2. Parse body ──
    const body = await req.json();
    const sourceUrl: string = body?.source_url ?? '';
    const scrapedText: string | undefined = body?.scraped_text;
    const manualText: string | undefined = body?.manual_text;

    // ==========================================
    // 방어 1단계: 원자적 크레딧 선차감
    // ==========================================
    // FOR UPDATE Row-Lock → 동시 요청이 와도 마이너스/2중 차감 절대 불가
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: isDeducted, error: deductError } = await (supabase as any).rpc(
      'deduct_credit_atomic',
      { p_user_id: userId }
    );

    // 차감 실패(잔액 부족 또는 DB 에러) → 즉시 튕겨냄
    if (deductError || !isDeducted) {
      console.error('[generate] 크레딧 차감 실패:', deductError ?? '잔액 부족');
      return NextResponse.json(
        { error: 'INSUFFICIENT_CREDITS: 크레딧이 부족하거나 차감에 실패했습니다.' },
        { status: 402 }
      );
    }

    // 선차감 성공 → 이젠 에러 시 반드시 환불
    creditDeducted = true;

    // ── 4. URL 크롤링 또는 수동 텍스트 ──
    let contentText = scrapedText || manualText || '';

    // ==========================================
    // 방어 2단계: 크롤링 및 AI 생성 (Try-Catch)
    // ==========================================
    // scraped_text가 없고 source_url이 있으면 직접 크롤링
    if (!contentText && sourceUrl) {
      try {
        const scrapeRes = await fetch(`https://r.jina.ai/${sourceUrl}`);

        // Jina 429: 트래픽 초과 → 명시적 에러로 throw
        if (scrapeRes.status === 429) {
          throw new Error('JINA_429');
        }

        // 그 외 HTTP 에러
        if (!scrapeRes.ok) {
          console.log('[generate] Jina HTTP error:', scrapeRes.status);
          throw new Error(`JINA_HTTP_${scrapeRes.status}`);
        }

        const scrapeData = await scrapeRes.text();
        console.log('[generate] 크롤링 결과 길이:', scrapeData.length, 'chars');

        // 🚨 [문지기 로직] 에러 페이지 / 봇 차단 필터링
        const errorKeywords = [
          '오류 페이지', '비정상적인 접근', '접근 제한', '찾을 수 없는',
          '페이지를 찾을 수 없', '404', 'Not Found',
          'Access Denied', 'Forbidden', 'Bot detected', '캡차',
          '로봇이 아닙니다', '자동화된 요청',
        ];

        // 맨 앞 1000자 안에서만 에러 단어 탐지
        const textHead = scrapeData.substring(0, 1000).toLowerCase();
        const isErrorPage = errorKeywords.some(keyword =>
          textHead.includes(keyword.toLowerCase())
        );

        // 에러 키워드가 있고 글자수도 2000자 미만일 때만 차단
        if ((isErrorPage && scrapeData.length < 2000) || scrapeData.trim().length < 100) {
          console.log('[generate] 문지기 차단 — 에러페이지:', isErrorPage, '길이:', scrapeData.length);
          throw new Error('CRAWL_BLOCKED');
        }

        contentText = scrapeData;
      } catch (crawlErr: unknown) {
        // ==========================================
        // 방어 3단계: 크롤링 실패 → 크레딧 환불
        // ==========================================
        const msg = crawlErr instanceof Error ? crawlErr.message : '';
        console.error('[generate] 크롤링 실패, 크레딧 환불:', msg);

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).rpc('refund_credit', { p_user_id: userId });
        } catch (refundErr) {
          console.error('[generate] 크레딧 환불 실패:', refundErr);
        }

        if (msg === 'JINA_429') {
          return NextResponse.json(
            { error: 'CRAWL_FAILED: 현재 접속자가 많아 크롤링이 지연되고 있습니다. [텍스트 직접 입력]을 이용해 주세요!' },
            { status: 429 }
          );
        }
        if (msg === 'CRAWL_BLOCKED') {
          return NextResponse.json(
            { error: 'CRAWL_FAILED: 보안이 강력한 사이트입니다. 텍스트 직접 입력을 권장합니다.' },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { error: 'CRAWL_FAILED: URL 접속에 실패했습니다. 상품 설명을 직접 복사해서 붙여넣어 주세요!' },
          { status: 400 }
        );
      }
    }

    // ── 5. [이슈 3] Jina 마크다운 본문 추출 (네비게이션 스킵) ──
    const cleanText = extractBodyText(contentText, 3500);
    console.log('[generate] cleanText 길이:', cleanText.length, 'chars (after body extraction)');

    // ── 6. AI 생성 (non-streaming: 안정적 에러 처리) ──
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: contentSchema,
      system: `너는 10년 차 베테랑 이커머스 마케팅 전문가이자 카피라이터야.
[절대 규칙]
제공된 텍스트 중 배송 안내, 교환/환불 규정, 고객센터 정보, 단순 구매 리뷰는 완전히 무시해.
오직 상품의 매력, 스펙, 기능 등 마케팅 소구점(USP)에만 집중해서 카피를 작성해.
모든 콘텐츠는 한국어로 작성해.`,
      prompt: `아래 상품 정보를 바탕으로 마케팅 콘텐츠를 생성해줘:\n\n${cleanText}`,
    });

    // ── 7. DB 저장 ──
    try {
      // 💡 DB로 보내기 직전 변수 확인
      console.log('DB로 보낼 userId 확인:', userId);
      console.log('DB로 보낼 object 데이터 확인:', JSON.stringify(object).slice(0, 50) + '...');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: dbError } = await (supabase as any).rpc('save_generation_and_deduct', {
        p_user_id: userId,
        p_source_url: sourceUrl || '수동입력',
        p_content_json: object,
      });

      if (dbError) {
        console.error('[generate] DB 에러:', dbError);
      } else {
        console.log('[generate] DB save success! 반환된 데이터:', data);
      }
    } catch (dbErr) {
      console.error('[generate] DB save failed (non-fatal):', dbErr);
    }

    // ── 8. JSON 응답 ──
    return NextResponse.json({ result: object }, { status: 200 });
  } catch (err) {
    console.error('[generate] Error:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);

    // [이슈 2] OpenAI 에러 등 예외 발생 시 → 크레딧 환불
    if (creditDeducted && supabase && userId) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).rpc('refund_credit', { p_user_id: userId });
        console.log('[generate] 크레딧 환불 완료 (에러 발생으로 인한 롤백)');
      } catch (refundErr) {
        console.error('[generate] 크레딧 환불 실패:', refundErr);
      }
    }

    // 네트워크/DNS 에러 감지 (일시적 문제)
    if (
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('ECONNRESET') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('Cannot connect to API') ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('aborted')
    ) {
      return NextResponse.json(
        { error: 'NETWORK_ERROR: 네트워크 연결이 불안정합니다. Wi-Fi 또는 데이터 연결을 확인 후 다시 시도해 주세요.' },
        { status: 503 }
      );
    }

    // OpenAI quota 에러 감지
    if (errorMessage.includes('insufficient_quota') || errorMessage.includes('exceeded your current quota')) {
      return NextResponse.json(
        { error: 'OPENAI_QUOTA_EXCEEDED: OpenAI API 크레딧이 부족합니다. API 키의 결제 설정을 확인해 주세요.' },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: `INTERNAL_ERROR: ${errorMessage}` },
      { status: 500 }
    );
  }
}
