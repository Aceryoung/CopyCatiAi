"use client";

import { useState, useEffect, useCallback } from "react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  exiting: boolean;
}

let toastId = 0;
let addToastFn: ((message: string, type?: ToastType) => void) | null = null;

/** 전역 토스트 호출 함수 — 어디서든 showToast("메시지", "success") */
export function showToast(message: string, type: ToastType = "info") {
  addToastFn?.(message, type);
}

export default function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type, exiting: false }]);

    // 3초 뒤 exit 애니메이션 시작
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
      );
      // 0.3초 뒤 제거
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 3000);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => {
      addToastFn = null;
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  const typeStyles: Record<ToastType, string> = {
    success: "bg-green-600 text-white",
    error: "bg-red-600 text-white",
    info: "bg-slate-800 text-white",
  };

  const typeIcons: Record<ToastType, string> = {
    success: "✓",
    error: "✕",
    info: "ℹ",
  };

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${
            toast.exiting ? "animate-toast-out" : "animate-toast-in"
          } ${
            typeStyles[toast.type]
          } pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 max-w-[340px] fixed bottom-6 left-1/2`}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs shrink-0">
            {typeIcons[toast.type]}
          </span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
