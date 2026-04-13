import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60; // Pro 플랜: 60초, Hobby: 10초로 낮추세요

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/* ─────────────────────────────────────────
   유틸: HTML → 순수 텍스트 추출
   ───────────────────────────────────────── */
function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/* ─────────────────────────────────────────
   전략 1: Jina AI Reader
   - 429 발생 시 rateLimited: true 반환
   ───────────────────────────────────────── */
async function crawlWithJina(
  url: string,
  timeoutMs = 30000
): Promise<{ text: string | null; rateLimited: boolean }> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Jina는 URL을 인코딩하지 않고 그대로 붙입니다
    const res = await fetch(`https://r.jina.ai/${url}`, {
      method: 'GET',
      headers: {
        Accept: 'text/plain',
        ...(process.env.JINA_API_KEY
          ? { Authorization: `Bearer ${process.env.JINA_API_KEY}` }
          : {}),
      },
      signal: controller.signal,
    });

    clearTimeout(tid);

    // 무료 토큰 소진 (429 Too Many Requests)
    if (res.status === 429) {
      console.warn('[crawl] Jina AI 무료 토큰 소진 (429)');
      return { text: null, rateLimited: true };
    }

    if (!res.ok) {
      console.warn(`[crawl] Jina responded ${res.status}`);
      return { text: null, rateLimited: false };
    }

    const text = (await res.text()).trim();
    return {
      text: text.length > 200 ? text : null,
      rateLimited: false,
    };
  } catch (err) {
    clearTimeout(tid);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.warn(`[crawl] Jina ${isAbort ? 'timeout' : 'error'}:`, (err as Error).message);
    return { text: null, rateLimited: false };
  }
}

/* ─────────────────────────────────────────
   전략 2: 직접 HTML fetch (폴백)
   ───────────────────────────────────────── */
async function crawlWithDirectFetch(url: string, timeoutMs = 10000): Promise<string | null> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: controller.signal,
    });

    clearTimeout(tid);
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;

    const html = await res.text();
    const text = extractTextFromHtml(html);
    return text.length > 200 ? text : null;
  } catch (err) {
    clearTimeout(tid);
    console.warn('[crawl] Direct fetch error:', (err as Error).message);
    return null;
  }
}

/* ─────────────────────────────────────────
   POST /api/crawl
   ───────────────────────────────────────── */
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

    // ── 2. Parse & validate URL ──
    const body = await req.json();
    const sourceUrl: string | undefined = body?.source_url;

    if (!sourceUrl) {
      return NextResponse.json({ error: 'MISSING_SOURCE_URL' }, { status: 400 });
    }

    try {
      const parsed = new URL(sourceUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      return NextResponse.json({ error: 'INVALID_URL' }, { status: 400 });
    }

    // ── 3. 전략 1: Jina AI Reader ──
    console.log(`[crawl] Trying Jina AI for: ${sourceUrl}`);
    const jinaResult = await crawlWithJina(sourceUrl, 30000);

    if (jinaResult.rateLimited) {
      // 429: 무료 토큰 소진 → 직접 fetch로 폴백
      console.warn('[crawl] Jina rate limited → trying direct fetch as fallback');
      const directText = await crawlWithDirectFetch(sourceUrl, 10000);

      if (directText) {
        console.log(`[crawl] Direct fetch fallback success: ${directText.length} chars`);
        return NextResponse.json({ text: directText.slice(0, 12000) }, { status: 200 });
      }

      // 폴백도 실패 → 수동 모드 안내
      console.warn('[crawl] All strategies failed (rate limited + direct fetch failed)');
      return NextResponse.json({ error: 'JINA_RATE_LIMITED' }, { status: 429 });
    }

    if (jinaResult.text) {
      console.log(`[crawl] Jina success: ${jinaResult.text.length} chars`);
      return NextResponse.json({ text: jinaResult.text.slice(0, 12000) }, { status: 200 });
    }

    // ── 4. 전략 2: 직접 fetch (Jina 실패/타임아웃 시 폴백) ──
    console.warn('[crawl] Jina failed → trying direct fetch');
    const directText = await crawlWithDirectFetch(sourceUrl, 10000);

    if (directText) {
      console.log(`[crawl] Direct fetch success: ${directText.length} chars`);
      return NextResponse.json({ text: directText.slice(0, 12000) }, { status: 200 });
    }

    console.warn(`[crawl] All strategies failed for: ${sourceUrl}`);
    return NextResponse.json({ error: 'SCRAPE_FAILED' }, { status: 502 });
  } catch (err) {
    console.error('[crawl] Unexpected error:', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
