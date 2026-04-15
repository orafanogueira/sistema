"use client";
/**
 * Toast system global. Usar via `toast.success()`, `toast.error()`, `toast.info()`.
 * Implementacao simples sem dependencias extras.
 */
import { useEffect, useState } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";

export interface Toast {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message?: string;
  duration?: number;
}

let listeners: ((t: Toast) => void)[] = [];

export const toast = {
  success: (title: string, message?: string) => emit("success", title, message),
  error: (title: string, message?: string) => emit("error", title, message),
  info: (title: string, message?: string) => emit("info", title, message),
};

function emit(type: Toast["type"], title: string, message?: string) {
  const t: Toast = { id: Math.random().toString(36).slice(2), type, title, message, duration: 4000 };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const l = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), t.duration || 4000);
    };
    listeners.push(l);
    return () => { listeners = listeners.filter((x) => x !== l); };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const Icon = t.type === "success" ? CheckCircle2 : t.type === "error" ? AlertCircle : Info;
        const border = t.type === "success" ? "border-green-500/30" : t.type === "error" ? "border-red-500/30" : "border-cyan/30";
        const bg = t.type === "success" ? "bg-green-500/10" : t.type === "error" ? "bg-red-500/10" : "bg-cyan/10";
        const iconColor = t.type === "success" ? "text-green-400" : t.type === "error" ? "text-red-400" : "text-cyan";
        return (
          <div key={t.id} className={`pointer-events-auto flex items-start gap-3 p-3 rounded-lg border ${border} ${bg} backdrop-blur-md shadow-2xl animate-in slide-in-from-right`}>
            <Icon className={`h-5 w-5 flex-shrink-0 ${iconColor} mt-0.5`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{t.title}</div>
              {t.message && <div className="text-xs text-muted-foreground mt-1">{t.message}</div>}
            </div>
            <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
