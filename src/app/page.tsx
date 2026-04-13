"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient, Session } from "@supabase/supabase-js";
import { z } from "zod";
import ToastProvider, { showToast } from "./components/Toast";
import LoginBottomSheet from "./components/LoginBottomSheet";
import HistoryBottomSheet from "./components/HistoryBottomSheet";

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
    sale: z.string(),
    hashtags: z.array(z.string()),
  }),
  blog: z.object({
    title_suggestions: z.array(z.string()),
    body_markdown: z.string(),
  }),
});

type CrawlStatus = "idle" | "crawling" | "crawled" | "error" | "rate_limited";

/* ══════════════════════════════════════════
   Utility Components
   ══════════════════════════════════════════ */

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ── Copy Button with Toast ── */
function CopyBtn({
  label,
  text,
  guideMsg,
  full = false,
  variant = "default",
}: {
  label: string;
  text: string;
  guideMsg?: string;
  full?: boolean;
  variant?: "default" | "primary";
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast(guideMsg || "복사 완료!", "success");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast("복사에 실패했습니다.", "error");
    }
  };

  const base = full ? "w-full" : "flex-1";
  const style =
    variant === "primary"
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50";

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`${base} h-11 px-4 text-xs font-semibold rounded-xl transition-all duration-200 active:scale-[0.97] ${style}`}
    >
      {copied ? "✓ 복사됨" : label}
    </button>
  );
}

/* ── Skeleton Block ── */
function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-shimmer rounded-lg h-4"
          style={{ width: i === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  );
}

/* ── Streaming Content Block ── */
function ContentBlock({
  label,
  value,
  icon,
  isLoading,
}: {
  label: string;
  value: string | undefined;
  icon: string;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
        <span>{icon}</span> {label}
      </h3>
      <div className="bg-slate-50 rounded-xl p-4 min-h-[72px] border border-slate-100">
        {isLoading && !value ? (
          <SkeletonBlock />
        ) : (
          <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap break-words">
            {value || (
              <span className="text-slate-400 italic">생성 대기 중…</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Tab Button ── */
function TabBtn({
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
      className={`flex-1 h-11 text-sm font-semibold rounded-xl transition-all duration-200 ${
        active
          ? "bg-white text-slate-900 shadow-sm border border-slate-200"
          : "text-slate-400 hover:text-slate-600"
      }`}
    >
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════
   Main Page
   ══════════════════════════════════════════ */
export default function GeneratePage() {
  /* ── Auth ── */
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setShowLogin(false);
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    showToast("로그아웃 되었습니다.", "info");
  };

  /* ── Generate State ── */
  const [sourceUrl, setSourceUrl] = useState("");
  const [manualText, setManualText] = useState("");
  const [isManualMode, setIsManualMode] = useState(false);
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatus>("idle");
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"instagram" | "blog">("instagram");

  /* ── Clipboard Detection ── */
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [clipDismissed, setClipDismissed] = useState(false);

  const handleInputFocus = useCallback(async () => {
    if (clipDismissed || isManualMode) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text && /^https?:\/\/.+/i.test(text.trim())) {
        setClipUrl(text.trim());
      }
    } catch {
      // 권한 거부 — 무시
    }
  }, [clipDismissed, isManualMode]);

  const accessToken = session?.access_token ?? "";

  // ── Generate State (non-streaming: fetch + useState) ──
  const [result, setResult] = useState<z.infer<typeof contentSchema> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const displayObject = result;

  /* ── Submit Handler ── */
  const handleSubmit = useCallback(async () => {
    if (isLoading) return;

    // 1. 수동 텍스트 입력 → 크롤링 없이 바로 AI 생성
    if (isManualMode) {
      if (!manualText.trim()) return;

      setIsLoading(true);
      setResult(null);

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ manual_text: manualText }),
        });

        const data = await res.json();

        if (!res.ok) {
          const errCode = data?.error ?? "INTERNAL_ERROR";
          if (errCode.includes("INSUFFICIENT_CREDITS")) {
            showToast("크레딧이 부족합니다. 충전 후 다시 시도해 주세요.", "error");
          } else if (errCode.includes("보안이 강력한")) {
            showToast(errCode, "error");
          } else if (errCode.includes("OPENAI_QUOTA_EXCEEDED")) {
            showToast("AI 서비스 크레딧이 부족합니다. 잠시 후 다시 시도해 주세요.", "error");
          } else {
            showToast("콘텐츠 생성 중 오류가 발생했습니다.", "error");
          }
          return;
        }

        setResult(data.result);
        showToast("콘텐츠가 성공적으로 생성되었습니다!", "success");
      } catch {
        showToast("네트워크 오류가 발생했습니다.", "error");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 2. URL 입력 → 백엔드에서 크롤링 + AI 생성 한번에 처리
    if (!sourceUrl.trim()) return;

    setCrawlError(null);
    setCrawlStatus("crawling");
    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ source_url: sourceUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errCode = data?.error ?? "INTERNAL_ERROR";

        if (errCode.includes("INSUFFICIENT_CREDITS")) {
          showToast("크레딧이 부족합니다. 충전 후 다시 시도해 주세요.", "error");
        } else if (errCode.includes("REGEN_LIMIT_REACHED")) {
          showToast("오늘 해당 URL의 재생성 한도(3회)에 도달했습니다.", "error");
        } else if (errCode.includes("OPENAI_QUOTA_EXCEEDED")) {
          showToast("AI 서비스 크레딧이 부족합니다. 잠시 후 다시 시도해 주세요.", "error");
        } else if (errCode.includes("CRAWL_FAILED") || errCode.includes("보안이 강력한")) {
          // 크롤링 실패 → 수동 입력 모드로 자동 전환
          setCrawlError(errCode);
          setIsManualMode(true);
          setCrawlStatus("error");
          // 에러 메시지에서 "CRAWL_FAILED: " 프리픽스 제거
          const userMsg = errCode.replace("CRAWL_FAILED: ", "");
          showToast(userMsg, "error");
          return;
        } else {
          showToast("콘텐츠 생성 중 오류가 발생했습니다.", "error");
        }
        return;
      }

      // ✅ 성공
      setCrawlStatus("crawled");
      setResult(data.result);
      showToast("콘텐츠가 성공적으로 생성되었습니다!", "success");
    } catch {
      setCrawlStatus("error");
      showToast("네트워크 오류가 발생했습니다.", "error");
    } finally {
      setIsLoading(false);
      setTimeout(() => setCrawlStatus("idle"), 2000);
    }
  }, [isLoading, isManualMode, manualText, sourceUrl, accessToken]);

  const handleResetManual = () => {
    setIsManualMode(false);
    setManualText("");
    setCrawlError(null);
    setCrawlStatus("idle");
  };

  const handleHistorySelect = (item: { content_json: Record<string, unknown>; source_url: string }) => {
    try {
      setResult(item.content_json as z.infer<typeof contentSchema>);
      setSourceUrl(item.source_url || "");
      showToast("이전 기록을 불러왔습니다.", "info");
    } catch {
      showToast("기록을 불러오는데 실패했습니다.", "error");
    }
  };

  const isBusy = isLoading || crawlStatus === "crawling";
  const hasResult = !!(
    displayObject?.instagram?.info ||
    displayObject?.instagram?.emotional ||
    displayObject?.instagram?.sale ||
    displayObject?.blog?.body_markdown
  );

  /* ═══════════════════════════════════
     RENDER: Loading
     ═══════════════════════════════════ */
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="w-6 h-6 text-slate-400" />
      </div>
    );
  }

  /* ═══════════════════════════════════
     PAGE A: Landing (비로그인)
     ═══════════════════════════════════ */
  if (!session) {
    return (
      <>
        <ToastProvider />
        <LoginBottomSheet
          isOpen={showLogin}
          onClose={() => setShowLogin(false)}
          onGoogleLogin={handleGoogleLogin}
        />

        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="px-5 pt-4 pb-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white text-sm font-bold">
              C
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">CopyCat</span>
          </header>

          {/* Hero */}
          <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
            <div className="text-center space-y-5 w-full">
              <div className="space-y-2">
                <h1 className="text-[26px] font-extrabold text-slate-900 leading-tight tracking-tight">
                  URL 하나로
                  <br />
                  마케팅 카피 생성
                </h1>
                <p className="text-sm text-slate-500 leading-relaxed">
                  쇼핑몰 링크만 붙여넣으면
                  <br />
                  인스타그램 &amp; 블로그 콘텐츠를 자동 생성해요.
                </p>
              </div>

              {/* Fake Input — 클릭 시 로그인 시트 */}
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                className="w-full h-14 bg-white rounded-2xl border-2 border-slate-200 px-4 flex items-center gap-3 text-left hover:border-slate-300 transition-colors shadow-sm"
              >
                <span className="text-slate-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </span>
                <span className="text-sm text-slate-400">상품 URL을 붙여넣어 보세요</span>
              </button>

              {/* Features */}
              <div className="grid grid-cols-3 gap-3 pt-4">
                {[
                  { icon: "📸", label: "인스타 카피" },
                  { icon: "📝", label: "블로그 초안" },
                  { icon: "⚡", label: "10초 생성" },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="bg-white rounded-xl p-3 border border-slate-100 text-center space-y-1"
                  >
                    <span className="text-xl">{f.icon}</span>
                    <p className="text-[11px] font-medium text-slate-500">{f.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  /* ═══════════════════════════════════
     PAGE B: Dashboard (로그인)
     ═══════════════════════════════════ */
  return (
    <>
      <ToastProvider />
      <HistoryBottomSheet
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        accessToken={accessToken}
        onSelectItem={handleHistorySelect}
      />

      <div className="min-h-screen flex flex-col">
        {/* ── Header ── */}
        <header className="px-5 pt-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white text-sm font-bold">
              C
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">CopyCat</span>
          </div>
          <div className="flex items-center gap-2">
            {/* 히스토리 버튼 */}
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {/* 로그아웃 */}
            <button
              type="button"
              onClick={handleLogout}
              className="h-9 px-3 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </header>

        <main className="flex-1 px-5 pb-24 space-y-5">
          {/* ── Input Section ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">
                {isManualMode ? "📝 텍스트 직접 입력" : "🔗 URL로 콘텐츠 생성"}
              </h2>
              {isManualMode && (
                <button
                  type="button"
                  onClick={handleResetManual}
                  className="text-xs text-blue-600 font-medium"
                >
                  URL 입력으로 돌아가기
                </button>
              )}
            </div>

            {isManualMode ? (
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="상품 설명이나 홍보 텍스트를 직접 붙여넣어 주세요."
                rows={5}
                className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 resize-none transition-colors"
              />
            ) : (
              <>
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  onFocus={handleInputFocus}
                  placeholder="https://smartstore.naver.com/..."
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  disabled={isBusy}
                  className="w-full h-14 bg-white border-2 border-slate-200 rounded-2xl px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-colors disabled:opacity-50"
                />

                {/* Clipboard Chip */}
                {clipUrl && !clipDismissed && (
                  <div className="animate-chip-pop flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                    <span className="text-blue-600 text-xs">📋</span>
                    <span className="text-xs text-blue-700 truncate max-w-[180px] font-medium">
                      {clipUrl}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSourceUrl(clipUrl);
                        setClipUrl(null);
                        setClipDismissed(true);
                      }}
                      className="text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-lg shrink-0 transition-colors"
                    >
                      붙여넣기
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setClipUrl(null);
                        setClipDismissed(true);
                      }}
                      className="text-slate-400 hover:text-slate-600 text-sm shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Crawl Status */}
            {crawlStatus === "crawling" && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 animate-fade-in">
                <Spinner className="w-3.5 h-3.5 text-blue-500" />
                URL 크롤링 중… (최대 30초)
              </div>
            )}
            {crawlStatus === "crawled" && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-100 rounded-xl text-xs text-green-700 animate-fade-in">
                ✓ 크롤링 완료 — 콘텐츠 생성 중
              </div>
            )}

            {/* CTA Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isBusy || (isManualMode ? !manualText.trim() : !sourceUrl.trim())}
              className="w-full h-12 rounded-2xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98] shadow-sm"
            >
              {crawlStatus === "crawling" ? (
                <><Spinner className="w-4 h-4" /> 크롤링 중…</>
              ) : isLoading ? (
                <><Spinner className="w-4 h-4" /> 생성 중…</>
              ) : (
                <>✨ 콘텐츠 생성하기</>
              )}
            </button>

            {/* Crawl error manual mode hint */}
            {isManualMode && crawlError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                {crawlError === "JINA_RATE_LIMITED"
                  ? "⚠️ 크롤링 서비스 한도에 도달했습니다. 텍스트를 직접 입력해 주세요."
                  : "❌ 해당 URL은 크롤링이 불가합니다. 텍스트를 직접 입력해 주세요."}
              </p>
            )}
          </section>

          {/* ── Results Section ── */}
          {(hasResult || isLoading) && (
            <section className="space-y-4 animate-fade-in">
              {/* Tabs */}
              <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
                <TabBtn active={activeTab === "instagram"} onClick={() => setActiveTab("instagram")}>
                  📸 인스타그램
                </TabBtn>
                <TabBtn active={activeTab === "blog"} onClick={() => setActiveTab("blog")}>
                  📝 블로그
                </TabBtn>
              </div>

              {/* Instagram Tab */}
              {activeTab === "instagram" && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm animate-fade-in">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <span className="text-base">📸</span>
                    <h2 className="font-bold text-base text-slate-900">인스타그램 카피</h2>
                  </div>

                  <ContentBlock label="정보 전달형" value={displayObject?.instagram?.info} icon="💡" isLoading={isLoading} />
                  <ContentBlock label="감성형" value={displayObject?.instagram?.emotional} icon="💜" isLoading={isLoading} />
                  <ContentBlock label="판매형 (CTA)" value={displayObject?.instagram?.sale} icon="🔥" isLoading={isLoading} />

                  {/* Hashtags */}
                  {displayObject?.instagram?.hashtags && displayObject.instagram.hashtags.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <span>#️⃣</span> 해시태그
                      </h3>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="flex flex-wrap gap-1.5">
                          {displayObject.instagram.hashtags.map((tag, i) => (
                            <span
                              key={i}
                              className="text-[11px] bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2.5 py-0.5 font-medium"
                            >
                              {tag?.startsWith("#") ? tag : `#${tag}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {displayObject?.instagram?.info && !isLoading && (
                    <div className="space-y-2 pt-2">
                      <div className="flex gap-2">
                        <CopyBtn label="정보형 복사" text={displayObject.instagram.info} guideMsg="복사 완료! 인스타그램 앱을 열어 붙여넣어 주세요." />
                        <CopyBtn label="감성형 복사" text={displayObject.instagram.emotional ?? ""} guideMsg="복사 완료! 인스타그램 앱을 열어 붙여넣어 주세요." />
                      </div>
                      <div className="flex gap-2">
                        <CopyBtn label="판매형 복사" text={displayObject.instagram.sale ?? ""} guideMsg="복사 완료! 인스타그램 앱을 열어 붙여넣어 주세요." />
                        {displayObject?.instagram?.hashtags && displayObject.instagram.hashtags.length > 0 && (
                          <CopyBtn
                            label="#해시태그 복사"
                            text={displayObject.instagram.hashtags.map((t) => (t?.startsWith("#") ? t : `#${t}`)).join(" ")}
                            guideMsg="해시태그를 복사했습니다!"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Blog Tab */}
              {activeTab === "blog" && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm animate-fade-in">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <span className="text-base">📝</span>
                    <h2 className="font-bold text-base text-slate-900">블로그 콘텐츠</h2>
                  </div>

                  {/* Title Suggestions */}
                  {(isLoading || (displayObject?.blog?.title_suggestions && displayObject.blog.title_suggestions.length > 0)) && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <span>🏷️</span> 추천 제목
                      </h3>
                      {isLoading && !displayObject?.blog?.title_suggestions?.length ? (
                        <SkeletonBlock lines={3} />
                      ) : (
                        <div className="space-y-1.5">
                          {displayObject?.blog?.title_suggestions?.map((title, i) => (
                            <div key={i} className="flex items-start gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                              <span className="text-blue-600 font-bold text-xs shrink-0 mt-0.5">{i + 1}.</span>
                              <p className="text-sm text-slate-700">{title}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Body */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <span>📄</span> 블로그 초안
                    </h3>
                    <div className="bg-slate-50 rounded-xl p-4 min-h-[180px] border border-slate-100">
                      {isLoading && !displayObject?.blog?.body_markdown ? (
                        <SkeletonBlock lines={8} />
                      ) : (
                        <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap break-words">
                          {displayObject?.blog?.body_markdown || (
                            <span className="text-slate-400 italic">생성 대기 중…</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {displayObject?.blog?.body_markdown && !isLoading && (
                    <CopyBtn
                      label="블로그 초안 전체 복사"
                      text={displayObject.blog.body_markdown}
                      guideMsg="복사 완료! 네이버 블로그 앱을 열어 붙여넣어 주세요."
                      full
                      variant="primary"
                    />
                  )}
                </div>
              )}
            </section>
          )}

          {/* ── Empty State ── */}
          {!hasResult && !isLoading && crawlStatus === "idle" && (
            <div className="text-center py-14 space-y-3 animate-fade-in">
              <div className="text-4xl">🚀</div>
              <h3 className="text-base font-bold text-slate-700">
                URL을 입력하고 콘텐츠를 생성해보세요
              </h3>
              <p className="text-sm text-slate-400 max-w-[260px] mx-auto leading-relaxed">
                쇼핑몰, 블로그, 뉴스 등 어떤 URL이든 입력하면 마케팅 카피를 자동으로 만들어 드려요.
              </p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
