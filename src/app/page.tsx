"use client";

import { useState, useCallback, useEffect } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { createClient, Session } from "@supabase/supabase-js";
import { z } from "zod";

/* ── Supabase Client ── */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* ── Zod Schema (mirrors backend) ── */
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

/* ── Spinner SVG ── */
function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/* ── Tab Button ── */
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
        active
          ? "bg-white text-gray-900 shadow-sm"
          : "text-gray-400 hover:text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

/* ── Streaming Text Block ── */
function StreamBlock({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | undefined;
  icon: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
        <span>{icon}</span> {label}
      </h3>
      <div className="bg-gray-800/50 rounded-xl p-4 min-h-[80px] border border-gray-700/50">
        <p className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap break-words">
          {value || (
            <span className="text-gray-500 italic">생성 대기 중…</span>
          )}
        </p>
      </div>
    </div>
  );
}

/* ── Copy Button ── */
function CopyButton({
  label,
  text,
  full = false,
}: {
  label: string;
  text: string;
  full?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`${
        full ? "w-full" : "flex-1"
      } py-2 px-3 text-xs font-medium rounded-lg border transition-all duration-200 ${
        copied
          ? "bg-green-500/20 border-green-500/40 text-green-300"
          : "bg-gray-800/60 border-gray-700/50 text-gray-400 hover:text-gray-200 hover:border-gray-600 active:scale-[0.97]"
      }`}
    >
      {copied ? "✓ 복사됨" : label}
    </button>
  );
}

/* ══════════════════════════════════════════
   Main Page
   ══════════════════════════════════════════ */
export default function GeneratePage() {
  /* ── Auth State ── */
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // 1) Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
    });

    // 2) Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  /* ── Generate State ── */
  const [sourceUrl, setSourceUrl] = useState("");
  const [manualText, setManualText] = useState("");
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"instagram" | "blog">("instagram");

  const accessToken = session?.access_token ?? "";

  const { object, submit, isLoading, error } = useObject({
    api: "/api/generate",
    schema: contentSchema,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    onError: (err) => {
      const message = err?.message || "";

      if (message.includes("SCRAPE_TIMEOUT")) {
        setIsFallbackMode(true);
        return;
      }
      if (message.includes("INSUFFICIENT_CREDITS")) {
        alert(
          "크레딧이 부족합니다.\n설정에서 크레딧을 충전한 후 다시 시도해주세요."
        );
        return;
      }
      if (message.includes("REGEN_LIMIT_REACHED")) {
        alert(
          "오늘 해당 URL의 재생성 한도(3회)에 도달했습니다.\n내일 다시 시도해주세요."
        );
        return;
      }
      alert(`오류가 발생했습니다: ${message}`);
    },
  });

  const handleSubmit = useCallback(() => {
    if (isLoading) return;
    if (isFallbackMode) {
      if (!manualText.trim()) return;
      submit({ source_url: "", manual_text: manualText });
    } else {
      if (!sourceUrl.trim()) return;
      submit({ source_url: sourceUrl });
    }
  }, [isLoading, isFallbackMode, manualText, sourceUrl, submit]);

  const handleResetFallback = () => {
    setIsFallbackMode(false);
    setManualText("");
  };

  const hasResult =
    object?.instagram?.info ||
    object?.instagram?.emotional ||
    object?.instagram?.cta ||
    object?.blog?.draft;

  /* ═══════════════════════════════════
     RENDER: Auth Loading
     ═══════════════════════════════════ */
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="w-8 h-8 text-violet-400" />
          <p className="text-sm text-gray-400">로딩 중…</p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════
     RENDER: Not Logged In
     ═══════════════════════════════════ */
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-gray-950/70 border-b border-gray-800/50">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-sm font-bold">
              C
            </div>
            <span className="font-bold text-lg tracking-tight">CopyCat</span>
          </div>
        </header>

        {/* Login CTA */}
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-8 max-w-sm">
            {/* Icon */}
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 flex items-center justify-center">
              <span className="text-4xl">✨</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-2xl font-bold tracking-tight">
                AI 마케팅 카피라이터
              </h1>
              <p className="text-gray-400 text-sm leading-relaxed">
                URL 하나로 인스타그램 &amp; 블로그 마케팅 콘텐츠를
                <br />
                자동으로 생성해 보세요.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                서비스를 이용하려면 로그인이 필요합니다
              </p>
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-3 bg-white text-gray-900 hover:bg-gray-100 active:scale-[0.98] shadow-lg shadow-white/10"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google로 시작하기
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ═══════════════════════════════════
     RENDER: Logged In — Main UI
     ═══════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-gray-950/70 border-b border-gray-800/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-sm font-bold">
              C
            </div>
            <span className="font-bold text-lg tracking-tight">CopyCat</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:block truncate max-w-[140px]">
              {session.user.email}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50 px-3 py-1.5 rounded-lg transition-all"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-6">
        {/* ── Input Section ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">
              {isFallbackMode
                ? "📝 직접 텍스트 입력"
                : "🔗 URL로 콘텐츠 생성"}
            </h2>
            {isFallbackMode && (
              <button
                type="button"
                onClick={handleResetFallback}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                URL 입력으로 돌아가기
              </button>
            )}
          </div>

          {isFallbackMode ? (
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="크롤링 시간 초과로 인해 수동 입력 모드입니다.&#10;상품 설명이나 홍보하고 싶은 텍스트를 직접 붙여넣어 주세요."
              rows={5}
              className="w-full bg-gray-800/60 border border-gray-700/60 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 resize-none transition-all"
            />
          ) : (
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://example.com/product-page"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="w-full bg-gray-800/60 border border-gray-700/60 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
            />
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              isLoading ||
              (isFallbackMode ? !manualText.trim() : !sourceUrl.trim())
            }
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 active:scale-[0.98] shadow-lg shadow-violet-500/20"
          >
            {isLoading ? (
              <>
                <Spinner className="w-4 h-4" />
                생성 중…
              </>
            ) : (
              <>✨ 콘텐츠 생성하기</>
            )}
          </button>

          {isFallbackMode && (
            <p className="text-xs text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
              ⚠️ 해당 URL의 크롤링이 시간 초과되었습니다. 텍스트를 직접
              입력하시면 동일하게 콘텐츠를 생성할 수 있습니다.
            </p>
          )}
        </section>

        {/* ── Error Display ── */}
        {error && !isFallbackMode && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
            ❌ {error.message}
          </div>
        )}

        {/* ── Results Section ── */}
        {(hasResult || isLoading) && (
          <section className="space-y-4">
            <div className="flex gap-1 bg-gray-800/60 p-1 rounded-xl border border-gray-700/40">
              <TabButton
                active={activeTab === "instagram"}
                onClick={() => setActiveTab("instagram")}
              >
                📸 인스타그램
              </TabButton>
              <TabButton
                active={activeTab === "blog"}
                onClick={() => setActiveTab("blog")}
              >
                📝 블로그
              </TabButton>
            </div>

            {activeTab === "instagram" && (
              <div className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-5 space-y-5 shadow-xl shadow-black/20">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-800/50">
                  <span className="text-base">📸</span>
                  <h2 className="font-bold text-base text-white">
                    인스타그램 카피
                  </h2>
                </div>

                <StreamBlock
                  label="정보 전달형"
                  value={object?.instagram?.info}
                  icon="💡"
                />
                <StreamBlock
                  label="감성형"
                  value={object?.instagram?.emotional}
                  icon="💜"
                />
                <StreamBlock
                  label="CTA & 해시태그"
                  value={object?.instagram?.cta}
                  icon="📣"
                />

                {object?.instagram?.info && !isLoading && (
                  <div className="flex gap-2 pt-2">
                    <CopyButton
                      label="정보형 복사"
                      text={object.instagram.info}
                    />
                    <CopyButton
                      label="감성형 복사"
                      text={object.instagram.emotional ?? ""}
                    />
                    <CopyButton
                      label="CTA 복사"
                      text={object.instagram.cta ?? ""}
                    />
                  </div>
                )}
              </div>
            )}

            {activeTab === "blog" && (
              <div className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-5 space-y-4 shadow-xl shadow-black/20">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-800/50">
                  <span className="text-base">📝</span>
                  <h2 className="font-bold text-base text-white">
                    블로그 초안
                  </h2>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-4 min-h-[200px] border border-gray-700/50">
                  <article className="prose prose-invert prose-sm max-w-none">
                    <p className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap break-words">
                      {object?.blog?.draft || (
                        <span className="text-gray-500 italic">
                          생성 대기 중…
                        </span>
                      )}
                    </p>
                  </article>
                </div>

                {object?.blog?.draft && !isLoading && (
                  <CopyButton
                    label="블로그 초안 복사"
                    text={object.blog.draft}
                    full
                  />
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Empty State ── */}
        {!hasResult && !isLoading && (
          <div className="text-center py-16 space-y-3">
            <div className="text-5xl">🚀</div>
            <h3 className="text-lg font-semibold text-gray-300">
              URL을 입력하고 콘텐츠를 생성해보세요
            </h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              쇼핑몰, 블로그, 뉴스 등 어떤 URL이든 입력하면 인스타그램 &amp;
              블로그용 마케팅 카피를 자동으로 만들어 드립니다.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
