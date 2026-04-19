"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Send, Paperclip, Trash2, Mail, MessageSquare } from "lucide-react";
import { toast } from "@/components/ui/toaster";

export type DisparoTipo = "whatsapp" | "email";

interface Midia {
  tipo: "image" | "video" | "document";
  url: string;
  caption?: string;
  fileName?: string;
}

interface Anexo {
  filename: string;
  content_url: string;
}

interface Contato {
  phone?: string;
  telefone?: string;
  email?: string;
  nome?: string;
  username?: string;
  fullName?: string;
  biography?: string;
  businessCategory?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  tipo: DisparoTipo;
  contatos: Contato[];
}

const PROMPT_EXEMPLO_WA = `Você é o Rafa Nogueira, gestor de tráfego pago do Grupo Nogueira.
Gere uma mensagem curta e pessoal de WhatsApp pra este perfil.

- Máximo 3-4 linhas
- Primeira linha direta (sem "tudo bem?")
- Use o nome/perfil da pessoa
- Termina com pergunta
- NUNCA menciona SEO/orgânico

Retorne APENAS o texto, sem aspas.`;

const PROMPT_EXEMPLO_EMAIL = `Você é o Rafa Nogueira, gestor de tráfego pago do Grupo Nogueira.
Gere email B2B curto e personalizado.

- Assunto até 60 chars, desperta curiosidade
- Corpo HTML (<p>) 5-7 linhas
- Gancho na primeira linha
- CTA leve: "Vale 15min?"

Retorne JSON: {"assunto":"...","corpo_html":"<p>...</p>"}`;

export function ModalDisparo({ open, onClose, tipo, contatos }: Props) {
  const [loading, setLoading] = useState(false);
  const [nomeCampanha, setNomeCampanha] = useState(`Disparo ${new Date().toISOString().slice(0, 10)}`);
  const [promptIA, setPromptIA] = useState(tipo === "whatsapp" ? PROMPT_EXEMPLO_WA : PROMPT_EXEMPLO_EMAIL);
  const [midias, setMidias] = useState<Midia[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [novaMidia, setNovaMidia] = useState<Midia>({ tipo: "image", url: "", caption: "" });
  const [novoAnexo, setNovoAnexo] = useState<Anexo>({ filename: "", content_url: "" });

  if (!open) return null;

  const contatosValidos = contatos.filter((c) => {
    if (tipo === "whatsapp") {
      const tel = String(c.phone || c.telefone || "").replace(/\D/g, "");
      return tel.length >= 10;
    }
    return c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email);
  });

  const disparar = async () => {
    if (contatosValidos.length === 0) {
      return toast.error(`Nenhum contato com ${tipo === "whatsapp" ? "telefone" : "email"} válido`);
    }
    if (!promptIA.trim()) return toast.error("Prompt da IA obrigatório");

    if (!confirm(`Disparar pra ${contatosValidos.length} contatos via ${tipo === "whatsapp" ? "WhatsApp" : "Email"}? A IA vai gerar copy personalizada pra cada um.`)) return;

    setLoading(true);
    try {
      const endpoint = tipo === "whatsapp" ? "/api/disparo-direto/whatsapp" : "/api/disparo-direto/email";
      const body = tipo === "whatsapp"
        ? { contatos: contatosValidos, prompt_ia: promptIA, midias, nome_campanha: nomeCampanha }
        : { contatos: contatosValidos, prompt_ia: promptIA, anexos, nome_campanha: nomeCampanha };

      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      toast.success(`${data.enviados} enviados`, `${data.erros} erros · ${data.pulados || 0} pulados (já receberam antes)`);
      onClose();
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {tipo === "whatsapp" ? <MessageSquare className="h-5 w-5 text-green-500" /> : <Mail className="h-5 w-5 text-cyan" />}
            <h2 className="font-bold">Disparo {tipo === "whatsapp" ? "WhatsApp" : "Email"} com IA</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-background/40 border border-border rounded p-3 text-xs space-y-1">
            <div>Total de contatos: <b>{contatos.length}</b></div>
            <div>
              Com {tipo === "whatsapp" ? "telefone" : "email"} válido: <b className="text-cyan">{contatosValidos.length}</b>
            </div>
            <div className="text-muted-foreground">
              {tipo === "whatsapp"
                ? "Intervalo entre envios: 5-15s (anti-bloqueio). Pula quem já recebeu mensagem antes."
                : "Intervalo: 1s. Pula quem já recebeu email antes."}
            </div>
          </div>

          <div>
            <Label>Nome da campanha</Label>
            <Input className="mt-1" value={nomeCampanha} onChange={(e) => setNomeCampanha(e.target.value)} />
          </div>

          <div>
            <Label>Prompt da IA</Label>
            <Textarea
              className="mt-1 min-h-[160px] text-xs font-mono"
              value={promptIA}
              onChange={(e) => setPromptIA(e.target.value)}
            />
            <div className="text-[10px] text-muted-foreground mt-1">
              A IA recebe nome, username, bio e categoria de cada contato pra personalizar.
            </div>
          </div>

          {tipo === "whatsapp" && (
            <div>
              <Label className="flex items-center gap-2"><Paperclip className="h-3 w-3" /> Mídias (enviadas após a mensagem)</Label>
              {midias.length > 0 && (
                <div className="space-y-2 mt-2">
                  {midias.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 bg-background/40 border border-border rounded p-2 text-xs">
                      <Badge variant="secondary">{m.tipo}</Badge>
                      <span className="flex-1 truncate">{m.url}</span>
                      <Button size="sm" variant="ghost" onClick={() => setMidias(midias.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-[100px_1fr_auto] gap-2 mt-2">
                <select
                  className="flex h-10 rounded-md border border-input bg-background/40 px-2 text-xs"
                  value={novaMidia.tipo}
                  onChange={(e) => setNovaMidia({ ...novaMidia, tipo: e.target.value as Midia["tipo"] })}
                >
                  <option value="image">Imagem</option>
                  <option value="video">Vídeo</option>
                  <option value="document">Documento</option>
                </select>
                <Input
                  placeholder="URL pública da mídia (https://...)"
                  value={novaMidia.url}
                  onChange={(e) => setNovaMidia({ ...novaMidia, url: e.target.value })}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!novaMidia.url) return toast.error("URL obrigatória");
                    setMidias([...midias, novaMidia]);
                    setNovaMidia({ tipo: "image", url: "", caption: "" });
                  }}
                >
                  + Add
                </Button>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                URL pública da mídia (Cloudinary, S3, ou link direto). Dica: suba prova social no Imgur pra pegar URL rápida.
              </div>
            </div>
          )}

          {tipo === "email" && (
            <div>
              <Label className="flex items-center gap-2"><Paperclip className="h-3 w-3" /> Anexos</Label>
              {anexos.length > 0 && (
                <div className="space-y-2 mt-2">
                  {anexos.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 bg-background/40 border border-border rounded p-2 text-xs">
                      <span className="flex-1 truncate">
                        <b>{a.filename}</b> · <span className="text-muted-foreground">{a.content_url}</span>
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => setAnexos(anexos.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-[1fr_2fr_auto] gap-2 mt-2">
                <Input
                  placeholder="nome-arquivo.pdf"
                  value={novoAnexo.filename}
                  onChange={(e) => setNovoAnexo({ ...novoAnexo, filename: e.target.value })}
                />
                <Input
                  placeholder="URL pública do arquivo"
                  value={novoAnexo.content_url}
                  onChange={(e) => setNovoAnexo({ ...novoAnexo, content_url: e.target.value })}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!novoAnexo.filename || !novoAnexo.content_url) return toast.error("Nome e URL obrigatórios");
                    setAnexos([...anexos, novoAnexo]);
                    setNovoAnexo({ filename: "", content_url: "" });
                  }}
                >
                  + Add
                </Button>
              </div>
            </div>
          )}

          <div className="sticky bottom-0 bg-card pt-3 border-t border-border flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">Cancelar</Button>
            <Button onClick={disparar} disabled={loading} className="flex-1">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><Send className="h-4 w-4" /> Disparar pra {contatosValidos.length}</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
