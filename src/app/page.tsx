

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { PricingModal } from './components/PricingModal';
import { ClassifySection } from './components/ClassifySection';
import { marked } from 'marked';
import { InputSection } from './components/InputSection';
import { InstaSection } from './components/InstaSection';
import { BlogSection } from './components/BlogSection';

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
  const [historyItems, setHistoryItems] = useState<Array<{id: string; source_url: string; source_type?: string; source_summary?: string; created_at: string; content_json: any}>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);

  const [inputMode, setInputMode] = useState('url');
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [manualText, setManualText] = useState('');

  const [status, setStatus] = useState('idle'); // idle | loading | success
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [showDeepLink, setShowDeepLink] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number, message: string, type: string }>>([])

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
      const res = await fetch('/api/history');
      if (!res.ok) {
        console.error('history fetch failed:', await res.text());
        return;
      }
      const data = await res.json();
      setHistoryItems(Array.isArray(data?.history) ? data.history : []);
    } catch (e) {
      console.error('history fetch error:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  // --- [액션 핸들러] ---
  const addToast = useCallback((message: string, type = 'default') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

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

  const handleReset = () => {
    setUrl('');
    setManualText('');
    setBase64Image(null);
    setImagePreviewUrl(null);
    setResult(null);
    setStatus('idle');
    setInputMode('url');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- [결과 데이터 매핑] (디자인 탭에 맞게) ---

  const handleCopy = useCallback(async (rawText: string, platform: string) => {
    try {
      // 1. 마크다운(**, ### 등)을 HTML로 변환 — 블로그 에디터 호환
      const htmlContent = await marked.parse(rawText);

      // 2. ClipboardItem으로 서식 + 평어택스트 동시 등록
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([htmlContent], { type: 'text/html' }),
        'text/plain': new Blob([rawText], { type: 'text/plain' }),
      });

      // 3. 최신 API로 서식 복사
      await navigator.clipboard.write([clipboardItem]);

      // 4. 성공 UI
      setCopiedStates(prev => ({ ...prev, [platform]: true }));
      addToast('블로그 서식이 적용된 상태로 복사되었습니다!', 'success');
      setShowDeepLink(platform);
      setTimeout(() => setCopiedStates(prev => ({ ...prev, [platform]: false })), 2000);

    } catch {
      // Fallback: 구형 브라우저(ClipboardItem 미지원) 대비
      try {
        await navigator.clipboard.writeText(rawText);
        setCopiedStates(prev => ({ ...prev, [platform]: true }));
        addToast('기본 텍스트로 복사되었습니다.', 'success');
        setShowDeepLink(platform);
        setTimeout(() => setCopiedStates(prev => ({ ...prev, [platform]: false })), 2000);
      } catch {
        addToast('복사에 실패했습니다. 브라우저 권한을 확인해주세요.', 'error');
      }
    }
  }, [addToast]);

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
                상품 URL 단 하나로<br />1초 만에 마케팅 카피 자동 생성
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
            <InputSection
              status={status} setStatus={setStatus} setResult={setResult}
              setShowDeepLink={setShowDeepLink} credits={credits}
              setShowPricingModal={setShowPricingModal} addToast={addToast}
              inputMode={inputMode} setInputMode={setInputMode}
              url={url} setUrl={setUrl} manualText={manualText} setManualText={setManualText}
              base64Image={base64Image} setBase64Image={setBase64Image}
              imagePreviewUrl={imagePreviewUrl} setImagePreviewUrl={setImagePreviewUrl}
            />

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
                <InstaSection
                  result={result}
                  copiedStates={copiedStates}
                  handleCopy={handleCopy}
                  showDeepLink={showDeepLink}
                />

                <BlogSection
                  result={result}
                  copiedStates={copiedStates}
                  handleCopy={handleCopy}
                  showDeepLink={showDeepLink}
                  inputMode={inputMode}
                  url={url}
                  manualText={manualText}
                  base64Image={base64Image}
                  credits={credits}
                  session={session}
                  addToast={addToast}
                  setShowPricingModal={setShowPricingModal}
                  fetchCredits={fetchCredits}
                />

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
                        try {
                          const parsedContent = typeof item.content_json === 'string' 
                            ? JSON.parse(item.content_json) 
                            : item.content_json;
                          
                          setResult(parsedContent as GenerateResult);
                          setStatus('success');
                          setShowHistorySheet(false);
                          addToast('이전 생성 결과를 불러왔습니다.', 'success');
                        } catch (e) {
                          console.error("Failed to parse content_json", e);
                          addToast('콘텐츠를 불러오는 중 오류가 발생했습니다.', 'error');
                        }
                      } else {
                        addToast('저장된 콘텐츠가 없습니다.', 'error');
                      }
                    }}
                    className="w-full text-left p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 hover:bg-slate-100 active:scale-[0.99] transition-all"
                  >
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {item.source_type === 'image' 
                          ? `📸 이미지 생성 ${item.source_summary ? `(${item.source_summary})` : ''}` 
                          : item.source_url === '수동입력' ? '📝 텍스트 직접 입력' : `🔗 ${item.source_url || '상품 URL'}`}
                      </p>
                      <p className="text-xs text-slate-400">
                        {(() => {
                          try {
                            if (!item.created_at) return '';
                            const safeDate = typeof item.created_at === 'string' ? item.created_at.replace(' ', 'T') : item.created_at;
                            const d = new Date(safeDate);
                            if (isNaN(d.getTime())) return String(item.created_at);
                            return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                          } catch (e) {
                            return String(item.created_at) || '';
                          }
                        })()}
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