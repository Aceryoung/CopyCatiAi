import { createClient } from '@supabase/supabase-js';
import { openai } from '@ai-sdk/openai';
import { streamObject } from 'ai';
import { z } from 'zod';

export const runtime = 'edge';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Note: Edge Runtime에서는 user token으로 동적 client를 생성하므로
// @/lib/supabase의 정적 클라이언트 대신 요청별 생성 유지

const contentSchema = z.object({
  instagram: z.object({
    info: z.string(),
    emotional: z.string(),
    cta: z.string(),
  }),
  blog: z.object({
    draft: z.string(),
  }),
});

export async function POST(req: Request) {
  try {
    // ── 1. Auth: Extract token from Authorization header ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
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
      return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userId = user.id;

    // ── 2. Parse request body ──
    const body = await req.json();
    const sourceUrl: string | undefined = body?.source_url;

    if (!sourceUrl) {
      return Response.json({ error: 'MISSING_SOURCE_URL' }, { status: 400 });
    }

    // ── 3. Pre-check: Credits ──
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return Response.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 });
    }

    if (profile.credits <= 0) {
      return Response.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 403 });
    }

    // ── 4. Pre-check: Regen limit (3 per day per source_url) ──
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const { count, error: countError } = await supabase
      .from('generations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('source_url', sourceUrl)
      .gte('created_at', todayISO);

    if (countError) {
      return Response.json({ error: 'DB_QUERY_FAILED' }, { status: 500 });
    }

    if ((count ?? 0) >= 3) {
      return Response.json({ error: 'REGEN_LIMIT_REACHED' }, { status: 403 });
    }

    // ── 5. Crawl via Jina AI (8s timeout) ──
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let scrapedText: string;

    try {
      const crawlResponse = await fetch(
        `https://r.jina.ai/${encodeURIComponent(sourceUrl)}`,
        {
          method: 'GET',
          headers: {
            Accept: 'text/plain',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!crawlResponse.ok) {
        return Response.json({ error: 'SCRAPE_FAILED' }, { status: 502 });
      }

      scrapedText = await crawlResponse.text();
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof DOMException && err.name === 'AbortError') {
        return Response.json({ error: 'SCRAPE_TIMEOUT' }, { status: 408 });
      }

      return Response.json({ error: 'SCRAPE_TIMEOUT' }, { status: 408 });
    }

    if (!scrapedText || scrapedText.trim().length === 0) {
      return Response.json({ error: 'SCRAPE_EMPTY' }, { status: 422 });
    }

    // ── 6. Stream LLM response via Vercel AI SDK ──
    const result = streamObject({
      model: openai('gpt-4o-mini'),
      schema: contentSchema,
      system: `당신은 마케팅 카피라이터 전문가입니다. 
주어진 웹페이지 콘텐츠를 분석하여 매력적인 SNS 마케팅 콘텐츠를 생성합니다.

규칙:
- instagram.info: 핵심 정보를 전달하는 인스타그램 캡션 (이모지 포함, 3~5문장)
- instagram.emotional: 감성적이고 공감을 이끌어내는 인스타그램 캡션 (이모지 포함, 3~5문장)
- instagram.cta: 행동을 유도하는 CTA 문구 (해시태그 5개 이상 포함)
- blog.draft: SEO에 최적화된 블로그 포스트 초안 (소제목 포함, 500자 이상)

모든 콘텐츠는 한국어로 작성하세요.`,
      prompt: `다음 웹페이지 콘텐츠를 기반으로 인스타그램 & 블로그 마케팅 콘텐츠를 생성해주세요.\n\n---\n\n${scrapedText.slice(0, 12000)}`,
      onFinish: async ({ object }) => {
        if (object) {
          await supabase.rpc('save_post_and_deduct_credit', {
            p_user_id: userId,
            p_source_url: sourceUrl,
            p_content_json: object,
          });
        }
      },
    });

    return result.toTextStreamResponse();
  } catch {
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
