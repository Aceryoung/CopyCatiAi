import React, { useState } from 'react';

const CopyIcon = () => <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m-3 4H9m-2 4h4" /></svg>;
const CheckIcon = () => <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
const ExternalLinkIcon = () => <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>;

interface Props {
  result: any;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, id: string) => void;
  showDeepLink: string | null;
}

export const InstaSection = React.memo(function InstaSection({ result, copiedStates, handleCopy, showDeepLink }: Props) {
  const [activeTab, setActiveTab] = useState('info');

  const getInstaContent = (tab: string): string => {
    if (!result) return '';
    if (tab === 'info') return result.instagram.info;
    if (tab === 'emotion') return result.instagram.emotional;
    if (tab === 'sales') return result.instagram.sale;
    return '';
  };

  // --- [강조 표시 렌더러 (팩트 체크 및 커스텀 영역)] ---
  const renderHighlightedText = (text: string) => {
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
      <h2 className="text-lg font-semibold text-slate-800">인스타그램용 (3종)</h2>

      {/* 팩트 체크 경고 배너 */}
      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg shadow-sm animate-in fade-in">
        <span className="text-base mt-0.5">⚠️</span>
        <p className="text-[13px] text-red-800 leading-relaxed font-medium">
          <strong>필수 확인:</strong> AI가 작성한 상품명, 가격, 스펙 등의 숫자가 실제와 일치하는지 반드시 확인 후 발행하세요!
        </p>
      </div>

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
        <div className="text-base leading-relaxed text-slate-700 whitespace-pre-wrap flex-1 min-h-[160px]">
          {renderHighlightedText(getInstaContent(activeTab))}
        </div>

        {/* 해시태그 */}
        {result.instagram.hashtags && result.instagram.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
            {result.instagram.hashtags.map((tag: string, i: number) => (
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
              onClick={() => handleCopy(result.instagram.hashtags.map((t: string) => `#${t?.replace(/^#+/, '')}`).join(' '), 'hashtag')}
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
  );
});
