import { X } from "lucide-react";

import { useAppStore } from "@/state/appStore";

export default function Toasts() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-8 right-4 z-[120] flex flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" data-kind={toast.kind} role="alert">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold">{toast.title}</div>
              {toast.detail && (
                <div
                  className="mt-0.5 break-words text-[11px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {toast.detail}
                </div>
              )}
            </div>
            {toast.detail && (
              <button
                className="btn shrink-0"
                style={{ height: 20, padding: "0 6px" }}
                onClick={() =>
                  navigator.clipboard.writeText(
                    `${toast.title}\n${toast.detail ?? ""}`,
                  )
                }
                title="Copy error details"
              >
                Copy
              </button>
            )}
            <button
              className="icon-btn shrink-0"
              style={{ width: 20, height: 20 }}
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
