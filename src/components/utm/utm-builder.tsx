"use client";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Copy, Check, Sparkles } from "lucide-react";

const SOURCES = ["meta", "google", "tiktok", "linkedin", "email", "whatsapp", "instagram", "facebook", "youtube"];
const MEDIUMS = ["cpc", "cpm", "social", "email", "affiliate", "organic", "referral", "display"];
const CAMPAIGNS_SUGESTOES = ["lancamento", "blackfriday", "natal", "promo", "branding", "leadgen"];

export function UtmBuilder() {
  const [baseUrl, setBaseUrl] = useState("");
  const [source, setSource] = useState("meta");
  const [medium, setMedium] = useState("cpc");
  const [campaign, setCampaign] = useState("");
  const [term, setTerm] = useState("");
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);

  const finalUrl = useMemo(() => {
    if (!baseUrl) return "";
    try {
      const url = new URL(baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`);
      if (source) url.searchParams.set("utm_source", source);
      if (medium) url.searchParams.set("utm_medium", medium);
      if (campaign) url.searchParams.set("utm_campaign", campaign);
      if (term) url.searchParams.set("utm_term", term);
      if (content) url.searchParams.set("utm_content", content);
      return url.toString();
    } catch { return "URL invalida"; }
  }, [baseUrl, source, medium, campaign, term, content]);

  const copy = () => {
    navigator.clipboard.writeText(finalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-sm">Parametros</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>URL de destino *</Label><Input className="mt-1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://seucliente.com.br/lp/carros" /></div>

          <div>
            <Label>Source (origem) *</Label>
            <div className="flex gap-1 flex-wrap mt-1">
              {SOURCES.map((s) => (
                <button key={s} type="button" onClick={() => setSource(s)}
                  className={`px-2 py-1 rounded text-[11px] border ${source === s ? "border-cyan bg-cyan/20" : "border-border"}`}>
                  {s}
                </button>
              ))}
            </div>
            <Input className="mt-2" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Ou digita customizado" />
          </div>

          <div>
            <Label>Medium (tipo) *</Label>
            <div className="flex gap-1 flex-wrap mt-1">
              {MEDIUMS.map((s) => (
                <button key={s} type="button" onClick={() => setMedium(s)}
                  className={`px-2 py-1 rounded text-[11px] border ${medium === s ? "border-cyan bg-cyan/20" : "border-border"}`}>
                  {s}
                </button>
              ))}
            </div>
            <Input className="mt-2" value={medium} onChange={(e) => setMedium(e.target.value)} />
          </div>

          <div>
            <Label>Campaign (nome da campanha) *</Label>
            <Input className="mt-1" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="lancamento-abril" />
            <div className="flex gap-1 flex-wrap mt-1">
              {CAMPAIGNS_SUGESTOES.map((s) => (
                <button key={s} type="button" onClick={() => setCampaign(s)}
                  className="px-2 py-1 rounded text-[10px] border border-border text-muted-foreground">{s}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div><Label>Term (palavra-chave)</Label><Input className="mt-1" value={term} onChange={(e) => setTerm(e.target.value)} /></div>
            <div><Label>Content (criativo)</Label><Input className="mt-1" value={content} onChange={(e) => setContent(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">URL gerada</CardTitle></CardHeader>
        <CardContent>
          <div className="p-3 bg-secondary rounded text-xs font-mono break-all min-h-[80px]">
            {finalUrl || <span className="text-muted-foreground italic">Preencha os campos ao lado</span>}
          </div>
          <Button className="w-full mt-3" onClick={copy} disabled={!finalUrl}>
            {copied ? <><Check className="h-4 w-4 text-green-400" /> Copiado!</> : <><Copy className="h-4 w-4" /> Copiar URL</>}
          </Button>

          <div className="mt-4 p-3 bg-cyan/5 border border-cyan/20 rounded text-xs">
            <div className="font-semibold mb-1 flex items-center gap-1"><Sparkles className="h-3 w-3" /> Dica</div>
            <div className="text-muted-foreground">
              Depois de rodar a campanha, tu consegue ver todos os cliques com essas UTMs em <strong>/rastreamento</strong>.
              Pra links de WhatsApp, prefere o <strong>Links Rastreaveis</strong> que cria um link curto + captura fbclid/gclid.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
