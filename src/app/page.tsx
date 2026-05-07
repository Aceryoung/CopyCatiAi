

"use client";

import React, { useState, useEffect } from 'react';
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { PricingModal } from './components/PricingModal';
import { ClassifySection } from './components/ClassifySection';


// --- [아이콘 컴포넌트] ---
const GoogleIcon = () => <svg className="size-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>;
const SparklesIcon = () => <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>;
const CopyIcon = () => <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
const CheckIcon = () => <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
const HistoryIcon = () => <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const ClipboardIcon = () => <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
const ExternalLinkIcon = () => <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>;
const RefreshIcon = () => <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;

interface GenerateResult {
  instagram: {
    info: string;
    emotional: string;
    sale: string;
    hashtags: string[];
  };
  blog: {
    seo?: {
      meta_title: string;
      meta_description: string;
      keywords: string[];
    };
    title_suggestions: string[];
    professional: string;
    casual: string;
    story: string;
    body_markdown?: string; // 하위 호환 (이전 히스토리)
  };
}

export default function App() {
  const supabase = createClient();
  // --- [Supabase Auth 상태] ---
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [historyItems, setHistoryItems] = useState<Array<{id: string; source_url: string; created_at: string; content_json: any}>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);

  const [inputMode, setInputMode] = useState('url');
  const [url, setUrl] = useState('');
  const [manualText, setManualText] = useState('');
  const [blogTone, setBlogTone] = useState<'professional' | 'casual' | 'story'>('professional');

  // --- [블로그 초안 분류 기능] ---
  const [classifyText, setClassifyText] = useState('');
  const [classifyStatus, setClassifyStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [classifyResult, setClassifyResult] = useState<{
    headline: string;
    structure: string;
    bodyText: string;
  } | null>(null);

  const [status, setStatus] = useState('idle'); // idle | loading | success
  const [activeTab, setActiveTab] = useState('info');
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [showDeepLink, setShowDeepLink] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number, message: string, type: string }>>([]);

  // --- [실제 API 결과 데이터] ---
  const [result, setResult] = useState<GenerateResult | null>(null);

  // --- [Supabase Auth 초기화] ---
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

  const isLoggedIn = !!session;

  // --- [크레딧 조회] ---
  const fetchCredits = async (userId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single();
      if (data) setCredits(data.credits);
    } catch (e) {
      console.error('credit fetch error:', e);
    }
  };

  useEffect(() => {
    if (session?.user?.id) fetchCredits(session.user.id);
  }, [session]);

  // --- [히스토리 불러오기] ---
  const fetchHistory = async () => {
    if (!session) return;
    setHistoryLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('generations')
        .select('id, source_url, created_at, content_json')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && data) setHistoryItems(data);
    } catch (e) {
      console.error('history fetch error:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  // --- [액션 핸들러] ---
  const addToast = (message: string, type = 'default') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const handleGoogleLogin = async () => {
    setShowLoginSheet(false);
    // redirectTo: 현재 환경(로컬/Vercel)의 실제 URL을 자동으로 사용
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    addToast("로그아웃 되었습니다.", "default");
  };

  const handlePasteClipboard = async (type: string) => {
    try {
      const text = await navigator.clipboard.readText();
      if (type === 'url') {
        if (text.startsWith('http')) {
          setUrl(text);
          addToast('클립보드에서 URL을 붙여넣었습니다.', 'success');
        } else {
          addToast('클립보드에 유효한 URL이 없습니다.', 'error');
        }
      } else if (type === 'text') {
        if (text.length > 5) {
          setManualText(text);
          addToast('텍스트를 붙여넣었습니다.', 'success');
        } else {
          addToast('복사된 텍스트가 너무 짧습니다.', 'error');
        }
      }
    } catch {
      addToast('클립보드 접근 권한이 필요합니다.', 'error');
    }
  };

  // --- [블로그 초안 분류 핸들러] ---
  const handleClassify = async () => {
    if (classifyText.trim().length < 20) {
      return addToast('분류할 텍스트를 20자 이상 입력해 주세요.', 'error');
    }
    setClassifyStatus('loading');
    setClassifyResult(null);
    try {
      const res = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: classifyText }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errCode = data?.error ?? 'INTERNAL_ERROR';
        if (errCode.includes('UNAUTHORIZED')) {
          addToast('로그인 후 이용해 주세요.', 'error');
        } else {
          addToast('분류 중 오류가 발생했습니다.', 'error');
        }
        setClassifyStatus('idle');
        return;
      }
      setClassifyResult(data.result);
      setClassifyStatus('success');
      addToast('초안 분류가 완료되었습니다!', 'success');
    } catch {
      addToast('네트워크 오류가 발생했습니다.', 'error');
      setClassifyStatus('idle');
    }
  };

  // --- [실제 /api/generate 연동] ---
  const handleGenerate = async () => {
    if (inputMode === 'url' && !url.trim()) return addToast("상품 URL을 입력해 주세요.", "error");
    if (inputMode === 'text' && manualText.trim().length < 10) return addToast("상품 설명 텍스트를 10자 이상 입력해 주세요.", "error");

    setStatus('loading');
    setShowDeepLink(null);
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          inputMode === 'text'
            ? { manual_text: manualText }
            : { source_url: url }
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        const errCode = data?.error ?? "INTERNAL_ERROR";

        if (errCode.includes("INSUFFICIENT_CREDITS")) {
          addToast("크레딧이 부족합니다. 충전 후 다시 시도해 주세요.", "error");
          setShowPricingModal(true); // 크레딧 0 → 결제 모달 자동 오픈
        } else if (errCode.includes("REGEN_LIMIT_REACHED")) {
          addToast("오늘 해당 URL의 재생성 한도(3회)에 도달했습니다.", "error");
        } else if (errCode.includes("OPENAI_QUOTA_EXCEEDED")) {
          addToast("AI 서비스가 일시적으로 불가합니다. 잠시 후 다시 시도해 주세요.", "error");
        } else if (errCode.includes("NETWORK_ERROR")) {
          addToast("네트워크 연결이 불안정합니다. Wi-Fi 확인 후 다시 시도해 주세요.", "error");
        } else if (errCode.includes("CRAWL_FAILED") || errCode.includes("보안이 강력한") || errCode.includes("MISSING_CONTENT")) {
          // 크롤링 실패 → 수동 입력 모드로 자동 전환
          setInputMode('text');
          const userMsg = errCode.replace("CRAWL_FAILED: ", "");
          addToast(userMsg, "error");
        } else {
          addToast("콘텐츠 생성 중 오류가 발생했습니다.", "error");
        }
        setStatus('idle');
        return;
      }

      // ✅ 성공 — 실제 API 결과 저장
      setResult(data.result);
      setStatus('success');
      addToast("카피 생성이 완료되었습니다!", "success");
    } catch {
      addToast("네트워크 오류가 발생했습니다.", "error");
      setStatus('idle');
    }
  };

  const handleReset = () => {
    setUrl('');
    setManualText('');
    setResult(null);
    setStatus('idle');
    setInputMode('url');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- [결과 데이터 매핑] (디자인 탭에 맞게) ---
  const getInstaContent = (tab: string): string => {
    if (!result) return '';
    if (tab === 'info') return result.instagram.info;
    if (tab === 'emotion') return result.instagram.emotional;
    if (tab === 'sales') return result.instagram.sale;
    return '';
  };

  const handleCopy = async (text: string, platform: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates({ ...copiedStates, [platform]: true });
      addToast('텍스트가 복사되었습니다.', 'success');
      setShowDeepLink(platform);
      setTimeout(() => setCopiedStates(prev => ({ ...prev, [platform]: false })), 2000);
    } catch {
      addToast('복사에 실패했습니다. 브라우저 권한을 확인해주세요.', 'error');
    }
  };

  // --- [Auth 로딩 중] ---
  if (authLoading) {
    return (
      <div className="w-full max-w-[390px] mx-auto min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[390px] mx-auto min-h-screen bg-slate-50 flex flex-col relative font-sans">

      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-30">
        <button type="button" onClick={handleReset} className="text-xl font-bold tracking-tight text-slate-900 hover:opacity-80 transition-opacity">
          CopyCat AI
        </button>
        {!isLoggedIn ? (
          <button onClick={() => setShowLoginSheet(true)} className="px-4 h-10 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors">
            로그인
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {/* 크레딧 칩 */}
            {credits !== null && (
              <button
                onClick={() => setShowPricingModal(true)}
                className="flex items-center gap-1.5 px-3 h-9 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-sm font-semibold hover:bg-blue-100 transition-colors"
              >
                <span className="text-xs text-blue-400 font-normal">크레딧</span>
                <span>{credits}</span>
              </button>
            )}
            <button onClick={() => { setShowHistorySheet(true); fetchHistory(); }} className="p-2 text-slate-500 hover:text-slate-800 transition-colors">
              <HistoryIcon />
            </button>
            <button onClick={handleLogout} className="px-3 h-9 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors">
              로그아웃
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 gap-6 pb-24">

        {!isLoggedIn ? (
          // Page A (비로그인 홈 화면)
          <div className="flex flex-col justify-center gap-6 mt-12">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold leading-tight text-slate-900 break-keep">
                상세페이지 정보만 넣으세요.<br />15초 만에 카피 완성.
              </h1>
              <p className="text-base text-slate-600">AI가 셀러님의 상품을 분석해 팔리는 글을 씁니다.</p>
            </div>
            <button onClick={() => setShowLoginSheet(true)} className="w-full h-14 px-4 bg-white border-2 border-slate-200 rounded-lg text-left text-slate-400 text-base shadow-sm active:scale-[0.99] transition-transform">
              상품 URL 또는 텍스트 입력...
            </button>
          </div>
        ) : (
          // Page B (로그인 후 대시보드)
          <div className="flex flex-col gap-8">

            <section className="flex flex-col gap-3">
              <div className="flex p-1 bg-slate-100 rounded-lg h-12">
                <button
                  onClick={() => setInputMode('url')}
                  className={`flex-1 rounded-md text-xs font-medium transition-all ${inputMode === 'url' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                  링크로 입력
                </button>
                <button
                  onClick={() => setInputMode('text')}
                  className={`flex-1 rounded-md text-xs font-medium transition-all ${inputMode === 'text' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                  텍스트 입력
                </button>
                <button
                  onClick={() => setInputMode('classify')}
                  className={`flex-1 rounded-md text-xs font-medium transition-all ${inputMode === 'classify' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                  초안 분류
                </button>
              </div>

              {inputMode === 'url' && (
                <div className="flex flex-col gap-2 animate-in fade-in duration-200">
                  <input
                    type="text"
                    placeholder="상품 URL 입력 (예: 스마트스토어 링크)"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                    disabled={status === 'loading'}
                    className="w-full h-12 px-4 bg-white border border-slate-200 rounded-md text-base focus:ring-2 focus:ring-slate-900 outline-none disabled:opacity-50"
                  />
                  <div className="flex justify-start">
                    <button onClick={() => handlePasteClipboard('url')} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium hover:bg-blue-100 transition-colors">
                      <ClipboardIcon />복사한 URL 붙여넣기
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed px-1">
                    💡 스마트스토어, 쿠팡 등은 <button type="button" onClick={() => setInputMode('text')} className="text-blue-500 font-medium underline underline-offset-2">[텍스트 직접 입력]</button>을 권장합니다. (크롤링 실패 시 크레딧 미차감)
                  </p>
                </div>
              )}

              {inputMode === 'text' && (
                <div className="flex flex-col gap-2 animate-in fade-in duration-200">
                  <textarea
                    placeholder="크롤링이 막힌 경우, 상품 상세페이지의 텍스트를 긁어서 여기에 붙여넣어 주세요."
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    disabled={status === 'loading'}
                    className="w-full h-32 p-4 bg-white border border-slate-200 rounded-md text-base focus:ring-2 focus:ring-slate-900 outline-none resize-none disabled:opacity-50"
                  />
                  <div className="flex justify-start">
                    <button onClick={() => handlePasteClipboard('text')} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium hover:bg-blue-100 transition-colors">
                      <ClipboardIcon />복사한 텍스트 붙여넣기
                    </button>
                  </div>
                </div>
              )}

              {inputMode !== 'classify' && (
                <button
                  onClick={handleGenerate}
                  disabled={status === 'loading'}
                  className="w-full h-12 flex items-center justify-center gap-2 mt-1 rounded-md font-medium bg-slate-900 text-white disabled:bg-slate-200 disabled:text-slate-400 active:scale-[0.98] transition-all"
                >
                  {status === 'loading' ? (
                    <><div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> 생성 중...</>
                  ) : (
                    <><SparklesIcon /> 카피 생성하기</>
                  )}
                </button>
              )}
            </section>

            {/* ── 초안 분류 섹션 ── */}
            {inputMode === 'classify' && (
              <section className="flex flex-col gap-3 animate-in fade-in duration-200">
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    블로그 초안을 붙여넣으면 AI가 🎣&nbsp;헤드라인 · 🏗️&nbsp;구조 · ✍️&nbsp;본문 3가지로 자동 분류해줍니다.
                  </p>
                  <textarea
                    placeholder="블로그 초안 또는 정제되지 않은 원문을 여기에 붙여넣어 주세요..."
                    value={classifyText}
                    onChange={(e) => setClassifyText(e.target.value)}
                    disabled={classifyStatus === 'loading'}
                    className="w-full h-40 p-4 bg-white border border-slate-200 rounded-md text-base focus:ring-2 focus:ring-violet-400 outline-none resize-none disabled:opacity-50"
                  />
                  <div className="flex justify-between items-center">
                    <button
                      onClick={async () => {
                        try {
                          const t = await navigator.clipboard.readText();
                          if (t.length > 5) { setClassifyText(t); addToast('텍스트를 붙여넣었습니다.', 'success'); }
                          else addToast('복사된 텍스트가 너무 짧습니다.', 'error');
                        } catch { addToast('클립보드 접근 권한이 필요합니다.', 'error'); }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-600 rounded-full text-xs font-medium hover:bg-violet-100 transition-colors"
                    >
                      <ClipboardIcon />복사한 텍스트 붙여넣기
                    </button>
                    <span className="text-xs text-slate-400">{classifyText.length} / 8000자</span>
                  </div>
                </div>
                <button
                  onClick={handleClassify}
                  disabled={classifyStatus === 'loading'}
                  className="w-full h-12 flex items-center justify-center gap-2 rounded-md font-medium bg-gradient-to-r from-violet-600 to-blue-600 text-white disabled:opacity-50 active:scale-[0.98] transition-all shadow-sm"
                >
                  {classifyStatus === 'loading' ? (
                    <><div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> 분류 중...</>
                  ) : (
                    <>✨ 스마트 분류하기</>
                  )}
                </button>

                {/* 분류 로딩 스켈레톤 */}
                {classifyStatus === 'loading' && (
                  <div className="flex flex-col gap-3 mt-2">
                    {['🎣 후킹 헤드라인 분석 중...', '🏗️ 구조 설계 추출 중...', '✍️ 본문 내용 정리 중...'].map((label, i) => (
                      <div key={i} className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm animate-pulse">
                        <div className="text-xs text-slate-400 mb-2">{label}</div>
                        <div className="h-3 bg-slate-100 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                )}

                {/* 분류 결과 */}
                {classifyStatus === 'success' && classifyResult && (
                  <div className="mt-2">
                    <ClassifySection result={classifyResult} onToast={addToast} />
                  </div>
                )}
              </section>
            )}

            {status === 'loading' && (
              <section className="flex flex-col gap-4 animate-in fade-in duration-300">
                <h2 className="text-lg font-semibold text-slate-800">카피 작성 중...</h2>
                <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm min-h-[200px] flex flex-col gap-3 relative overflow-hidden">
                  <div className="absolute inset-0 bg-slate-100/50 animate-pulse"></div>
                  <p className="text-base text-slate-600 relative z-10 leading-relaxed">
                    AI가 상품 데이터를 분석하여 최적의 마케팅 카피를 작성하고 있습니다...
                    <span className="inline-block w-1 h-4 bg-slate-400 animate-pulse ml-1 align-middle"></span>
                  </p>
                </div>
              </section>
            )}

            {status === 'success' && result && (
              <div className="flex flex-col gap-10 animate-in slide-in-from-bottom-4 duration-500">

                {/* 인스타그램 섹션 */}
                <section className="flex flex-col gap-4">
                  <h2 className="text-lg font-semibold text-slate-800">인스타그램용 (3종)</h2>
                  <div className="flex p-1 bg-slate-100 rounded-lg h-12">
                    {[{ id: 'info', label: '정보성' }, { id: 'emotion', label: '감성형' }, { id: 'sales', label: '판매형' }].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col gap-4">
                    {/* 마케팅 기법 배지 */}
                    <div className="flex items-center gap-2">
                      {activeTab === 'info' && (
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">📊 혜택 소구 적용</span>
                      )}
                      {activeTab === 'emotion' && (
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">📖 스토리텔링 적용</span>
                      )}
                      {activeTab === 'sales' && (
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">🔥 구매유도 CTA 적용</span>
                      )}
                      <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-500">마케팅 전문가 AI</span>
                    </div>
                    <p className="text-base leading-relaxed text-slate-700 whitespace-pre-wrap flex-1 min-h-[160px]">
                      {getInstaContent(activeTab)}
                    </p>

                    {/* 해시태그 */}
                    {result.instagram.hashtags && result.instagram.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                        {result.instagram.hashtags.map((tag, i) => (
                          <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2.5 py-0.5 font-medium">
                            {`#${tag?.replace(/^#+/, '')}`}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleCopy(getInstaContent(activeTab), 'insta')}
                        className={`w-full h-11 font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${copiedStates['insta'] ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                      >
                        {copiedStates['insta'] ? <><CheckIcon /> 복사 완료!</> : <><CopyIcon /> 텍스트 복사하기</>}
                      </button>

                      {/* 해시태그 복사 버튼 */}
                      {result.instagram.hashtags && result.instagram.hashtags.length > 0 && (
                        <button
                          onClick={() => handleCopy(result.instagram.hashtags.map(t => `#${t?.replace(/^#+/, '')}`).join(' '), 'hashtag')}
                          className={`w-full h-11 font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${copiedStates['hashtag'] ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                        >
                          {copiedStates['hashtag'] ? <><CheckIcon /> 해시태그 복사됨!</> : <>#️⃣ 해시태그 복사하기</>}
                        </button>
                      )}

                      {showDeepLink === 'insta' && (
                        <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" className="w-full h-11 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-md flex items-center justify-center gap-2 animate-in fade-in">
                          <ExternalLinkIcon /> 인스타그램 앱 열기
                        </a>
                      )}
                    </div>
                  </div>
                </section>

                {/* 블로그 섹션 */}
                <section className="flex flex-col gap-4">
                  <h2 className="text-lg font-semibold text-slate-800">네이버 블로그 초안</h2>

                  {/* 블로그 말투 탭 (인스타처럼 탭 전환) */}
                  <div className="flex p-1 bg-slate-100 rounded-lg h-12">
                    {([
                      { key: 'professional', label: '🧑‍💼 전문가형' },
                      { key: 'casual',       label: '😊 구어체' },
                      { key: 'story',        label: '📖 스토리' },
                    ] as { key: 'professional' | 'casual' | 'story'; label: string }[]).map(t => (
                      <button
                        key={t.key}
                        onClick={() => setBlogTone(t.key)}
                        className={`flex-1 rounded-md text-sm font-medium transition-all ${blogTone === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col gap-6">
                    {result.blog.seo && (
                      <>
                        <div className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <SparklesIcon />
                            <span className="text-sm font-bold text-slate-800">SEO (검색 엔진 최적화) 데이터</span>
                          </div>
                          <div>
                            <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">메타 타이틀</span>
                            <p className="text-sm text-slate-800 mt-1">{result.blog.seo.meta_title}</p>
                          </div>
                          <div>
                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">메타 디스크립션</span>
                            <p className="text-sm text-slate-800 mt-1">{result.blog.seo.meta_description}</p>
                          </div>
                          <div>
                            <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">타겟 키워드 태그</span>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {result.blog.seo.keywords.map((kw, i) => (
                                <span key={i} className="text-xs bg-white text-slate-700 border border-slate-200 font-medium px-2 py-0.5 rounded-full">
                                  #{kw.replace(/^#+/, '')}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => handleCopy(`[SEO 메타 타이틀]\n${result.blog.seo!.meta_title}\n\n[SEO 소개글]\n${result.blog.seo!.meta_description}\n\n[추천 키워드]\n${result.blog.seo!.keywords.map(k => '#' + k.replace(/^#+/, '')).join(' ')}`, 'seo')}
                            className={`mt-1 w-full h-9 font-medium text-sm rounded-md flex items-center justify-center gap-1.5 transition-colors ${copiedStates['seo'] ? 'bg-slate-200 text-slate-800' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                          >
                            {copiedStates['seo'] ? <><CheckIcon /> 복사 성공!</> : <><ClipboardIcon /> SEO 데이터 통합 복사</>}
                          </button>
                        </div>
                        <hr className="border-slate-100" />
                      </>
                    )}
                    
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-semibold text-slate-500 bg-slate-100 w-fit px-2 py-1 rounded">추천 제목</span>
                      <ul className="text-base text-slate-800 list-disc list-inside space-y-1">
                        {result.blog.title_suggestions.map((title, idx) => <li key={idx} className="leading-snug">{title}</li>)}
                      </ul>
                    </div>
                    <hr className="border-slate-100" />
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-500 bg-slate-100 w-fit px-2 py-1 rounded">본문 초안</span>
                        <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                          {blogTone === 'professional' ? '전문가형 말투' : blogTone === 'casual' ? '친근한 구어체' : '경험담 스토리'}
                        </span>
                      </div>
                      <p className="text-base leading-relaxed text-slate-700 whitespace-pre-wrap">
                        {result.blog[blogTone] || result.blog.body_markdown || ''}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 mt-2">
                      <button
                        onClick={() => handleCopy(result.blog[blogTone] || result.blog.body_markdown || '', 'blog')}
                        className={`w-full h-11 font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${copiedStates['blog'] ? 'bg-green-600 text-white' : 'bg-slate-900 text-white active:scale-[0.98]'}`}
                      >
                        {copiedStates['blog'] ? <><CheckIcon /> 복사되었습니다</> : <><CopyIcon /> 초안 전체 복사하기</>}
                      </button>
                      {showDeepLink === 'blog' && (
                        <a href="https://blog.naver.com" target="_blank" rel="noopener noreferrer" className="w-full h-11 bg-[#03C75A] text-white font-medium rounded-md flex items-center justify-center gap-2 animate-in fade-in">
                          <ExternalLinkIcon /> 네이버 블로그 열기
                        </a>
                      )}
                    </div>
                  </div>
                </section>

                {/* 면책 고지 */}
                <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800 leading-relaxed">
                    ⚠️ <strong>주의:</strong> AI가 작성한 초안이므로 실제 상품의 스펙, 가격, 할인 정보와 다를 수 있습니다. 업로드 전 반드시 내용을 검수해 주세요. CopyCat AI는 이로 인한 분쟁에 책임지지 않습니다.
                  </p>
                </div>

                {/* 새로고침 / 다시 시작 */}
                <button
                  onClick={handleReset}
                  className="w-full h-12 flex items-center justify-center gap-2 rounded-md font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 active:scale-[0.98] transition-all"
                >
                  <RefreshIcon /> 새로운 카피 만들기
                </button>
              </div>
            )}

            {/* Empty State */}
            {status === 'idle' && !result && (
              <div className="text-center py-14 space-y-3">
                <div className="text-4xl">🚀</div>
                <h3 className="text-base font-bold text-slate-700">URL을 입력하고 콘텐츠를 생성해보세요</h3>
                <p className="text-sm text-slate-400 max-w-[260px] mx-auto leading-relaxed">
                  쇼핑몰, 블로그, 뉴스 등 어떤 URL이든 입력하면 마케팅 카피를 자동으로 만들어 드려요.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Pricing Modal (portal-root에 렌더 — 390px 바깥) */}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        userEmail={session?.user?.email}
        onSuccess={() => {
          if (session?.user?.id) fetchCredits(session.user.id);
          addToast('결제가 완료되었습니다! 크레딧이 충전되었습니다.', 'success');
        }}
      />

      {/* History Modal */}
      {showHistorySheet && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 z-40 transition-opacity" onClick={() => setShowHistorySheet(false)} />
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl p-6 shadow-xl flex flex-col h-[70vh] z-50 animate-in slide-in-from-bottom-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">최근 생성 기록</h3>
              <button onClick={() => setShowHistorySheet(false)} className="text-sm text-slate-500 font-medium p-2">닫기</button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-8">
              {historyLoading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-slate-700 rounded-full" />
                </div>
              ) : historyItems.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">생성 기록이 없습니다.</p>
              ) : (
                historyItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.content_json) {
                        setResult(item.content_json as GenerateResult);
                        setStatus('success');
                        setShowHistorySheet(false);
                        addToast('이전 생성 결과를 불러왔습니다.', 'success');
                      } else {
                        addToast('저장된 콘텐츠가 없습니다.', 'error');
                      }
                    }}
                    className="w-full text-left p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 hover:bg-slate-100 active:scale-[0.99] transition-all"
                  >
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {item.source_url === '수동입력' ? '📝 텍스트 직접 입력' : `🔗 ${item.source_url || '상품 URL'}`}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(item.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className="text-slate-300 text-lg">›</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Login Modal */}
      {showLoginSheet && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 z-40 transition-opacity" onClick={() => setShowLoginSheet(false)} />
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl p-6 pb-10 shadow-xl flex flex-col gap-5 z-50 animate-in slide-in-from-bottom-full">
            <h3 className="text-lg font-semibold text-slate-800 text-center">구글 로그인 후 3회 무료 이용</h3>
            <button
              onClick={handleGoogleLogin}
              className="w-full h-14 flex items-center justify-center gap-2 bg-white border border-slate-300 rounded-md text-slate-700 font-medium active:bg-slate-50"
            >
              <GoogleIcon /> 구글로 시작하기
            </button>
          </div>
        </>
      )}

      {/* Toast UI */}
      <div className="fixed bottom-6 inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-bottom-2 fade-in
              ${toast.type === 'error' ? 'bg-red-600 text-white' :
                toast.type === 'success' ? 'bg-slate-900 text-white' :
                  'bg-slate-800 text-white'}
            `}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}