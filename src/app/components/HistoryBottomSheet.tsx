"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface HistoryItem {
  id: string;
  source_url: string;
  content_json: Record<string, unknown>;
  created_at: string;
}

interface HistoryBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken: string;
  onSelectItem: (item: HistoryItem) => void;
}

export default function HistoryBottomSheet({
  isOpen,
  onClose,
  accessToken,
  onSelectItem,
}: HistoryBottomSheetProps) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !accessToken) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const authedClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          }
        );

        const { data, error } = await authedClient
          .from("generations")
          .select("id, source_url, content_json, created_at")
          .order("created_at", { ascending: false })
          .limit(20);

        if (!error && data) {
          setItems(data as HistoryItem[]);
        }
      } catch (err) {
        console.error("[History] fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, accessToken]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hour = d.getHours().toString().padStart(2, "0");
    const min = d.getMinutes().toString().padStart(2, "0");
    return `${month}/${day} ${hour}:${min}`;
  };

  const extractDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url || "직접 입력";
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 overlay-fade"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white rounded-t-2xl animate-slide-up max-h-[70vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Title */}
        <div className="px-5 pb-3 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-900">📋 생성 기록</h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl skeleton-shimmer" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <span className="text-3xl">📭</span>
              <p className="text-sm text-slate-400">아직 생성 기록이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectItem(item);
                    onClose();
                  }}
                  className="w-full text-left p-3 rounded-xl border border-slate-100 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700 truncate max-w-[220px]">
                      {extractDomain(item.source_url)}
                    </p>
                    <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 truncate">
                    {item.source_url || "직접 텍스트 입력"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom safe area */}
        <div className="h-6 shrink-0" />
      </div>
    </div>
  );
}
