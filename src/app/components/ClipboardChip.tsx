"use client";

import { useState, useCallback } from "react";

interface ClipboardChipProps {
  onPaste: (url: string) => void;
}

export default function ClipboardChip({ onPaste }: ClipboardChipProps) {
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const handleFocus = useCallback(async () => {
    if (dismissed) return;

    try {
      const text = await navigator.clipboard.readText();
      // URL 패턴 확인
      if (text && /^https?:\/\/.+/i.test(text.trim())) {
        setClipUrl(text.trim());
      }
    } catch {
      // 권한 거부 또는 미지원 브라우저 — 무시
    }
  }, [dismissed]);

  const handlePaste = () => {
    if (clipUrl) {
      onPaste(clipUrl);
      setClipUrl(null);
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    setClipUrl(null);
    setDismissed(true);
  };

  return (
    <>
      {/* 투명한 포커스 감지 레이어 — input의 onFocus에 바인딩해서 사용 */}
      <input type="hidden" onFocus={handleFocus} />

      {/* 칩 팝업 */}
      {clipUrl && (
        <div className="animate-chip-pop flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-blue-600 text-xs">📋</span>
          <span className="text-xs text-blue-700 truncate max-w-[200px] font-medium">
            {clipUrl}
          </span>
          <button
            type="button"
            onClick={handlePaste}
            className="text-[11px] font-semibold text-blue-600 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-lg shrink-0 transition-colors"
          >
            붙여넣기
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-600 text-xs shrink-0"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

/** 외부에서 사용할 포커스 핸들러 (input onFocus에 바인딩) */
export function useClipboardDetect(
  onDetect: (url: string) => void,
  dismissed: boolean
) {
  return useCallback(async () => {
    if (dismissed) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text && /^https?:\/\/.+/i.test(text.trim())) {
        onDetect(text.trim());
      }
    } catch {
      // 무시
    }
  }, [dismissed, onDetect]);
}
