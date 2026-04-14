"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";

export function ImportClientesButton({ totalAtual }: { totalAtual: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (totalAtual >= 30) return null; // ja importou

  const importar = async () => {
    setLoading(true); setResult(null);
    const res = await fetch("/api/import/clientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json();
    setLoading(false);
    setResult(`${data.total} processados, ${data.results.filter((r: { status: string }) => r.status === "created").length} criados`);
    setTimeout(() => router.refresh(), 1500);
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-cyan/10 border border-cyan/30">
      <Download className="h-4 w-4 text-cyan flex-shrink-0" />
      <div className="flex-1">
        <div className="font-semibold text-sm">Importar 30+ clientes existentes em 1 clique</div>
        <div className="text-xs text-muted-foreground">Inclui marcacao automotivo + integracoes Meta Ads ja preenchidas</div>
        {result && <div className="text-xs text-cyan mt-1">{result}</div>}
      </div>
      <Button size="sm" onClick={importar} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Importar"}
      </Button>
    </div>
  );
}
