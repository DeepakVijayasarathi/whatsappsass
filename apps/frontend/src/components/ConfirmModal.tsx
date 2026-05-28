"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the cancel button when modal opens (safer default for destructive actions)
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, loading]);

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        className="bg-white rounded-2xl shadow-modal w-full max-w-sm animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-4">
          <div className={`rounded-2xl p-2.5 shrink-0 ${destructive ? "bg-red-50" : "bg-amber-50"}`}>
            <AlertTriangle
              className={`w-5 h-5 ${destructive ? "text-red-500" : "text-amber-500"}`}
              aria-hidden="true"
            />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h2 id="confirm-title" className="font-bold text-gray-900 text-base leading-tight">
              {title}
            </h2>
            <p id="confirm-desc" className="text-sm text-gray-500 mt-1.5 leading-relaxed">
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="icon-btn shrink-0 -mr-1 -mt-1"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 justify-end px-6 py-4 border-t border-gray-100">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={loading}
            className="btn-secondary"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={destructive ? "btn-danger" : "btn-primary"}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" aria-hidden="true" />
                Please wait…
              </span>
            ) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
