"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

/**
 * Floating Action Button do Copiloto IA.
 * Aparece em todas as paginas do dashboard. Atalho: Cmd/Ctrl+K.
 */
export function CopilotFab() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        window.location.href = "/copiloto";
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!visible) return null;

  return (
    <Link href="/copiloto">
      <button
        title="Copiloto IA (Ctrl+K)"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-brand-500 to-cyan shadow-2xl flex items-center justify-center hover:scale-105 transition-transform"
      >
        <Sparkles className="h-6 w-6 text-white" />
        <span className="sr-only">Abrir copiloto IA</span>
      </button>
    </Link>
  );
}
