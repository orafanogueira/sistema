"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Loader2, Sparkles, Copy, Check } from "lucide-react";
import type { AgentDef } from "@/lib/ai-agents/catalog";

interface Props {
  agent: AgentDef;
  clientes: { id: string; nome: string; segmento?: string; vertical?: string }[];
}

export function AgentRunner({ agent, clientes }: Props) {
  const [clienteId, setClienteId] = useState("");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [outputData, setOutputData] = useState<unknown>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setOutput(null); setOutputData(null); setErr(null);
    try {
      const r = await fetch("/api/ai-agents/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_key: agent.key,
          input: inputs,
          cliente_id: clienteId || null,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setOutput(data.output);
      if (data.output_data) setOutputData(data.output_data);
      setDuration(data.duration_ms);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Inputs</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            {clientes.length > 0 && (
              <div>
                <Label>Cliente (opcional - personaliza outputs)</Label>
                <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                  value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                  <option value="">- Sem cliente especifico -</option>
                  {clientes.map((c) => (<option key={c.id} value={c.id}>{c.nome} {c.vertical ? `(${c.vertical})` : ""}</option>))}
                </select>
              </div>
            )}

            {Object.entries(agent.default_input_schema).map(([k, v]) => {
              const isLong = v.type === "string" && (k.includes("conteudo") || k.includes("briefing") || k.includes("roteiro") || k.includes("descricao") || k.includes("negocio"));
              return (
                <div key={k}>
                  <Label>
                    {k} {v.required && <span className="text-red-400">*</span>}
                  </Label>
                  {v.description && <div className="text-[11px] text-muted-foreground mb-1">{v.description}</div>}
                  {isLong ? (
                    <Textarea className="mt-1" rows={3}
                      value={inputs[k] || ""} onChange={(e) => setInputs({ ...inputs, [k]: e.target.value })}
                      placeholder={v.example as string} required={v.required} />
                  ) : (
                    <Input className="mt-1"
                      value={inputs[k] || ""} onChange={(e) => setInputs({ ...inputs, [k]: e.target.value })}
                      placeholder={v.example as string} required={v.required}
                      type={v.type === "number" ? "number" : "text"} />
                  )}
                </div>
              );
            })}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</> : <><Sparkles className="h-4 w-4" /> Gerar com IA</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      {err && <Card><CardContent className="p-4 text-sm text-red-400">{err}</CardContent></Card>}

      {output && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Resultado</CardTitle>
              <div className="flex items-center gap-2">
                {duration && <span className="text-[11px] text-muted-foreground">{(duration / 1000).toFixed(1)}s</span>}
                <Button variant="ghost" size="sm" onClick={copy}>
                  {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {outputData ? (
              <pre className="text-xs bg-secondary/40 p-4 rounded-lg overflow-x-auto">{JSON.stringify(outputData, null, 2)}</pre>
            ) : (
              <div className="prose prose-invert max-w-none text-sm whitespace-pre-wrap">{output}</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
