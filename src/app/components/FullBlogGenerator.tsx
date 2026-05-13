import React, { useState, memo } from 'react';
import { DisclaimerModal } from './DisclaimerModal';

// Icons
const SparklesIcon = () => <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>;
const CopyIcon = () => <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
const CheckIcon = () => <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;

const renderHighlightedText = (text: string): React.ReactNode => {
  if (!text) return null;
  const parts = text.split(/(\[.*?\])/g);
  return parts.map((part, index) => {
    if (part.startsWith('[') && part.endsWith(']')) {
      return (
        <span
          key={index}
          className="inline-block bg-yellow-200 text-yellow-900 font-bold px-1.5 py-0.5 rounded mx-0.5 text-sm leading-relaxed"
        >
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

interface Props {
  inputMode: string;
  url: string;
  manualText: string;
  base64Image: string | null;
  credits: number | null;
  session: any;
  addToast: (message: string, type?: string) => void;
  setShowPricingModal: (show: boolean) => void;
  fetchCredits: (userId: string) => void;
  handleCopy: (text: string, id: string) => void;
  copiedStates: Record<string, boolean>;
}

export const FullBlogGenerator = memo(function FullBlogGenerator({
  inputMode, url, manualText, base64Image, credits, session,
  addToast, setShowPricingModal, fetchCredits, handleCopy, copiedStates
}: Props) {
  const [userReview, setUserReview] = useState('');
  const [fullBlogContent, setFullBlogContent] = useState('');
  const [fullBlogStatus, setFullBlogStatus] = useState<'idle' | 'loading' | 'streaming' | 'success'>('idle');
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);

  const DISCLAIMER = '❗[주의: 이 부분은 대표님의 실제 스토어 링크와 사용 후기로 한 줄만 수정해 주세요]\n\n';

  const handleFullGenerate = async () => {
    setIsDisclaimerOpen(false);
    if (inputMode === 'url' && !url.trim()) return addToast('상품 URL을 입력해 주세요.', 'error');
    if (inputMode === 'text' && manualText.trim().length < 10) return addToast('상품 설명을 10자 이상 입력해 주세요.', 'error');
    if (inputMode === 'image' && !base64Image) return addToast("이미지를 첨부해 주세요.", "error");
    if (inputMode === 'image' && credits !== null && credits < 2) {
      addToast("이미지 분석에는 2 크레딧이 필요합니다. 충전 후 이용해주세요.", "error");
      return setShowPricingModal(true);
    }

    setFullBlogStatus('loading');
    setFullBlogContent(DISCLAIMER + '✍️ AI가 완전체 블로그를 작성하고 있습니다...');

    try {
      const res = await fetch('/api/generate-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          inputMode === 'text'
            ? { manual_text: manualText, userReview, source_type: 'text' }
            : inputMode === 'image'
            ? { image_data: base64Image, source_url: null, source_type: 'image', userReview }
            : { source_url: url, userReview, source_type: 'url' }
        ),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errCode = data?.error ?? '';
        if (errCode.includes('INSUFFICIENT_CREDITS')) {
          addToast('크레딧이 부족합니다.', 'error');
          setShowPricingModal(true);
        } else {
          addToast(errCode.replace(/^[A-Z_]+: /, '') || '완전체 생성 중 오류가 발생했습니다.', 'error');
        }
        setFullBlogStatus('idle');
        setFullBlogContent('');
        return;
      }

      setFullBlogStatus('streaming');
      setFullBlogContent(DISCLAIMER);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setFullBlogContent(DISCLAIMER + accumulated);
      }

      const finalContent = DISCLAIMER + accumulated + '\n\n' + DISCLAIMER;
      setFullBlogContent(finalContent);
      setFullBlogStatus('success');
      addToast('완전체 블로그가 생성되었습니다! 🎉', 'success');
      if (session?.user?.id) fetchCredits(session.user.id);

    } catch {
      addToast('네트워크 오류가 발생했습니다.', 'error');
      setFullBlogStatus('idle');
      setFullBlogContent('');
    }
  };

  return (
    <>
      <div className="mt-4 flex flex-col gap-3 p-4 bg-slate-900 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <div>
            <p className="text-sm font-bold text-white">완전체 블로그 만들기</p>
            <p className="text-xs text-slate-400">1,500자+ 스트리밍 생성 · 크레딧 1개</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-400">
            ✍️ 나만의 경험담 (선택)—입력 시 AI가 본문에 자연스러운게 녹여냅니다
          </label>
          <textarea
            value={userReview}
            onChange={(e) => setUserReview(e.target.value)}
            placeholder="예) 생각보다 혼자서도 쉽게 조립되었고, 디자인이 너무 예븁었어요."
            rows={2}
            className="w-full text-sm text-white bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 placeholder-slate-500 resize-none focus:outline-none focus:border-slate-500"
          />
        </div>

        <button
          onClick={() => setIsDisclaimerOpen(true)}
          disabled={fullBlogStatus === 'loading' || fullBlogStatus === 'streaming'}
          className="w-full h-12 bg-amber-400 text-slate-900 font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {fullBlogStatus === 'loading' || fullBlogStatus === 'streaming' ? (
            <><div className="animate-spin w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full" /> {fullBlogStatus === 'streaming' ? '작성 중...' : '준비 중...'}</>
          ) : (
            <>⚡ 완전체 블로그 생성하기 (1,500자+)</>
          )}
        </button>
      </div>

      {(fullBlogStatus === 'streaming' || fullBlogStatus === 'success') && fullBlogContent && (
        <div className="flex flex-col gap-3 p-4 bg-white border-2 border-amber-300 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-amber-700">⚡ 완전체 블로그 초안</span>
            {fullBlogStatus === 'streaming' && (
              <span className="text-xs text-slate-400 animate-pulse">생성 중…</span>
            )}
            {fullBlogStatus === 'success' && (
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✅ 완료</span>
            )}
          </div>
          <div className="flex flex-col items-center w-full my-4 max-h-[400px] overflow-y-auto">
            <div className="text-left w-fit break-keep leading-relaxed space-y-2 text-sm md:text-base text-slate-700 whitespace-pre-wrap">
              {renderHighlightedText(fullBlogContent)}
            </div>
          </div>
          {fullBlogStatus === 'success' && (
            <button
              onClick={() => handleCopy(fullBlogContent, 'fullBlog')}
              className={`w-full h-11 font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${
                copiedStates['fullBlog'] ? 'bg-green-600 text-white' : 'bg-amber-400 text-slate-900'
              }`}
            >
              {copiedStates['fullBlog'] ? <><CheckIcon /> 복사되었습니다</> : <><CopyIcon /> 완전체 전체 복사하기</>}
            </button>
          )}
        </div>
      )}

      <DisclaimerModal
        isOpen={isDisclaimerOpen}
        onClose={() => setIsDisclaimerOpen(false)}
        onConfirm={handleFullGenerate}
      />
    </>
  );
});
