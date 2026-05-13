import React, { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { ClassifySection } from './ClassifySection';

const ClipboardIcon = () => <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
const SparklesIcon = () => <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>;

interface Props {
  status: string;
  setStatus: (status: string) => void;
  setResult: (result: any) => void;
  setShowDeepLink: (link: string | null) => void;
  credits: number | null;
  setShowPricingModal: (show: boolean) => void;
  addToast: (msg: string, type?: string) => void;
  inputMode: string;
  setInputMode: (mode: string) => void;
  url: string;
  setUrl: (url: string) => void;
  manualText: string;
  setManualText: (text: string) => void;
  base64Image: string | null;
  setBase64Image: (img: string | null) => void;
  imagePreviewUrl: string | null;
  setImagePreviewUrl: (url: string | null) => void;
}

export const InputSection = React.memo(function InputSection({
  status, setStatus, setResult, setShowDeepLink, credits, setShowPricingModal, addToast,
  inputMode, setInputMode, url, setUrl, manualText, setManualText, base64Image, setBase64Image, imagePreviewUrl, setImagePreviewUrl
}: Props) {

  const [classifyText, setClassifyText] = useState('');
  const [classifyStatus, setClassifyStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [classifyResult, setClassifyResult] = useState<any>(null);

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        let targetFile: File | Blob = file;

        if (img.height >= img.width * 3) {
          const canvas = document.createElement('canvas');
          const cropHeight = Math.min(img.height, 3000);
          canvas.width = img.width;
          canvas.height = cropHeight;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            addToast("브라우저에서 이미지를 자를 수 없습니다.", "error");
            return;
          }
          
          ctx.drawImage(img, 0, 0, img.width, cropHeight, 0, 0, img.width, cropHeight);
          
          try {
            targetFile = await new Promise<Blob>((resolve, reject) => {
              canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Canvas to Blob failed"));
              }, file.type || 'image/jpeg');
            });
          } catch (err) {
            console.error('Canvas crop error:', err);
            addToast("이미지 자르기에 실패했습니다.", "error");
            return;
          }
        }

        try {
          const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1000,
            useWebWorker: true,
            fileType: file.type || 'image/jpeg'
          };

          const compressedFile = await imageCompression(targetFile as File, options);
          const dataUrl = await imageCompression.getDataUrlFromFile(compressedFile);

          if (dataUrl.length > 4.5 * 1024 * 1024) {
            return addToast("압축 후에도 이미지 용량이 너무 큽니다.", "error");
          }

          setBase64Image(dataUrl);
          setImagePreviewUrl(URL.createObjectURL(compressedFile));
        } catch (error) {
          console.error('Image compression error:', error);
          addToast("이미지 압축에 실패했습니다.", "error");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

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

  const handleGenerate = async () => {
    if (inputMode === 'url' && !url.trim()) return addToast("상품 URL을 입력해 주세요.", "error");
    if (inputMode === 'text' && manualText.trim().length < 10) return addToast("상품 설명 텍스트를 10자 이상 입력해 주세요.", "error");
    if (inputMode === 'image' && !base64Image) return addToast("이미지를 첨부해 주세요.", "error");
    if (inputMode === 'image' && credits !== null && credits < 2) {
      addToast("이미지 분석에는 2 크레딧이 필요합니다. 충전 후 이용해주세요.", "error");
      return setShowPricingModal(true);
    }

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
            ? { manual_text: manualText, userReview: '', source_type: 'text' }
            : inputMode === 'image'
            ? { image_data: base64Image, source_url: null, source_type: 'image', userReview: '' }
            : { source_url: url, userReview: '', source_type: 'url' }
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        const errCode = data?.error ?? "INTERNAL_ERROR";

        if (errCode.includes("INSUFFICIENT_CREDITS")) {
          addToast("크레딧이 부족합니다. 충전 후 다시 시도해 주세요.", "error");
          setShowPricingModal(true);
        } else if (errCode.includes("REGEN_LIMIT_REACHED")) {
          addToast("오늘 해당 URL의 재생성 한도(3회)에 도달했습니다.", "error");
        } else if (errCode.includes("OPENAI_QUOTA_EXCEEDED")) {
          addToast("AI 서비스가 일시적으로 불가합니다. 잠시 후 다시 시도해 주세요.", "error");
        } else if (errCode.includes("NETWORK_ERROR")) {
          addToast("네트워크 연결이 불안정합니다. Wi-Fi 확인 후 다시 시도해 주세요.", "error");
        } else if (errCode.includes("CRAWL_FAILED") || errCode.includes("보안이 강력한") || errCode.includes("MISSING_CONTENT")) {
          setInputMode('text');
          const userMsg = errCode.replace("CRAWL_FAILED: ", "");
          addToast(userMsg, "error");
        } else {
          addToast("콘텐츠 생성 중 오류가 발생했습니다.", "error");
        }
        setStatus('idle');
        return;
      }

      setResult(data.result);
      setStatus('success');
      addToast("카피 생성이 완료되었습니다!", "success");
    } catch {
      addToast("네트워크 오류가 발생했습니다.", "error");
      setStatus('idle');
    }
  };

  return (
    <>
      <section className="flex flex-col gap-3">
        <div className="flex p-1 bg-slate-100 rounded-lg h-12">
          <button onClick={() => setInputMode('url')} className={`flex-1 rounded-md text-xs font-medium transition-all ${inputMode === 'url' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            링크로 입력
          </button>
          <button onClick={() => setInputMode('image')} className={`flex-1 rounded-md text-xs font-medium transition-all ${inputMode === 'image' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            이미지 첨부
          </button>
          <button onClick={() => setInputMode('text')} className={`flex-1 rounded-md text-xs font-medium transition-all ${inputMode === 'text' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            텍스트 입력
          </button>
          <button onClick={() => setInputMode('classify')} className={`flex-1 rounded-md text-xs font-medium transition-all ${inputMode === 'classify' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
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
              💡 스마트스토어, 쿠팡 등은 <button type="button" onClick={() => setInputMode('text')} className="text-blue-500 font-medium underline underline-offset-2">[텍스트 직접 입력]</button>을 권장합니다.
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

        {inputMode === 'image' && (
          <div className="flex flex-col gap-2 animate-in fade-in duration-200">
            <label className="w-full h-32 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-md bg-white hover:bg-slate-50 cursor-pointer transition-colors relative overflow-hidden">
              {imagePreviewUrl ? (
                <img src={imagePreviewUrl} alt="Preview" className="absolute inset-0 w-full h-full object-contain opacity-80" />
              ) : (
                <>
                  <span className="text-2xl">📸</span>
                  <span className="text-sm font-medium text-slate-500">상세페이지 캡처 업로드</span>
                </>
              )}
              <input type="file" accept="image/jpeg, image/png, image/webp, image/heic" className="hidden" onChange={handleImageUpload} disabled={status === 'loading'} />
            </label>
            <p className="text-xs text-slate-400 leading-relaxed px-1">
              텍스트가 없는 상세페이지인가요? 핵심 이미지 1장을 올려주세요. <br/>
              <span className="font-semibold text-blue-500">비전 AI 분석: 2 크레딧 차감</span><br/>
              <span className="font-medium text-red-500 mt-1 block">🚨 너무 긴 통짜 이미지는 글자가 작아져 AI가 읽지 못할 수 있습니다. 핵심 내용만 캡처해서 올리면 블로그 글의 퀄리티가 200% 상승합니다!</span>
            </p>
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
              <><SparklesIcon /> SEO 최적화 블로그 초안 생성 ⚡</>
            )}
          </button>
        )}
      </section>

      {/* 초안 분류 섹션 */}
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

          {classifyStatus === 'success' && classifyResult && (
            <div className="mt-2">
              <ClassifySection result={classifyResult} onToast={addToast} />
            </div>
          )}
        </section>
      )}
    </>
  );
});
