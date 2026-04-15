import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gerarPDFRelatorio } from "@/lib/relatorios/pdf";

/** Baixa PDF de um relatorio gerado. */
export async function GET(_: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const supabase = await createClient();
  const { data: run } = await supabase.from("relatorios_runs")
    .select("*,cliente:clientes(nome)")
    .eq("id", runId).maybeSingle();
  if (!run) return new NextResponse("run nao encontrado", { status: 404 });

  const cliente = run.cliente as { nome?: string } | null;
  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = user ? await supabase
    .from("memberships").select("tenant:tenants(name)").eq("user_id", user.id).maybeSingle() : { data: null };
  const agenciaName = (membership?.tenant as { name?: string } | null)?.name || "Grupo Nogueira";

  // O data do relatorio vem em run.content_html + content_whatsapp, mas melhor pegar direto.
  // Por simplicidade, reconstruir a partir do whatsapp_text (que ja tem analise IA).
  const pdfBytes = await gerarPDFRelatorio({
    clienteName: cliente?.nome || "Cliente",
    periodo: run.periodo_label || "",
    agenciaName,
    data: {},  // TODO: persistir data estruturada em relatorios_runs pra melhor PDF
    analise_ia: run.content_whatsapp || "",
  });

  return new Response(pdfBytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-${cliente?.nome?.replace(/\s+/g, "-")}-${run.periodo_label}.pdf"`,
    },
  });
}
