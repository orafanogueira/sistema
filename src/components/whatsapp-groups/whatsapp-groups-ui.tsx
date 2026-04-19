"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, MessageSquare, ExternalLink, Users, Zap, LogIn } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { ModalDisparo } from "@/components/extratores/modal-disparo";

interface GrupoEncontrado {
  titulo: string;
  link: string;
  descricao?: string;
  fonte: string;
}

interface Contato {
  phone: string;
  nome?: string;
  isAdmin?: boolean;
}

interface ResultadoExtracao {
  group_id: string;
  group_name: string;
  contatos: Contato[];
  total_contatos: number;
  ja_era_participante?: boolean;
}

const CATEGORIAS = [
  "Lojas de carros",
  "Carros de leilão",
  "Multimarcas",
  "Revendedores de veículos",
  "Concessionárias",
  "Mercado automotivo",
  "Empresários",
  "Marketing digital",
  "E-commerce",
  "Clínicas estéticas",
  "Advogados",
  "Dentistas",
];

export function WhatsAppGroupsUI() {
  const [busca, setBusca] = useState({ nicho: "", cidade: "", max: 30 });
  const [loading, setLoading] = useState(false);
  const [processandoLink, setProcessandoLink] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<GrupoEncontrado[]>([]);
  const [extraidos, setExtraidos] = useState<Record<string, ResultadoExtracao>>({});
  const [modalDisparo, setModalDisparo] = useState<{ aberto: boolean; contatos: Contato[]; groupName: string }>({
    aberto: false,
    contatos: [],
    groupName: "",
  });

  const buscar = async () => {
    if (!busca.nicho.trim()) return toast.error("Informe o nicho");
    setLoading(true); setGrupos([]);
    try {
      const r = await fetch("/api/whatsapp-groups/buscar-por-nicho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(busca),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      if (data.erro) {
        toast.error("Precisa configurar Google CSE", data.erro);
        return;
      }
      setGrupos(data.grupos || []);
      toast.success(`${data.total || 0} grupos encontrados`);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  const soEntrar = async (link: string) => {
    setProcessandoLink(link);
    try {
      const r = await fetch("/api/whatsapp-groups/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_link: link }),
      });
      const data = await r.json();
      if (!r.ok || data.erro) {
        toast.error("Erro ao entrar", data.erro || "tente novamente");
        return;
      }
      const msg = data.ja_era_participante ? "Você já era membro" : "Entrou no grupo";
      toast.success(msg, data.group_name);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setProcessandoLink(null);
    }
  };

  const entrarExtrairEDisparar = async (link: string) => {
    setProcessandoLink(link);
    try {
      let data: ResultadoExtracao;
      if (extraidos[link]) {
        data = extraidos[link];
      } else {
        const r = await fetch("/api/whatsapp-groups/entrar-e-extrair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invite_link: link }),
        });
        if (!r.ok) throw new Error(await r.text());
        data = await r.json();
        setExtraidos({ ...extraidos, [link]: data });
      }

      const msg = data.ja_era_participante
        ? `Você já era membro · ${data.total_contatos} contatos`
        : `Entrou no grupo · ${data.total_contatos} contatos`;
      toast.success(msg, data.group_name);

      // abre modal de disparo já preenchido
      const contatosFormatados = data.contatos.map((c) => ({
        phone: c.phone,
        telefone: c.phone,
        nome: c.nome || c.phone,
      }));
      setModalDisparo({ aberto: true, contatos: contatosFormatados, groupName: data.group_name });
    } catch (e: unknown) {
      toast.error("Erro ao entrar/extrair", e instanceof Error ? e.message : "tente novamente");
    } finally { setProcessandoLink(null); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="h-4 w-4 text-cyan" /> Buscar grupos por nicho
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-[1fr_1fr_100px] gap-3">
            <div>
              <Label>Nicho / categoria</Label>
              <Input
                className="mt-1"
                placeholder="lojas de carros, empresários, etc"
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
            Busca feita via Google. Retorna apenas grupos com link público (chat.whatsapp.com) indexado.
          </div>
        </CardContent>
      </Card>

      {grupos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {grupos.length} grupos encontrados — 1 clique pra entrar, extrair e disparar
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
                      <div className="font-semibold text-sm">{g.titulo}</div>
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
                      <ExternalLink className="h-3 w-3" /> abrir
                    </a>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
                    {ex && (
                      <>
                        <Badge variant="success" className="text-[10px]">
                          <Users className="h-3 w-3 mr-1" /> {ex.total_contatos} contatos
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {ex.group_name}
                        </Badge>
                      </>
                    )}
                    <div className="ml-auto flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => soEntrar(g.link)}
                        disabled={isProcessing}
                      >
                        <LogIn className="h-3 w-3" /> Só entrar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => entrarExtrairEDisparar(g.link)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Processando...</>
                        ) : (
                          <><Zap className="h-3 w-3" /> {ex ? "Disparar novamente" : "Entrar + extrair + disparar"}</>
                        )}
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
        tipo="whatsapp"
        contatos={modalDisparo.contatos}
      />
    </div>
  );
}
