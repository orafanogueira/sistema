"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Cliente { id: string; nome: string; slug: string; vertical: string; servicos: string[] }

const STORAGE_KEY = "social-cliente-ativo";

export function ClientSwitcher({ clientes }: { clientes: Cliente[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramCliente = searchParams.get("cliente");

  const [selected, setSelected] = useState(() => {
    if (paramCliente) return paramCliente;
    if (typeof window !== "undefined") return localStorage.getItem(STORAGE_KEY) || "";
    return "";
  });

  useEffect(() => {
    if (selected) {
      localStorage.setItem(STORAGE_KEY, selected);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [selected]);

  const handleChange = (clienteId: string) => {
    setSelected(clienteId);
    const params = new URLSearchParams(searchParams.toString());
    if (clienteId) params.set("cliente", clienteId);
    else params.delete("cliente");
    router.push(`?${params.toString()}`);
  };

  const clienteAtual = clientes.find((c) => c.id === selected);

  return (
    <div className="flex items-center gap-3">
      <select
        className="flex h-10 rounded-md border border-input bg-background/40 px-3 text-sm min-w-[220px]"
        value={selected}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">Todos os clientes</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome} {c.servicos?.includes("trafego") && c.servicos?.includes("social_media") ? "📊📱" : c.servicos?.includes("social_media") ? "📱" : "📊"}
          </option>
        ))}
      </select>
      {clienteAtual && (
        <span className="text-xs text-muted-foreground">
          {clienteAtual.vertical} · {(clienteAtual.servicos || []).join(", ")}
        </span>
      )}
    </div>
  );
}

export function useClienteAtivo(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY) || null;
}
