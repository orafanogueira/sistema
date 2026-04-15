import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProspeccaoKanban } from "@/components/prospeccao/prospeccao-kanban";

export const dynamic = "force-dynamic";

export default async function ListaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lista } = await supabase.from("prospeccao_listas").select("*").eq("id", id).maybeSingle();
  if (!lista) return notFound();

  const { data: leads } = await supabase.from("prospeccao_leads")
    .select("*,assignee:profiles!prospeccao_leads_assigned_to_fkey(full_name)")
    .eq("lista_id", id).order("position");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/prospeccao" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">{lista.name}</h1>
            <p className="text-muted-foreground">
              {lista.segmento} · {lista.cidade}{lista.estado ? `/${lista.estado}` : ""} ·
              <Badge variant="outline" className="ml-2">{(leads || []).length} leads</Badge>
            </p>
          </div>
        </div>
      </div>

      <ProspeccaoKanban leads={leads || []} />
    </div>
  );
}
