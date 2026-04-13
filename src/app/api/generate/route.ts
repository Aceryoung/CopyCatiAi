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

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    const accessToken = authHeader.slice(7);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userId = user.id;

    // ── 2. Parse body ──
    const body = await req.json();
    const sourceUrl: string = body?.source_url ?? '';
    const scrapedText: string | undefined = body?.scraped_text;
    const manualText: string | undefined = body?.manual_text;

    // ── 5. URL 크롤링 또는 수동 텍스트 ──
    let contentText = scrapedText || manualText || '';

    // scraped_text가 없고 source_url이 있으면 직접 크롤링
    if (!contentText && sourceUrl) {
      try {
        const scrapeRes = await fetch(`https://r.jina.ai/${sourceUrl}`);

        // HTTP 에러면 즉시 차단
        if (!scrapeRes.ok) {
          console.log('[generate] Jina HTTP error:', scrapeRes.status);
          return NextResponse.json(
            { error: "CRAWL_FAILED: URL을 읽어올 수 없습니다. 상품 설명을 직접 복사해서 붙여넣어 주세요!" },
            { status: 400 }
          );
        }

        const scrapeData = await scrapeRes.text();
        console.log("[generate] 크롤링 결과 길이:", scrapeData.length, "chars");

        // 🚨 [문지기 로직] 에러 페이지 / 봇 차단 / 빈 페이지 필터링
        const errorKeywords = [
          "오류 페이지", "비정상적인 접근", "접근 제한", "찾을 수 없는",
          "JavaScript", "페이지를 찾을 수 없", "404", "Not Found",
          "Access Denied", "Forbidden", "Bot detected", "captcha",
          "로봇이 아닙니다", "자동화된 요청", "Error", "blocked",
          "This site can", "unable to", "could not"
        ];
        const isErrorPage = errorKeywords.some(keyword =>
          scrapeData.toLowerCase().includes(keyword.toLowerCase())
        );

        // 글자 수 200자 미만이면 상품 설명이 아님
        if (isErrorPage || scrapeData.trim().length < 200) {
          console.log('[generate] 문지기 차단 — 에러페이지:', isErrorPage, '길이:', scrapeData.trim().length);
          return NextResponse.json(
            { error: "CRAWL_FAILED: 해당 URL에서 상품 정보를 읽어올 수 없습니다. 상품 설명을 직접 복사해서 붙여넣어 주세요!" },
            { status: 400 }
          );
        }

        contentText = scrapeData;
      } catch (crawlErr) {
        console.error('[generate] 크롤링 네트워크 에러:', crawlErr);
        return NextResponse.json(
          { error: "CRAWL_FAILED: URL 접속에 실패했습니다. 상품 설명을 직접 복사해서 붙여넣어 주세요!" },
          { status: 400 }
        );
      }
    }

    // ── 6. 물리적 컷오프 (토큰 방어) ──
    const cleanText = contentText.slice(0, 3500);

    // ── 6. AI 생성 (non-streaming: 안정적 에러 처리) ──
    // streamObject는 200 OK를 먼저 보내고 스트림 안에서 에러를 던져서
    // 프론트엔드가 에러를 HTTP 레벨에서 감지할 수 없음 → 페이지 리셋 발생
    // generateObject는 에러 시 throw → catch에서 적절한 HTTP 에러 반환 가능
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
      await supabase.rpc('save_post_and_deduct_credit', {
        p_user_id: userId,
        p_source_url: sourceUrl,
        p_content_json: object,
      });
      console.log('[generate] DB save success');
    } catch (dbErr) {
      console.error('[generate] DB save failed (non-fatal):', dbErr);
    }

    // ── 8. JSON 응답 ──
    return NextResponse.json({ result: object }, { status: 200 });
  } catch (err) {
    console.error('[generate] Error:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);

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
