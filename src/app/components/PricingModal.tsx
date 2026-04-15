'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

// ── IMP 전역 타입 선언 ──
declare global {
  interface Window {
    IMP?: {
      init: (merchantUid: string) => void;
      request_pay: (params: object, callback: (rsp: IMPResponse) => void) => void;
    };
  }
}

interface IMPResponse {
  success: boolean;
  imp_uid: string;
  error_msg?: string;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  credits: number;
  badge?: string;
  highlight?: boolean;
  dark?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: '🌱 새싹 셀러 팩',
    price: 4900,
    credits: 30,
  },
  {
    id: 'power',
    name: '⚡ 파워 셀러 팩',
    price: 9900,
    credits: 100,
    badge: '가장 많이 선택해요',
    highlight: true,
  },
  {
    id: 'bigpower',
    name: '🚀 빅파워 셀러 팩',
    price: 29000,
    credits: 400,
    dark: true,
  },
];

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  onSuccess?: () => void;
}

export function PricingModal({ isOpen, onClose, userEmail, onSuccess }: PricingModalProps) {
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // IMP 초기화 (SDK 로드 완료 후)
  useEffect(() => {
    if (!isOpen) return;
    const initIMP = () => {
      const impKey = process.env.NEXT_PUBLIC_IMP_KEY ?? 'imp00000000'; // 테스트 가맹점 키
      window.IMP?.init(impKey);
    };
    if (window.IMP) {
      initIMP();
    } else {
      // SDK 아직 로드 중이면 로드 완료 시 실행
      const el = document.querySelector('script[src*="iamport"]');
      el?.addEventListener('load', initIMP);
      return () => el?.removeEventListener('load', initIMP);
    }
  }, [isOpen]);

  const handlePurchase = (plan: Plan) => {
    if (purchasing) return; // 중복 결제 방지
    if (!window.IMP) {
      alert('결제 모듈 로딩 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    setPurchasing(plan.id);

    const merchantUid = `order_${plan.id}_${Date.now()}`;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

    window.IMP.request_pay(
      {
        pg: 'kakaopay',           // 카카오페이 (테스트 모드)
        pay_method: 'card',
        merchant_uid: merchantUid,
        name: `CopyCat AI - ${plan.name}`,
        amount: plan.price,
        buyer_email: userEmail ?? '',
        // [필수] 모바일 결제 앱 복귀 후 돌아올 URL
        m_redirect_url: `${siteUrl}/payment/callback`,
      },
      (rsp: IMPResponse) => {
        setPurchasing(null);
        if (rsp.success) {
          console.log('결제 성공 UID:', rsp.imp_uid);
          // TODO: 백엔드 검증 API 호출 후 크레딧 충전 (다음 스프린트)
          onSuccess?.();
          onClose();
        } else {
          console.error('결제 실패:', rsp.error_msg);
          alert(`결제 실패: ${rsp.error_msg}`);
        }
      }
    );
  };

  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex flex-col">
      {/* 배경 딤 */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={!purchasing ? onClose : undefined}
      />

      {/* 모달 본체 (전체 화면, PC에서 중앙 정렬) */}
      <div className="relative z-10 flex flex-col h-full overflow-y-auto bg-slate-50">

        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">크레딧 충전</h2>
            <p className="text-xs text-slate-500 mt-0.5">요금제를 선택하고 바로 시작하세요</p>
          </div>
          <button
            onClick={onClose}
            disabled={!!purchasing}
            className="text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-40 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 px-5 py-6">
          {/* 제목 영역 */}
          <div className="text-center mb-6">
            <p className="text-sm text-slate-600">
              크레딧 1개 = AI 카피 1세트 생성<br />
              <span className="font-medium text-slate-800">인스타 3종 + 블로그 초안</span>
            </p>
          </div>

          {/* 요금제 카드 — 모바일: 세로 / PC: 3열 */}
          <div className="flex flex-col md:flex-row gap-4 md:max-w-3xl md:mx-auto md:items-center">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex-1 rounded-2xl p-5 flex flex-col gap-4 transition-transform
                  ${plan.highlight
                    ? 'border-2 border-blue-600 shadow-xl md:scale-105 bg-white'
                    : plan.dark
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 shadow-sm'
                  }`}
              >
                {/* BEST 배지 */}
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full shadow">
                      ✨ {plan.badge}
                    </span>
                  </div>
                )}

                {/* 플랜 정보 */}
                <div className={`${plan.badge ? 'mt-2' : ''}`}>
                  <p className={`text-base font-bold ${plan.dark ? 'text-white' : 'text-slate-900'}`}>
                    {plan.name}
                  </p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className={`text-3xl font-black ${plan.highlight ? 'text-blue-600' : plan.dark ? 'text-white' : 'text-slate-900'}`}>
                      {plan.price.toLocaleString()}
                    </span>
                    <span className={`text-sm ${plan.dark ? 'text-slate-300' : 'text-slate-500'}`}>원</span>
                  </div>
                </div>

                {/* 크레딧 */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg
                  ${plan.highlight ? 'bg-blue-50' : plan.dark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <span className="text-lg">⚡</span>
                  <span className={`text-sm font-semibold ${plan.highlight ? 'text-blue-700' : plan.dark ? 'text-slate-200' : 'text-slate-700'}`}>
                    크레딧 {plan.credits}개 지급
                  </span>
                </div>

                {/* 결제 버튼 */}
                <button
                  onClick={() => handlePurchase(plan)}
                  disabled={!!purchasing}
                  className={`w-full h-12 rounded-xl font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]
                    ${plan.highlight
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : plan.dark
                      ? 'bg-white text-slate-900 hover:bg-slate-100'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                >
                  {purchasing === plan.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                      결제 진행 중...
                    </span>
                  ) : (
                    `${plan.price.toLocaleString()}원 결제하기`
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* 하단 안내 */}
          <p className="text-xs text-slate-400 text-center mt-6 leading-relaxed">
            크레딧은 구매 즉시 지급되며 유효기간이 없습니다.<br />
            결제 취소 및 환불은 고객센터로 문의해 주세요.
          </p>
        </div>
      </div>
    </div>
  );

  // portal-root에 렌더 (390px 래퍼 바깥)
  const portalRoot = document.getElementById('portal-root');
  if (!portalRoot) return null;
  return createPortal(modalContent, portalRoot);
}
