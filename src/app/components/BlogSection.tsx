import React, { useState } from 'react';
import { FullBlogGenerator } from './FullBlogGenerator';

const SparklesIcon = () => <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>;
const ClipboardIcon = () => <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
const CopyIcon = () => <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m-3 4H9m-2 4h4" /></svg>;
const CheckIcon = () => <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
const ExternalLinkIcon = () => <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>;

interface Props {
  result: any;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, id: string) => void;
  showDeepLink: string | null;
  // FullBlogGenerator props:
  inputMode: string;
  url: string;
  manualText: string;
  base64Image: string | null;
  credits: number | null;
  session: any;
  addToast: (msg: string, type?: string) => void;
  setShowPricingModal: (show: boolean) => void;
  fetchCredits: (id: string) => void;
}

export const BlogSection = React.memo(function BlogSection({
  result, copiedStates, handleCopy, showDeepLink,
  inputMode, url, manualText, base64Image, credits, session, addToast, setShowPricingModal, fetchCredits
}: Props) {
  const [blogTone, setBlogTone] = useState<'professional' | 'casual' | 'story'>('professional');

  // --- [강조 표시 렌더러 (팩트 체크 및 커스텀 영역)] ---
  const renderHighlightedText = (text: string) => {
    // 1. [대괄호 커스텀 영역]
    // 2. 숫자 + 선택적 쉼표/소수점 + 선택적 단위 (원, 개, %, cm 등)
    const regex = /(\[.*?\]|\d+(?:,\d+)*(?:\.\d+)?\s*(?:원|개|%|cm|mm|m|kg|g|ml|l|L|명|분|시간|일|월|년|회|건)?)/g;
    const parts = text.split(regex);
    return parts.map((part, index) => {
      // 매칭된 패턴이면 노란색 형광펜 처리 (대괄호 패턴이거나 숫자로 시작하는 경우)
      if ((part.startsWith('[') && part.endsWith(']')) || /^\d/.test(part)) {
        return (
          <span key={index} className="bg-yellow-200/60 font-bold px-1.5 py-0.5 mx-0.5 rounded text-slate-800">
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-slate-800">네이버 블로그 초안</h2>

      {/* 모바일 뷰어 래퍼 — PC에서도 스마트폰 비율로 미리보기 */}
      <div className="w-full max-w-[480px] mx-auto flex flex-col gap-4">

      {/* 팩트 체크 경고 배너 */}
      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg shadow-sm animate-in fade-in">
        <span className="text-base mt-0.5">⚠️</span>
        <p className="text-[13px] text-red-800 leading-relaxed font-medium">
          <strong>필수 확인:</strong> AI가 작성한 상품명, 가격, 스펙 등의 숫자가 실제와 일치하는지 반드시 확인 후 발행하세요!
        </p>
      </div>

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
                  {result.blog.seo.keywords.map((kw: string, i: number) => (
                    <span key={i} className="text-xs bg-white text-slate-700 border border-slate-200 font-medium px-2 py-0.5 rounded-full">
                      #{kw.replace(/^#+/, '')}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleCopy(`[SEO 메타 타이틀]\n${result.blog.seo!.meta_title}\n\n[SEO 소개글]\n${result.blog.seo!.meta_description}\n\n[추천 키워드]\n${result.blog.seo!.keywords.map((k: string) => '#' + k.replace(/^#+/, '')).join(' ')}`, 'seo')}
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
            {result.blog.title_suggestions.map((title: string, idx: number) => <li key={idx} className="leading-snug">{title}</li>)}
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
          <div className="flex flex-col items-center w-full my-4">
            <div className="text-left w-fit break-keep leading-relaxed space-y-2 text-base md:text-lg text-slate-700 whitespace-pre-wrap">
              {renderHighlightedText(result.blog[blogTone] || result.blog.body_markdown || '')}
            </div>
          </div>
          {/* 넛지 안내 */}
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mt-1">
            <span className="text-base">💡</span>
            <p className="text-xs text-yellow-800 leading-relaxed">
              <strong>노란색 영역</strong>에 실제 사진과 나만의 경험을 채워주세요. 유사 문서 감지를 피해 블로그 검색 노출이 높아집니다.
            </p>
          </div>
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

        {/* ── 완전체 생성 옵션 ── */}
        <FullBlogGenerator
          inputMode={inputMode} url={url} manualText={manualText} base64Image={base64Image}
          credits={credits} session={session} addToast={addToast} setShowPricingModal={setShowPricingModal}
          fetchCredits={fetchCredits} handleCopy={handleCopy} copiedStates={copiedStates}
        />
      </div>
      </div>{/* /모바일 뷰어 래퍼 */}
    </section>
  );
});
