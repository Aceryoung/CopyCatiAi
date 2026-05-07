"use client";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DisclaimerModal({ isOpen, onClose, onConfirm }: Props) {
  if (!isOpen) return null;

  return (
    <>
      {/* 오버레이 */}
      <div
        className="fixed inset-0 bg-slate-900/60 z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 바텀 시트 */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 pb-safe">
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        <div className="px-6 pt-4 pb-8 flex flex-col gap-5">
          {/* 헤더 */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <h3 className="text-lg font-bold text-slate-900">완전체 블로그 생성 안내</h3>
            </div>
            <p className="text-sm text-slate-500">시작 전 아래 내용을 확인해 주세요</p>
          </div>

          {/* 안내 항목 */}
          <ul className="flex flex-col gap-3">
            {[
              { icon: "💳", text: "크레딧 1개가 차감됩니다" },
              {
                icon: "📝",
                text: "1,500자 이상의 완성된 블로그 초안이 생성됩니다 (생성까지 10~30초 소요)",
              },
              {
                icon: "🟡",
                text: "노란색 영역에 실제 사진과 나만의 경험을 채운 뒤 업로드하세요 (저품질 방지)",
              },
              {
                icon: "⚠️",
                text: "AI가 작성한 글임을 명시하고, 반드시 검수 후 게시해 주세요",
              },
            ].map(({ icon, text }, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="text-base shrink-0 mt-0.5">{icon}</span>
                <span className="text-sm text-slate-700 leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>

          {/* 강제 주입 미리보기 */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-800 font-medium leading-relaxed">
              ❗ 생성된 초안 앞/뒤에는 아래 안내 문구가 자동으로 추가됩니다:
            </p>
            <p className="text-xs text-amber-700 mt-1 font-mono leading-relaxed">
              &ldquo;❗[주의: 이 부분은 대표님의 실제 스토어 링크와 사용 후기로 한 줄만 수정해 주세요]&rdquo;
            </p>
          </div>

          {/* 버튼 */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={() => { onConfirm(); onClose(); }}
              className="w-full h-13 bg-slate-900 text-white font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <span>⚡</span> 동의하고 완전체 생성하기
            </button>
            <button
              onClick={onClose}
              className="w-full h-11 text-slate-500 font-medium text-sm"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
