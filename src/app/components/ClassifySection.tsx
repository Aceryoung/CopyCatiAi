"use client";

import React, { useState } from "react";

/* ── 아이콘 ── */
const CopyIcon = () => (
  <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);
const CheckIcon = () => (
  <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

/* ── 타입 ── */
interface ClassifyResult {
  headline: string;
  structure: string;
  bodyText: string;
}

interface CardProps {
  emoji: string;
  title: string;
  content: string;
  accentClass: string;         // 헤더 배경 색상 테일윈드 클래스
  borderClass: string;         // 카드 테두리 색상
  badgeClass: string;          // 배지 배경/텍스트 색상
  copyKey: string;
  copiedStates: Record<string, boolean>;
  onCopy: (text: string, key: string) => void;
  isLarge?: boolean;           // 본문 섹션은 더 큰 폰트
}

/* ── 카드 컴포넌트 ── */
function ClassifyCard({
  emoji, title, content, accentClass, borderClass, badgeClass,
  copyKey, copiedStates, onCopy, isLarge = false,
}: CardProps) {
  return (
    <div
      className={`flex flex-col rounded-2xl border ${borderClass} bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-500`}
    >
      {/* 카드 헤더 */}
      <div className={`flex items-center justify-between px-4 py-3 ${accentClass}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <span className="text-sm font-bold text-white">{title}</span>
        </div>
        {/* 복사 버튼 */}
        <button
          onClick={() => onCopy(content, copyKey)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors active:scale-95"
        >
          {copiedStates[copyKey] ? (
            <>
              <CheckIcon />
              복사됨!
            </>
          ) : (
            <>
              <CopyIcon />
              복사하기
            </>
          )}
        </button>
      </div>

      {/* 배지 */}
      <div className="px-4 pt-3">
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${badgeClass}`}>
          {emoji} {title}
        </span>
      </div>

      {/* 본문 */}
      <div className="px-4 py-3 pb-5">
        <p
          className={`leading-relaxed text-slate-700 whitespace-pre-wrap ${
            isLarge ? "text-base" : "text-sm"
          }`}
        >
          {content}
        </p>
      </div>
    </div>
  );
}

/* ── 메인 컴포넌트 ── */
interface ClassifySectionProps {
  result: ClassifyResult;
  onToast: (message: string, type?: string) => void;
}

export function ClassifySection({ result, onToast }: ClassifySectionProps) {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates((prev) => ({ ...prev, [key]: true }));
      onToast("텍스트가 복사되었습니다.", "success");
      setTimeout(() => setCopiedStates((prev) => ({ ...prev, [key]: false })), 2000);
    } catch {
      onToast("복사에 실패했습니다. 브라우저 권한을 확인해주세요.", "error");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 섹션 1: 후킹 헤드라인 */}
      <ClassifyCard
        emoji="🎣"
        title="후킹 헤드라인"
        content={result.headline}
        accentClass="bg-gradient-to-r from-rose-500 to-orange-500"
        borderClass="border-rose-200"
        badgeClass="bg-rose-50 text-rose-700 border-rose-200"
        copyKey="headline"
        copiedStates={copiedStates}
        onCopy={handleCopy}
      />

      {/* 섹션 2: 블로그 구조 설계 */}
      <ClassifyCard
        emoji="🏗️"
        title="블로그 구조 설계"
        content={result.structure}
        accentClass="bg-gradient-to-r from-violet-500 to-blue-500"
        borderClass="border-violet-200"
        badgeClass="bg-violet-50 text-violet-700 border-violet-200"
        copyKey="structure"
        copiedStates={copiedStates}
        onCopy={handleCopy}
      />

      {/* 섹션 3: 본문 내용 */}
      <ClassifyCard
        emoji="✍️"
        title="본문 내용"
        content={result.bodyText}
        accentClass="bg-gradient-to-r from-emerald-500 to-teal-500"
        borderClass="border-emerald-200"
        badgeClass="bg-emerald-50 text-emerald-700 border-emerald-200"
        copyKey="body"
        copiedStates={copiedStates}
        onCopy={handleCopy}
        isLarge
      />
    </div>
  );
}
