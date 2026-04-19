"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, MessageSquare, Mail, ExternalLink, Users, Zap, Facebook } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { ModalDisparo } from "@/components/extratores/modal-disparo";

interface GrupoFB {
  titulo: string;
  link: string;
  descricao?: string;
  fonte: string;
  id?: string;
}

interface ContatoFB {
  phone?: string;
  telefone?: string;
  email?: string;
  nome?: string;
  biography?: string;
}

interface ResultadoExtracao {
  total: number;
  contatos: ContatoFB[];
  with_email?: number;
  with_phone?: number;
  active_posters?: number;
}

const CATEGORIAS = [
  "Lojas de carros",
  "Revendedores veículos",
  "Empresários",
  "Marketing digital",
  "Empreendedores",
  "Vendedores",
  "E-commerce",
  "Clínicas estéticas",
  "Advogados",
  "Dentistas",
  "Corretores imóveis",
  "Multimarcas",
];

export function FacebookGroupsUI() {
  const [busca, setBusca] = useState({ nicho: "", cidade: "", max: 30 });
  const [loading, setLoading] = useState(false);
  const [processandoLink, setProcessandoLink] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<GrupoFB[]>([]);
  const [extraidos, setExtraidos] = useState<Record<string, ResultadoExtracao>>({});
  const [modalDisparo, setModalDisparo] = useState<{
    aberto: boolean;
    tipo: "whatsapp" | "email";
    contatos: ContatoFB[];
  }>({
    aberto: false,
    tipo: "whatsapp",
    contatos: [],
  });

  const buscar = async () => {
    if (!busca.nicho.trim()) return toast.error("Informe o nicho");
    setLoading(true); setGrupos([]);
    try {
      const r = await fetch("/api/facebook-groups/buscar-por-nicho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(busca),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      if (data.erro) {
        toast.error("Erro", data.erro);
        return;
      }
      setGrupos(data.grupos || []);
      toast.success(`${data.total || 0} grupos encontrados`);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  const extrairEDisparar = async (link: string, tipo: "whatsapp" | "email") => {
    setProcessandoLink(link);
    try {
      let data: ResultadoExtracao;
      if (extraidos[link]) {
        data = extraidos[link];
      } else {
        const r = await fetch("/api/facebook-groups/extrair-contatos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ group_url: link, max: 200 }),
        });
        if (!r.ok) throw new Error(await r.text());
        data = await r.json();
        setExtraidos({ ...extraidos, [link]: data });
      }

      toast.success(
        `${data.total} contatos extraídos`,
        `${data.with_email || 0} com email · ${data.with_phone || 0} com telefone`
      );

      // abre modal de disparo já preenchido
      setModalDisparo({ aberto: true, tipo, contatos: data.contatos });
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setProcessandoLink(null); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="h-4 w-4 text-blue-500" /> Buscar grupos do Facebook por nicho
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-[1fr_1fr_100px] gap-3">
            <div>
              <Label>Nicho / categoria</Label>
              <Input
                className="mt-1"
                placeholder="lojas de carros, empresários..."
                value={busca.nicho}
                onChange={(e) => setBusca({ ...busca, nicho: e.target.value })}
              />
            </div>
            <div>
              <Label>Cidade (opcional)</Label>
              <Input
                className="mt-1"
                placeholder="São Paulo, Curitiba..."
                value={busca.cidade}
                onChange={(e) => setBusca({ ...busca, cidade: e.target.value })}
              />
            </div>
            <div>
              <Label>Máx</Label>
              <Input
                type="number"
                className="mt-1"
                min={10}
                max={100}
                value={busca.max}
                onChange={(e) => setBusca({ ...busca, max: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {CATEGORIAS.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant="outline"
                className="text-[10px] h-7"
                onClick={() => setBusca({ ...busca, nicho: cat })}
              >
                {cat}
              </Button>
            ))}
          </div>

          <Button onClick={buscar} disabled={loading} className="w-full">
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Buscando...</>
            ) : (
              <><Search className="h-4 w-4" /> Buscar grupos</>
            )}
          </Button>
          <div className="text-[10px] text-muted-foreground">
            Busca via Google. Retorna grupos públicos indexados do FB (facebook.com/groups).
            Entre no grupo pelo seu FB, depois clique &quot;Extrair&quot; pra puxar autores ativos + contatos dos posts.
          </div>
        </CardContent>
      </Card>

      {grupos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {grupos.length} grupos encontrados — entre no FB e extraia em 1 clique
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {grupos.map((g) => {
              const ex = extraidos[g.link];
              const isProcessing = processandoLink === g.link;

              return (
                <div key={g.link} className="border border-border rounded-lg p-3 space-y-2 bg-background/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm flex items-center gap-2">
                        <Facebook className="h-3 w-3 text-blue-500" /> {g.titulo}
                      </div>
                      {g.descricao && (
                        <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                          {g.descricao}
                        </div>
                      )}
                    </div>
                    <a
                      href={g.link}
                      target="_blank"
                      rel="noopener"
                      className="text-cyan text-[10px] flex items-center gap-1 hover:underline shrink-0"
                    >
                      <ExternalLink className="h-3 w-3" /> abrir no FB
                    </a>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
                    {ex && (
                      <>
                        <Badge variant="success" className="text-[10px]">
                          <Users className="h-3 w-3 mr-1" /> {ex.total} contatos
                        </Badge>
                        {ex.with_email ? (
                          <Badge variant="secondary" className="text-[10px]">📧 {ex.with_email}</Badge>
                        ) : null}
                        {ex.with_phone ? (
                          <Badge variant="secondary" className="text-[10px]">📱 {ex.with_phone}</Badge>
                        ) : null}
                      </>
                    )}
                    <div className="ml-auto flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => extrairEDisparar(g.link, "whatsapp")}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Extraindo...</>
                        ) : (
                          <><MessageSquare className="h-3 w-3" /> {ex ? "Disparar" : "Extrair + Disparar"} WhatsApp</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => extrairEDisparar(g.link, "email")}
                        disabled={isProcessing}
                      >
                        <Mail className="h-3 w-3" /> {ex ? "Disparar" : "Extrair + Disparar"} Email
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <ModalDisparo
        open={modalDisparo.aberto}
        onClose={() => setModalDisparo({ ...modalDisparo, aberto: false })}
        tipo={modalDisparo.tipo}
        contatos={modalDisparo.contatos}
      />
    </div>
  );
}
