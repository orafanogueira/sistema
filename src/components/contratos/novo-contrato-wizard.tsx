"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Sparkles, FileText } from "lucide-react";

interface Cliente { id: string; nome: string; vertical?: string; contato_email?: string; contato_whatsapp?: string; }
interface Template { key: string; name: string; vertical: string; variables: string[]; }

export function NovoContratoWizard({ clientes, templates }: { clientes: Cliente[]; templates: Template[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cliente_id, setClienteId] = useState("");
  const [template_key, setTemplateKey] = useState<string>("");
  const [useAi, setUseAi] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [aiPrompt, setAiPrompt] = useState("");
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState("mensal");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [signatarios, setSignatarios] = useState<{ nome: string; email: string; cpf: string; telefone: string; role: string }[]>([
    { nome: "", email: "", cpf: "", telefone: "", role: "contratante" },
  ]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const clienteSel = clientes.find((c) => c.id === cliente_id);
  const templateSel = templates.find((t) => t.key === template_key);
  const variables = templateSel?.variables || [];

  const addSignatario = () => setSignatarios([...signatarios, { nome: "", email: "", cpf: "", telefone: "", role: "contratada" }]);
  const updateSignatario = (i: number, field: string, value: string) => {
    const novo = [...signatarios]; novo[i] = { ...novo[i], [field]: value }; setSignatarios(novo);
  };
  const removeSignatario = (i: number) => setSignatarios(signatarios.filter((_, idx) => idx !== i));

  const submit = async () => {
    setLoading(true); setErr(null);
    try {
      const body: Record<string, unknown> = {
        cliente_id, titulo,
        campos: { ...campos, data_inicio: dataInicio, valor_total: valor, valor_mensal: valor },
        signatarios,
        valor: Number(valor.replace(/[^\d.,]/g, "").replace(",", ".")) || null,
        forma_pagamento: forma,
        data_inicio: dataInicio,
      };
      if (useAi) {
        body.use_ai = true;
        body.ai_prompt = aiPrompt;
      } else {
        body.template_key = template_key;
      }
      const r = await fetch("/api/contratos", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      router.push(`/contratos/${data.id}`);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`flex-1 h-2 rounded-full ${step >= s ? "bg-cyan" : "bg-border"}`} />
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">1. Cliente + template</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Cliente *</Label>
              <select required className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                value={cliente_id} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">- selecione -</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.vertical ? ` (${c.vertical})` : ""}</option>)}
              </select>
            </div>

            <div>
              <Label>Modo de criacao *</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button type="button" onClick={() => setUseAi(false)}
                  className={`p-3 border rounded-lg text-left ${!useAi ? "border-cyan bg-cyan/5" : "border-border"}`}>
                  <div className="flex items-center gap-2 mb-1"><FileText className="h-4 w-4" /> Template pronto</div>
                  <div className="text-xs text-muted-foreground">Usa um modelo pre-configurado por vertical</div>
                </button>
                <button type="button" onClick={() => setUseAi(true)}
                  className={`p-3 border rounded-lg text-left ${useAi ? "border-cyan bg-cyan/5" : "border-border"}`}>
                  <div className="flex items-center gap-2 mb-1"><Sparkles className="h-4 w-4" /> Gerar com IA</div>
                  <div className="text-xs text-muted-foreground">Descreve o contrato e a IA redige</div>
                </button>
              </div>
            </div>

            {!useAi && (
              <div>
                <Label>Template *</Label>
                <select required className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                  value={template_key} onChange={(e) => setTemplateKey(e.target.value)}>
                  <option value="">- selecione -</option>
                  {templates.map((t) => <option key={t.key} value={t.key}>{t.name} ({t.vertical})</option>)}
                </select>
              </div>
            )}

            <div><Label>Titulo do contrato *</Label><Input required className="mt-1" value={titulo}
              onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Contrato de Marketing - Athos Motors - Abril 2026" /></div>

            <Button onClick={() => setStep(2)} disabled={!cliente_id || !titulo || (!useAi && !template_key)}>
              Proximo →
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">2. Dados do contrato</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {useAi ? (
              <div>
                <Label>Descreva o contrato desejado *</Label>
                <Textarea required className="mt-1" rows={6} value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ex: Contrato de prestacao de servicos de marketing digital, valor R$ 2.500/mes, prazo 12 meses, escopo: gestao de Meta Ads + Google Ads + relatorio mensal, inicio 01/05/2026..." />
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-3">
                  <div><Label>Valor (R$) *</Label><Input className="mt-1" type="text" value={valor}
                    onChange={(e) => setValor(e.target.value)} placeholder="2500.00" /></div>
                  <div><Label>Forma de pagamento</Label>
                    <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                      value={forma} onChange={(e) => setForma(e.target.value)}>
                      <option value="unico">Pagamento unico</option>
                      <option value="mensal">Mensal</option>
                      <option value="trimestral">Trimestral</option>
                      <option value="anual">Anual</option>
                    </select>
                  </div>
                </div>
                <div><Label>Data de inicio</Label><Input className="mt-1" type="date" value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)} /></div>

                {variables.length > 0 && (
                  <div>
                    <Label>Variaveis do template</Label>
                    <div className="text-[11px] text-muted-foreground mb-2">Preencha cada campo que aparecera no contrato</div>
                    <div className="grid grid-cols-2 gap-2">
                      {variables.filter((v) => !["data_inicio", "valor_mensal", "valor_total"].includes(v)).map((v) => (
                        <div key={v}>
                          <Label className="text-[11px]">{v}</Label>
                          <Input className="mt-1" value={campos[v] || ""}
                            onChange={(e) => setCampos({ ...campos, [v]: e.target.value })} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>← Voltar</Button>
              <Button onClick={() => setStep(3)}>Proximo →</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">3. Signatarios</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">Adicione quem vai assinar. Um deles e o cliente, outro normalmente e sua agencia.</div>

            {signatarios.map((s, i) => (
              <div key={i} className="p-3 border border-border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline">Signatario {i + 1}</Badge>
                  {signatarios.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeSignatario(i)}><Trash2 className="h-3 w-3" /></Button>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[11px]">Nome *</Label><Input className="mt-1" value={s.nome} onChange={(e) => updateSignatario(i, "nome", e.target.value)} /></div>
                  <div><Label className="text-[11px]">Email *</Label><Input className="mt-1" type="email" value={s.email} onChange={(e) => updateSignatario(i, "email", e.target.value)} /></div>
                  <div><Label className="text-[11px]">CPF</Label><Input className="mt-1" value={s.cpf} onChange={(e) => updateSignatario(i, "cpf", e.target.value)} /></div>
                  <div><Label className="text-[11px]">Telefone</Label><Input className="mt-1" value={s.telefone} onChange={(e) => updateSignatario(i, "telefone", e.target.value)} placeholder="+5511999999999" /></div>
                  <div className="col-span-2">
                    <Label className="text-[11px]">Papel</Label>
                    <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                      value={s.role} onChange={(e) => updateSignatario(i, "role", e.target.value)}>
                      <option value="contratante">Contratante (cliente)</option>
                      <option value="contratada">Contratada (agencia)</option>
                      <option value="testemunha">Testemunha</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addSignatario}><Plus className="h-3 w-3" /> Adicionar signatario</Button>

            {err && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-3">{err}</div>}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>← Voltar</Button>
              <Button onClick={submit} disabled={loading || !signatarios[0].nome || !signatarios[0].email}>
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando...</> : "Criar contrato"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
