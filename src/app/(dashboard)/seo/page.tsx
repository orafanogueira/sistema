import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, TrendingUp, FileText } from "lucide-react";
import { NovoSeoProjectButton } from "@/components/seo/novo-project-button";

export const dynamic = "force-dynamic";

export default async function SeoPage() {
  const supabase = await createClient();
  const [{ data: projects }, { data: clientes }] = await Promise.all([
    supabase.from("seo_projects").select("*,cliente:clientes(nome)").order("created_at", { ascending: false }),
    supabase.from("clientes").select("id,nome").order("nome"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">SEO / Trafego Organico</h1>
          <p className="text-muted-foreground">Google Meu Negocio, Search Console, SEO semantico e blogs com IA.</p>
        </div>
        <NovoSeoProjectButton clientes={clientes || []} />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Projetos ativos</div><div className="text-2xl font-black mt-1">{projects?.length || 0}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Conteudos publicados</div><div className="text-2xl font-black mt-1 text-cyan">0</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Keywords monitoradas</div><div className="text-2xl font-black mt-1 text-green-400">0</div></CardContent></Card>
      </div>

      {!projects?.length ? (
        <Card><CardContent className="p-12 text-center">
          <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <div className="font-bold mb-1">Nenhum projeto SEO</div>
          <div className="text-sm text-muted-foreground">Crie o primeiro projeto SEO pra um cliente.</div>
        </CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {projects.map((p) => {
            const cliente = p.cliente as { nome?: string } | null;
            return (
              <Card key={p.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{cliente?.nome}</CardTitle>
                    <Badge variant="outline">{p.target_keywords?.length || 0} keywords</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="font-mono text-xs text-cyan truncate">{p.site_url}</div>
                  <div className="flex gap-2 flex-wrap">
                    {p.gmb_place_id && <Badge variant="outline" className="text-[10px]">GMB</Badge>}
                    {p.gsc_property && <Badge variant="outline" className="text-[10px]">GSC</Badge>}
                    {p.ga4_property_id && <Badge variant="outline" className="text-[10px]">GA4</Badge>}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Link href={`/seo/${p.id}`}><Button variant="outline" size="sm"><FileText className="h-3 w-3" /> Conteudos</Button></Link>
                    <Link href={`/seo/${p.id}/keywords`}><Button variant="outline" size="sm"><TrendingUp className="h-3 w-3" /> Keywords</Button></Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-cyan/30 bg-gradient-to-br from-brand-500/5 to-cyan/5">
        <CardHeader><CardTitle className="text-sm">Como funciona</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
          <div>1. Cria um projeto SEO pra cada cliente (site URL, GMB, Search Console)</div>
          <div>2. Cadastra keywords alvo + intencao + funil</div>
          <div>3. IA gera blog posts e posts de GMB otimizados por prompt</div>
          <div>4. Publica no site/GMB (manualmente ou via API quando conectada)</div>
          <div>5. Monitora posicoes via Search Console (em breve)</div>
        </CardContent>
      </Card>
    </div>
  );
}
