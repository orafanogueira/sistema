"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, MessageSquare, Loader2 } from "lucide-react";

export function AprovacaoClient({ token, data }: { token: string; data: { post: { id: string; title?: string; copy?: string; briefing?: string; format: string; pillar: string; status: string; hashtags?: string[]; hook?: string; cta?: string; carrossel_slides?: { titulo: string; texto: string }[]; cliente: { nome: string } | null }; revisoes: { id: string; author: string; type: string; content: string | null; created_at: string }[] } }) {
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState<"approve" | "reject" | null>(null);

  const act = async (action: "approve" | "reject" | "comment") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/aprovacao-post/${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, content: comment || null }),
      });
      if (res.ok && (action === "approve" || action === "reject")) setDone(action);
      setComment("");
    } finally { setLoading(false); }
  };

  const { post } = data;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-black">Aprovacao de conteudo</h1>
          <p className="text-muted-foreground text-sm">{post.cliente?.nome}</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{post.title || "Post"}</CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline">{post.format}</Badge>
                <Badge variant="outline">{post.pillar}</Badge>
                <Badge variant={post.status === "aprovado" ? "success" : post.status === "rejeitado" ? "destructive" : "warning"}>
                  {post.status}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {post.hook && <div><div className="text-xs uppercase text-muted-foreground mb-1">Gancho</div><div className="text-lg font-bold">{post.hook}</div></div>}
            {post.copy && <div><div className="text-xs uppercase text-muted-foreground mb-1">Legenda</div><div className="whitespace-pre-wrap text-sm">{post.copy}</div></div>}
            {post.cta && <div><div className="text-xs uppercase text-muted-foreground mb-1">CTA</div><div className="text-sm">{post.cta}</div></div>}
            {post.hashtags && post.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">{post.hashtags.map((h) => <Badge key={h} variant="outline" className="text-[10px]">#{h}</Badge>)}</div>
            )}
            {post.carrossel_slides && post.carrossel_slides.length > 0 && (
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Slides do carrossel</div>
                <div className="space-y-2">
                  {post.carrossel_slides.map((s, i) => (
                    <div key={i} className="p-3 bg-secondary rounded text-sm">
                      <div className="font-bold">{i + 1}. {s.titulo}</div>
                      <div className="text-muted-foreground">{s.texto}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {done ? (
          <Card className={done === "approve" ? "border-green-500/40 bg-green-500/5" : "border-red-500/40 bg-red-500/5"}>
            <CardContent className="p-8 text-center">
              {done === "approve" ? (
                <>
                  <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
                  <div className="text-xl font-bold">Aprovado!</div>
                  <div className="text-sm text-muted-foreground">Obrigado. A equipe ja foi notificada.</div>
                </>
              ) : (
                <>
                  <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                  <div className="text-xl font-bold">Rejeitado</div>
                  <div className="text-sm text-muted-foreground">A equipe vai revisar.</div>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle className="text-sm">Feedback</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder="Deixe um comentario (opcional pra aprovar, obrigatorio pra rejeitar)" rows={3} />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => act("approve")} disabled={loading}>
                  <CheckCircle2 className="h-4 w-4" /> Aprovar
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => act("reject")} disabled={loading || !comment}>
                  <XCircle className="h-4 w-4" /> Rejeitar
                </Button>
                <Button variant="ghost" onClick={() => act("comment")} disabled={loading || !comment}>
                  <MessageSquare className="h-4 w-4" /> So comentar
                </Button>
              </div>
              {loading && <Loader2 className="h-4 w-4 animate-spin mx-auto" />}
            </CardContent>
          </Card>
        )}

        {data.revisoes.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Historico</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {data.revisoes.map((r) => (
                <div key={r.id} className="flex gap-2 p-2 bg-secondary/40 rounded">
                  <Badge variant="outline" className="text-[9px]">{r.type}</Badge>
                  <div className="flex-1">
                    <div>{r.content}</div>
                    <div className="text-muted-foreground mt-1">{new Date(r.created_at).toLocaleString("pt-BR")}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
