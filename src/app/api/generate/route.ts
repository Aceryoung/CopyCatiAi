import { createClient } from '@/lib/supabase/server';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;


// 블로그 3종 말투를 한 번에 생성하는 스키마
const contentSchema = z.object({
  image_summary: z.string().optional().describe('이미지에서 파악 가능한 제품 특징 1줄 요약. 이미지가 아니거나 정보 추출이 불가능하면 "정보 없음" 반환'),
  instagram: z.object({
    info: z.string().describe('카드뉴스용 정보성 문구 (혜택 중심)'),
    emotional: z.string().describe('스토리텔링 감성형 문구 (라이프스타일 중심)'),
    sale: z.string().describe('구매 유도 중심의 직설적 판매형 문구 (CTA 포함)'),
    hashtags: z.array(z.string()).describe('관련 해시태그 15개'),
  }),
  blog: z.object({
    seo: z.object({
      meta_title: z.string().describe('SEO 최적화된 메인 타겟 키워드 포함 메타 타이틀 (공백 포함 40~50자)'),
      meta_description: z.string().describe('네이버/구글 등에서 검색 시 노출될 매력적인 소개글 (공백 포함 100~140자)'),
      keywords: z.array(z.string()).describe('블로그 포털 통합 검색(네이버, 티스토리, 구글 등) 최상위 노출을 위한 핵심 타겟 키워드 5개'),
    }),
    title_suggestions: z.array(z.string()).describe('클릭을 유도하는 블로그 제목 3개'),
    professional: z.string().describe('1500자 이상의 매우 상세한 네이버/티스토리 블로그 초안. 3인칭 전문가 리뷰어 톤(합니다, 입니다). 내용을 깊이 있게 다루는 소제목 4개 이상 포함.'),
    casual: z.string().describe('1500자 이상의 매우 상세한 네이버/티스토리 블로그 초안. 친근하고 트렌디한 구어체 톤(해요, 인 것 같아요). 꿀팁을 전수하듯 편안한 스타일. 소제목 4개 이상 포함.'),
    story: z.string().describe('1500자 이상의 매우 상세한 네이버/티스토리 블로그 초안. 1인칭 경험담 톤(처음엔 반신반의했는데, 써보니). 흡입력 있게 실제 후기처럼 서술. 소제목 4개 이상 포함.'),
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
  let deductAmount = 1;
  const supabase = await createClient();
  let userId: string | null = null;

  try {
    // ── 1. Auth ──
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    userId = user.id;

    // ── 2. Parse body ──
    const body = await req.json();
    const sourceUrl: string = body?.source_url ?? '';
    const scrapedText: string | undefined = body?.scraped_text;
    const manualText: string | undefined = body?.manual_text;
    const userReview: string = body?.userReview ?? '';  // 유저 경험담 (선택)
    const sourceType: string = body?.source_type ?? 'url'; // 'url' | 'image'
    const base64Image: string | undefined = body?.image_data;

    deductAmount = sourceType === 'image' ? 2 : 1;

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
          await (supabase as any).rpc('refund_credit', { p_user_id: userId, p_refund_amount: deductAmount });
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
    let cleanText = contentText;
    if (sourceType !== 'image') {
      cleanText = extractBodyText(contentText, 3500);
      console.log('[generate] cleanText 길이:', cleanText.length, 'chars (after body extraction)');
    }

    // ── 6. AI 생성 (블로그 3종 말투 동시 생성) ──
    console.log("[generate] 블로그 3종 말투 동시 생성 시작");

    const generateOptions: any = {
      model: openai("gpt-4o-mini"),
      schema: contentSchema,
      system: `당신은 10년 차 탑티어 마케터이자 전문 리뷰/정보 블로거입니다. 독자와 대화하듯 친밀하고 신뢰감 있는 톤을 유지해야 합니다.
제공된 [입력 데이터/URL 콘텐츠]를 바탕으로, 단순 스펙 나열은 배제하고 고객의 페인포인트(Pain Point)를 해결해주는 매력적인 글을 작성하세요.

[절대 규칙]
1. 100% 자연스러운 한국어로만 작성하세요. (기계 번역 어투 절대 금지)
2. 배송 안내, 교환/환불 규정, 단순 고객센터 안내 등 마케팅 본질과 무관한 내용은 완전히 제외하세요.
3. 제품/서비스의 핵심 매력, 차별화 포인트, 고객이 얻는 실질적 혜택(USP)에만 집중하세요.
4. "매력적인 도입부", "본문", "확실한 마무리"와 같은 지시어 자체를 절대로 텍스트나 제목으로 출력하지 마세요. 대신 해당 기능에 맞는, 사람을 훅(Hook)하게 만드는 진짜 소제목(H2/H3)을 창작해 사용하세요.
5. 블로그 초안은 지시된 3가지 페르소나(Professional, Casual, Story)에 맞추어 각각 다른 서사 구조와 전개 방식으로 완전히 새롭게 작성해야 합니다.
6. 한 문단은 최대 3~4문장을 넘지 않게 짧게 끊어 쓰되, 전체 분량이 매우 상세하고 풍성해지도록(최소 1500자 이상) 문단의 개수를 충분히 많이 작성하세요. 중요한 단어에는 볼드체(**강조**)를 적용하고 내용에 맞는 이모지도 적절히 배치하세요.
7. 네이버 블로그, 티스토리, 워드프레스 등 주요 검색 포털 노출(SEO)을 극대화할 수 있도록 제목과 본문에 핵심 타겟 키워드를 자연스럽게 녹여내고, 최적의 SEO 추천 정보(SEO 메타 타이틀, 디스크립션, 추천 키워드 태그)를 함께 도출하세요.

[블로그 구성 필수 가이드라인]
* 도입부 (Intro): 독자의 일상적인 고민이나 불편함에 공감하며 시작하고, 이 글이 어떤 해결책을 줄 수 있는지 부드럽게 제시하세요.
* 본문 (Body): 직관적이고 검색 엔진이 좋아할 만한 소제목 4~5개 이상을 사용하여 상품의 가치를 아주 깊이 있고 상세하게 다루세요. 가독성을 위해 기호(✔️, 📌, • 등)를 텍스트로 직접 입력하여 리스트를 표현하세요. (마크다운 숫자 목록이나 기본 불릿은 복사 시 깨지므로 절대 금지)
* 마무리 (Outro): 본문의 핵심을 2~3줄로 명료하게 요약하고, 독자의 공감을 이끌어내거나 행동을 유도(CTA)하며 자연스럽게 끝맺음하세요.

[저품질 방지 필수 규칙 — 절대 생략 금지]
블로그 초안 작성 시, 사용자가 직접 채워 넣거나 사진을 첨부해야 할 '커스텀 영역'을 본문 중간중간 2~3곳 반드시 삽입하세요.
이 영역은 무조건 대괄호 기호와 이모지를 사용하여 명확하게 표시해야 합니다.
(예시 포맷)
- [ 📷 이곳에 실제 배송받은 패키지 사진을 1장 넣어주세요 ]
- [ ✍️ 내가 느낀 이 제품의 가장 큰 장점 한 가지를 적어주세요 ]
- [ 📷 제품의 질감이 잘 보이는 확대 사진을 첨부해 주세요 ]
이 규칙은 professional, casual, story 세 가지 버전 모두에 동일하게 적용됩니다.

[가독성 및 포맷팅 절대 규칙]
1. 모바일 환경을 최우선으로 고려해라. 절대 3문장 이상을 한 문단으로 묶지 마라.
2. 2문장이 끝날 때마다 반드시 줄바꿈(Enter 2번, \n\n)을 넣어 모바일 화면의 여백을 확보해라.
3. 시선이 집중될 수 있도록 핵심 키워드나 결론은 문단 맨 앞(두괄식)에 배치해라.
4. 단락이 전환될 때는 마크다운 소제목(###)을 적극 활용하고, 그 위아래로 빈 줄을 넉넉히 추가해라.
5. 네이버 블로그 복사 시 숫자 정렬이 깨지는 것을 방지하기 위해, 문장 맨 앞에 마크다운 숫자 목록(1., 2., 3.)이나 기본 불릿(-, *) 사용을 엄격히 금지한다. 리스트가 필요할 경우 무조건 문장 맨 앞에 기호(✔️, 📌, ✨)를 텍스트로 직접 입력해라.`
    };

    if (sourceType === 'image' && base64Image) {
      generateOptions.messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: `주제: 업로드된 이미지를 분석하여 상품 정보를 추출하고, 유저 리뷰가 있다면 반영하여 마케팅 블로그 초안을 작성해주세요.${userReview.trim().length > 0 ? `\n\n[유저 실제 경험담 — 반드시 본문에 자연스럽게 포함]\n${userReview}` : ''}` },
            { type: 'image', image: base64Image }
          ]
        }
      ];
    } else {
      generateOptions.prompt = `주제:\n${cleanText}${userReview.trim().length > 0 ? `\n\n[유저 실제 경험담 — 반드시 본문에 자연스럽게 포함]\n${userReview}` : ''}`;
    }

    const { object } = await generateObject(generateOptions);

    // ── 7. DB 저장 + 크레딧 차감 (save_generation_and_deduct가 원자적으로 처리) ──
    try {
      console.log('DB로 보낼 userId 확인:', userId);
      console.log('DB로 보낼 object 데이터 확인:', JSON.stringify(object).slice(0, 50) + '...');
      console.log('[generate] 블로그 professional 앞 50자:', (object as any).blog?.professional?.slice(0, 50));
      console.log('[generate] 블로그 casual 앞 50자:', (object as any).blog?.casual?.slice(0, 50));
      console.log('[generate] 블로그 story 앞 50자:', (object as any).blog?.story?.slice(0, 50));
      console.log('[generate] blog 전체 키:', Object.keys((object as any).blog || {}));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: dbError } = await (supabase as any).rpc('save_generation_and_deduct', {
        p_user_id: userId,
        p_source_url: sourceType === 'image' ? null : (sourceUrl || '수동입력'),
        p_content_json: object,
        p_source_type: sourceType,
        p_source_summary: (object as any).image_summary || null,
        p_deduct_amount: deductAmount
      });

      if (dbError) {
        // 크레딧 부족 에러 → 결과는 보여주되 저장 실패 로그만
        console.error('[generate] DB 에러:', dbError);
      } else {
        creditDeducted = true; // 저장+차감 성공
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
        await (supabase as any).rpc('refund_credit', { p_user_id: userId, p_refund_amount: deductAmount });
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
