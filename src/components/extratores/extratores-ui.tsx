"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Instagram, Facebook, Download, Search, Users, Linkedin } from "lucide-react";
import { toast } from "@/components/ui/toaster";

type Tab = "instagram" | "facebook" | "apollo";

export function ExtratoresUI() {
  const [tab, setTab] = useState<Tab>("instagram");
  const [loading, setLoading] = useState(false);

  // Instagram
  const [igForm, setIgForm] = useState({
    username: "",
    max: 200,
    tipo: "seguidores",
    enrich: false,
    onlyWithContact: false,
  });
  const [igResult, setIgResult] = useState<{
    profiles?: Array<Record<string, unknown>>;
    followers?: Array<Record<string, unknown>>;
    total?: number;
    with_email?: number;
    with_phone?: number;
    enriched?: boolean;
  } | null>(null);

  // Apollo LinkedIn
  const [apolloForm, setApolloForm] = useState({ job_titles: "", location: "Brazil", company_name: "", per_page: 25 });
  const [apolloResult, setApolloResult] = useState<{ contacts?: Array<Record<string, unknown>>; total?: number } | null>(null);

  const buscarApollo = async () => {
    if (!apolloForm.job_titles && !apolloForm.company_name) return toast.error("Informe cargo ou empresa");
    setLoading(true); setApolloResult(null);
    try {
      const r = await fetch("/api/extratores/apollo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "pessoas",
          job_titles: apolloForm.job_titles,
          location: apolloForm.location,
          company_name: apolloForm.company_name,
          per_page: apolloForm.per_page,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setApolloResult(data);
      toast.success(`${data.contacts?.length || 0} contatos encontrados (${data.total} total)`);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  // Facebook
  const [fbForm, setFbForm] = useState({ group_url: "", max: 200 });
  const [fbResult, setFbResult] = useState<{ members?: Array<Record<string, unknown>>; total?: number } | null>(null);

  const extrairIG = async () => {
    if (!igForm.username.trim()) return toast.error("Informe o @ do perfil");
    setLoading(true); setIgResult(null);
    try {
      const r = await fetch("/api/extratores/instagram", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: igForm.username,
          max_followers: igForm.max,
          tipo: igForm.tipo === "perfil" ? "perfil" : "seguidores",
          enrich: igForm.tipo === "seguidores" ? igForm.enrich : false,
          only_with_contact: igForm.tipo === "seguidores" ? igForm.onlyWithContact : false,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setIgResult(data);
      const detalhes = data.enriched
        ? ` · ${data.with_email || 0} com email · ${data.with_phone || 0} com telefone`
        : "";
      toast.success(`${data.total || 0} resultados extraídos${detalhes}`);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  const extrairFB = async () => {
    if (!fbForm.group_url.trim()) return toast.error("Informe a URL do grupo");
    setLoading(true); setFbResult(null);
    try {
      const r = await fetch("/api/extratores/facebook", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_url: fbForm.group_url, max_members: fbForm.max }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setFbResult(data);
      toast.success(`${data.total || 0} membros extraídos`);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  const downloadCSV = (data: Array<Record<string, unknown>>, filename: string) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(","),
      ...data.map((row) => headers.map((h) => `"${String(row[h] || "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={tab === "instagram" ? "default" : "outline"} onClick={() => setTab("instagram")}>
          <Instagram className="h-4 w-4" /> Instagram
        </Button>
        <Button variant={tab === "facebook" ? "default" : "outline"} onClick={() => setTab("facebook")}>
          <Facebook className="h-4 w-4" /> Facebook Groups
        </Button>
        <Button variant={tab === "apollo" ? "default" : "outline"} onClick={() => setTab("apollo")}>
          <Linkedin className="h-4 w-4" /> Apollo LinkedIn
        </Button>
      </div>

      {tab === "instagram" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Instagram className="h-4 w-4 text-pink-500" /> Extrator Instagram</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>@ do perfil</Label>
                  <Input className="mt-1" placeholder="@loja_exemplo ou loja_exemplo"
                    value={igForm.username} onChange={(e) => setIgForm({ ...igForm, username: e.target.value })} />
                </div>
                <div>
                  <Label>Máx resultados</Label>
                  <Input type="number" className="mt-1" min={10} max={5000} value={igForm.max}
                    onChange={(e) => setIgForm({ ...igForm, max: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>O que extrair</Label>
                <div className="flex gap-2 mt-1">
                  <Button size="sm" variant={igForm.tipo === "perfil" ? "default" : "outline"}
                    onClick={() => setIgForm({ ...igForm, tipo: "perfil" })}>
                    <Users className="h-3 w-3" /> Dados do perfil
                  </Button>
                  <Button size="sm" variant={igForm.tipo === "seguidores" ? "default" : "outline"}
                    onClick={() => setIgForm({ ...igForm, tipo: "seguidores" })}>
                    <Search className="h-3 w-3" /> Lista de seguidores
                  </Button>
                </div>
              </div>
              {igForm.tipo === "seguidores" && (
                <div className="space-y-2 border border-border rounded p-3 bg-background/40">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={igForm.enrich}
                      onChange={(e) => setIgForm({ ...igForm, enrich: e.target.checked })} />
                    <span>📧 Buscar email e telefone de cada seguidor</span>
                  </label>
                  {igForm.enrich && (
                    <>
                      <label className="flex items-center gap-2 text-xs cursor-pointer ml-5">
                        <input type="checkbox" checked={igForm.onlyWithContact}
                          onChange={(e) => setIgForm({ ...igForm, onlyWithContact: e.target.checked })} />
                        <span>Retornar apenas seguidores com contato (email ou telefone)</span>
                      </label>
                      <div className="text-[10px] text-muted-foreground ml-5">
                        ⚠️ Email/telefone só aparecem em perfis Business/Creator (cerca de 5-15% dos seguidores).
                        Enriquecimento demora +1min a cada 100 seguidores e custa ~$0.50/100.
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className="text-[10px] text-muted-foreground">
                Perfil: nome, bio, email, website, seguidores, posts. Seguidores: lista com username + nome de cada.
                ~$1-2 por 1000 seguidores extraídos.
              </div>
              <Button onClick={extrairIG} disabled={loading} className="w-full">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Extraindo (pode levar 1-5min)...</> : <><Search className="h-4 w-4" /> Extrair</>}
              </Button>
            </CardContent>
          </Card>

          {igResult && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{igResult.total || 0} resultados</CardTitle>
                  <Button size="sm" variant="outline" onClick={() =>
                    downloadCSV((igResult.profiles || igResult.followers || []) as Array<Record<string, unknown>>, `instagram-${igForm.username}`)}>
                    <Download className="h-3 w-3" /> CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {igResult.profiles && igResult.profiles.length > 0 && (
                  <div className="space-y-2">
                    {igResult.profiles.map((p, i) => (
                      <div key={i} className="border border-border rounded p-3 text-sm">
                        <div className="font-bold">{String(p.fullName || p.username || "")}</div>
                        <div className="text-xs text-muted-foreground mt-1">{String(p.biography || "").slice(0, 100)}</div>
                        <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
                          <Badge variant="secondary">{String(p.followersCount || 0)} seguidores</Badge>
                          <Badge variant="secondary">{String(p.postsCount || 0)} posts</Badge>
                          {p.email ? <Badge variant="success">📧 {String(p.email)}</Badge> : null}
                          {p.website ? <Badge variant="outline">🌐 {String(p.website)}</Badge> : null}
                          {p.phone ? <Badge variant="outline">📱 {String(p.phone)}</Badge> : null}
                          {p.isBusinessAccount ? <Badge>Business</Badge> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {igResult.followers && igResult.followers.length > 0 && (
                  <div className="max-h-[400px] overflow-y-auto">
                    {igResult.enriched && (
                      <div className="flex gap-2 mb-2 text-[11px]">
                        <Badge variant="success">📧 {igResult.with_email || 0} com email</Badge>
                        <Badge variant="secondary">📱 {igResult.with_phone || 0} com telefone</Badge>
                      </div>
                    )}
                    <table className="w-full text-xs">
                      <thead className="border-b text-[10px] uppercase text-muted-foreground sticky top-0 bg-card">
                        <tr>
                          <th className="p-2 text-left">#</th>
                          <th className="p-2 text-left">Username</th>
                          <th className="p-2 text-left">Nome</th>
                          {igResult.enriched && (
                            <>
                              <th className="p-2 text-left">Email</th>
                              <th className="p-2 text-left">Telefone</th>
                              <th className="p-2 text-left">Website</th>
                              <th className="p-2 text-left">Tipo</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {(igResult.followers as Array<Record<string, unknown>>).slice(0, 200).map((f, i) => (
                          <tr key={i} className="border-b border-border">
                            <td className="p-2 text-muted-foreground">{i + 1}</td>
                            <td className="p-2 font-mono">@{String(f.username || "")}</td>
                            <td className="p-2">{String(f.fullName || f.full_name || "")}</td>
                            {igResult.enriched && (
                              <>
                                <td className="p-2 text-[10px]">{f.email ? <span className="text-green-400">{String(f.email)}</span> : <span className="text-muted-foreground">—</span>}</td>
                                <td className="p-2 text-[10px]">{f.phone ? <span className="text-cyan">{String(f.phone)}</span> : <span className="text-muted-foreground">—</span>}</td>
                                <td className="p-2 text-[10px]">{f.website ? <a href={String(f.website)} target="_blank" rel="noopener" className="text-cyan hover:underline">link</a> : <span className="text-muted-foreground">—</span>}</td>
                                <td className="p-2">{f.isBusinessAccount ? <Badge variant="secondary" className="text-[9px]">Business</Badge> : null}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(igResult.followers as Array<Record<string, unknown>>).length > 200 && (
                      <div className="text-xs text-muted-foreground p-2 text-center">
                        Mostrando 200 de {igResult.total}. Baixe CSV pra ver todos.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "facebook" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Facebook className="h-4 w-4 text-blue-500" /> Extrator Facebook Groups</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>URL do grupo</Label>
                  <Input className="mt-1" placeholder="https://www.facebook.com/groups/nome-do-grupo"
                    value={fbForm.group_url} onChange={(e) => setFbForm({ ...fbForm, group_url: e.target.value })} />
                </div>
                <div>
                  <Label>Máx membros</Label>
                  <Input type="number" className="mt-1" min={10} max={5000} value={fbForm.max}
                    onChange={(e) => setFbForm({ ...fbForm, max: Number(e.target.value) })} />
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Extrai nomes e perfis dos membros do grupo. ~$1-2 por 1000 membros.
              </div>
              <Button onClick={extrairFB} disabled={loading} className="w-full">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Extraindo...</> : <><Search className="h-4 w-4" /> Extrair membros</>}
              </Button>
            </CardContent>
          </Card>

          {fbResult && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{fbResult.total || 0} membros</CardTitle>
                  <Button size="sm" variant="outline" onClick={() =>
                    downloadCSV((fbResult.members || []) as Array<Record<string, unknown>>, "facebook-group-members")}>
                    <Download className="h-3 w-3" /> CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b text-[10px] uppercase text-muted-foreground sticky top-0 bg-card">
                      <tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Nome</th><th className="p-2 text-left">Perfil</th></tr>
                    </thead>
                    <tbody>
                      {((fbResult.members || []) as Array<Record<string, unknown>>).slice(0, 200).map((m, i) => (
                        <tr key={i} className="border-b border-border">
                          <td className="p-2 text-muted-foreground">{i + 1}</td>
                          <td className="p-2 font-semibold">{String(m.name || "")}</td>
                          <td className="p-2">
                            {m.profileUrl ? <a href={String(m.profileUrl)} target="_blank" rel="noopener" className="text-cyan text-[10px] hover:underline">Ver perfil</a> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
