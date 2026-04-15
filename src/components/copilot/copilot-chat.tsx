"use client";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, Wrench } from "lucide-react";

interface Msg {
  id?: string;
  role: "user" | "assistant";
  content: string;
  tool_calls?: { name: string; input: unknown; result: unknown }[];
}

const SUGESTOES = [
  "Quantos leads tivemos nos ultimos 7 dias?",
  "Analise as campanhas do Athos Motors",
  "Qual e o MRR atual?",
  "Lista meus clientes automotivos",
  "Tem algum alerta critico agora?",
  "Gera link publico do dashboard pra Dignissima",
  "Sugira otimizacoes nas campanhas de Sicredi",
];

export function CopilotChat() {
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setLoading(true);

    try {
      const res = await fetch("/api/copilot/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: convId, message }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setConvId(data.conversation_id);
      setMessages((m) => [...m, { role: "assistant", content: data.reply, tool_calls: data.tool_calls }]);
    } catch (e: unknown) {
      setMessages((m) => [...m, { role: "assistant", content: `Erro: ${e instanceof Error ? e.message : "?"}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-500 to-cyan flex items-center justify-center mb-4">
                <Sparkles className="h-7 w-7" />
              </div>
              <div className="text-xl font-black mb-1">Como posso ajudar?</div>
              <div className="text-sm text-muted-foreground mb-6 max-w-md">Faz perguntas sobre teus clientes, campanhas, financas. O copiloto consulta o sistema em tempo real.</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl">
                {SUGESTOES.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="text-left p-3 border border-border rounded-lg hover:border-cyan/40 text-sm">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-lg p-3 ${m.role === "user" ? "bg-cyan/20 border border-cyan/30" : "bg-secondary"}`}>
                  <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                  {m.tool_calls?.length ? (
                    <div className="mt-3 space-y-1">
                      {m.tool_calls.map((tc, j) => (
                        <Badge key={j} variant="outline" className="text-[10px] mr-1">
                          <Wrench className="h-2.5 w-2.5 mr-1" /> {tc.name}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
              <div className="bg-secondary rounded-lg p-3 text-sm text-muted-foreground">Pensando...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border p-4">
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunta pro copiloto..." disabled={loading} />
            <Button type="submit" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
