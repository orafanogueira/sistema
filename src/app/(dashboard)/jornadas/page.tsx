import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Workflow, Sparkles, Tag } from "lucide-react";
import { CriarJornadaPadraoButton } from "@/components/jornadas/criar-padrao";

export const dynamic = "force-dynamic";

export default async function JornadasPage() {
  const supabase = await createClient();
  const { data: jornadas } = await supabase
    .from("jornadas")
    .select("*,cliente:clientes(nome),etapas:jornada_etapas(id,name,position,color,is_won,is_lost,is_sale,meta_event,google_conversion_name,keywords:jornada_keywords(pattern))")
    .order("created_at", { ascending: false });
  const { data: clientes } = await supabase.from("clientes").select("id,nome,vertical").order("nome");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Jornadas de Compra</h1>
          <p className="text-muted-foreground">Etapas do funil com palavras-chave que movem leads automaticamente.</p>
        </div>
        <CriarJornadaPadraoButton clientes={clientes || []} />
      </div>

      <Card className="border-cyan/30 bg-gradient-to-br from-brand-500/5 to-cyan/5">
        <CardContent className="p-5 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-cyan flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-bold mb-1">Como funciona</div>
            <ol className="text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Voce define etapas (ex: Primeiro contato → Qualificacao → Visita → Proposta → Venda)</li>
              <li>Em cada etapa, cadastra <b>palavras-chave</b> que o lead ou vendedor pode dizer</li>
              <li>Quando a palavra aparece no WhatsApp, o lead avanca <b>automaticamente</b></li>
              <li>Na etapa de <b>venda</b>, o sistema extrai o <b>valor da venda</b> da mensagem</li>
              <li>Cada avanco dispara <b>evento no Meta Pixel</b> (Contact, Lead, Purchase, etc)</li>
              <li>Isso alimenta a <b>IA do Meta</b> com dados reais de quem compra</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {!jornadas?.length ? (
        <Card><CardContent className="p-16 text-center">
          <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <div className="font-bold mb-1">Nenhuma jornada configurada</div>
          <div className="text-sm text-muted-foreground mb-6">Use o botao acima pra criar uma jornada padrao pro seu cliente.</div>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {jornadas.map((j) => {
            const cliente = j.cliente as { nome?: string } | null;
            const etapas = ((j.etapas as { id: string; name: string; position: number; color: string; is_won: boolean; is_lost: boolean; is_sale: boolean; meta_event?: string; google_conversion_name?: string; keywords: { pattern: string }[] }[]) || []).sort((a, b) => a.position - b.position);
            return (
              <Card key={j.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {j.is_default && <Badge>default</Badge>}
                        <CardTitle className="text-base">{j.name}</CardTitle>
                      </div>
                      <div className="text-xs text-muted-foreground">Cliente: {cliente?.nome}</div>
                    </div>
                    <Button variant="outline" size="sm">Editar</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {etapas.map((e) => (
                      <div key={e.id} className="min-w-[220px] flex-shrink-0 p-3 rounded-lg border"
                        style={{ borderColor: e.color, background: `${e.color}15` }}>
                        <div className="font-bold text-sm mb-2" style={{ color: e.color }}>
                          {e.name} {e.is_won && "🏆"} {e.is_lost && "❌"} {e.is_sale && "💰"}
                        </div>
                        <div className="space-y-1 mb-2">
                          {(e.keywords || []).slice(0, 4).map((k, i) => (
                            <div key={i} className="text-[10px] flex items-center gap-1 text-muted-foreground">
                              <Tag className="h-2.5 w-2.5" /> {k.pattern}
                            </div>
                          ))}
                          {e.keywords && e.keywords.length > 4 && (
                            <div className="text-[10px] text-muted-foreground">+{e.keywords.length - 4} mais</div>
                          )}
                        </div>
                        {e.meta_event && <Badge variant="outline" className="text-[9px] mr-1">Meta: {e.meta_event}</Badge>}
                        {e.google_conversion_name && <Badge variant="outline" className="text-[9px]">Google ✓</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
