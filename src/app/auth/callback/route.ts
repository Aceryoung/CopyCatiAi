import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Google OAuth 콜백 처리
 * 로그인 후 Supabase가 /auth/callback?code=... 으로 리다이렉트합니다.
 * 여기서 code를 세션으로 교환하고 메인 페이지로 보냅니다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // 로그인 성공 → 메인 페이지로 이동
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('[auth/callback] exchangeCodeForSession error:', error.message);
  }

  // 실패 시 메인 페이지로 보내기 (에러 표시는 page.tsx에서 처리)
  return NextResponse.redirect(`${origin}/?error=auth_callback_failed`);
}
