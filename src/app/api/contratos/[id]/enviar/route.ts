import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { clicksignEnvelopar } from "@/lib/contratos/clicksign";
import { textoParaPDFBase64 } from "@/lib/contratos/pdf";

/**
 * Envia contrato pra assinatura via Clicksign.
 * Gera PDF do body, cria envelope, adiciona signatarios e notifica.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { data: contrato } = await supabase.from("contratos")
    .select("*,signatarios:contrato_signatarios(*)").eq("id", id).maybeSingle();
  if (!contrato) return new NextResponse("nao encontrado", { status: 404 });

  const signatarios = (contrato.signatarios as { nome: string; email: string; cpf: string | null; telefone: string | null; role: string }[]) || [];
  if (!signatarios.length) return new NextResponse("adicione ao menos 1 signatario", { status: 400 });

  try {
    // 1. Gera PDF do body
    const pdf = await textoParaPDFBase64(contrato.titulo, contrato.body || "");

    // 2. Envia pra Clicksign
    const result = await clicksignEnvelopar({
      filename: `${contrato.titulo.replace(/[^a-z0-9]/gi, "_")}.pdf`,
      pdf_base64: pdf,
      deadline_days: 7,
      auths: ["email"],
      signatarios: signatarios.map((s) => ({
        email: s.email, name: s.nome, phone: s.telefone || undefined, cpf: s.cpf || undefined,
        role: s.role === "contratante" ? "contractor" : s.role === "contratada" ? "contractee" :
              s.role === "testemunha" ? "witness" : "party",
      })),
    });

    // 3. Atualiza contrato + signatarios com keys do Clicksign
    const service = createServiceClient();
    await service.from("contratos").update({
      status: "enviado_assinatura",
      clicksign_document_key: result.document_key,
      sent_for_signing_at: new Date().toISOString(),
    }).eq("id", id);

    for (const s of result.signers) {
      await service.from("contrato_signatarios")
        .update({ clicksign_signer_key: s.signer_key })
        .eq("contrato_id", id).eq("email", s.email);
    }

    await service.from("contrato_eventos").insert({
      contrato_id: id, type: "sent", actor: user.id,
      metadata: { clicksign_document_key: result.document_key },
    });

    return NextResponse.json({ ok: true, document_key: result.document_key, signers: result.signers });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "erro", { status: 500 });
  }
}
