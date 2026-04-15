"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Book } from "lucide-react";

export function GerarEbookButton({ ofertaId, oferta }: { ofertaId: string; oferta: { nome: string; nicho?: string; publico_alvo?: string; promessa?: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const gerar = async () => {
    if (!confirm("Gerar ebook completo via IA? Pode levar 1-2 minutos.")) return;
    setLoading(true);
    try {
      const r = await fetch("/api/maxxima/gerar-ebook", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oferta_id: ofertaId,
          tema: oferta.nome,
          publico: oferta.publico_alvo || "publico geral",
          promessa: oferta.promessa || "transformar conhecimento em resultado",
          num_capitulos: 5,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      alert(`Ebook "${data.ebook.titulo}" gerado com sucesso! Capitulos: ${data.ebook.capitulos.length}`);
      router.refresh();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "erro"); }
    finally { setLoading(false); }
  };

  return (
    <Button onClick={gerar} disabled={loading}>
      {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando ebook...</> : <><Book className="h-4 w-4" /> Gerar ebook com IA</>}
    </Button>
  );
}
