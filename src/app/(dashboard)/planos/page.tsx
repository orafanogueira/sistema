import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Building2, Car, Phone, Youtube, Zap } from "lucide-react";
import { AssinarButton } from "@/components/planos/assinar-button";
import { getAccessContext } from "@/lib/access/server";

export const dynamic = "force-dynamic";

const ICONS: Record<string, React.ElementType> = {
  Crown, Building2, Car, Phone, Youtube, Zap,
};

interface Product {
  key: string;
  name: string;
  tagline: string | null;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  icon: string;
  color: string;
  position: number;
  is_bundle: boolean;
}

export default async function PlanosPage() {
  const supabase = await createClient();
  const { data: products } = await supabase.from("products")
    .select("*").eq("is_active", true).order("position");

  const access = await getAccessContext();
  const prods = (products || []) as Product[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Planos & Soluções</h1>
        <p className="text-muted-foreground">
          Escolha as soluções da agência Nogueira OS que você precisa — ou leve o combo completo.
        </p>
      </div>

      {access.isMaster && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4 text-sm flex items-center gap-3">
            <Crown className="h-5 w-5 text-yellow-400" />
            <span>Você é <b>tenant master</b> (Grupo Nogueira) — acesso a tudo automático.</span>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {prods.map((p) => {
          const Icon = ICONS[p.icon] || Zap;
          const active = access.activeProducts.includes(p.key) || access.isMaster;
          return (
            <Card key={p.key} className={p.is_bundle ? "border-cyan/50 bg-gradient-to-br from-cyan/5 to-brand-500/5" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="h-11 w-11 rounded-xl flex items-center justify-center"
                    style={{ background: `${p.color}20`, color: p.color }}>
                    <Icon className="h-5 w-5" />
                  </div>
                  {active && <Badge variant="success">ativo</Badge>}
                  {p.is_bundle && !active && <Badge className="bg-cyan/20 text-cyan border-cyan/30">COMBO</Badge>}
                </div>
                <CardTitle className="text-lg mt-2">{p.name}</CardTitle>
                {p.tagline && <p className="text-xs text-muted-foreground -mt-1">{p.tagline}</p>}
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-3xl font-black">R$ {Number(p.price_monthly).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</div>
                  <div className="text-xs text-muted-foreground">
                    /mês · ou R$ {Number(p.price_yearly).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}/ano
                  </div>
                </div>

                <ul className="space-y-1.5 text-sm">
                  {(p.features || []).map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-xs">{f}</span>
                    </li>
                  ))}
                </ul>

                {active ? (
                  <div className="text-xs text-green-400 font-semibold text-center py-2 border border-green-400/20 rounded-md">
                    Ativo no seu tenant
                  </div>
                ) : (
                  <AssinarButton productKey={p.key} productName={p.name} priceMonthly={Number(p.price_monthly)} priceYearly={Number(p.price_yearly)} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Como funciona</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• Cada solução libera apenas os módulos específicos daquela vertical</p>
          <p>• O plano <b>Sistema Completo</b> libera tudo (desconto vs. comprar separado)</p>
          <p>• Pagamento mensal ou anual (10% de desconto no anual)</p>
          <p>• Cancelamento a qualquer momento</p>
          <p>• Suporte incluso em todos os planos</p>
        </CardContent>
      </Card>
    </div>
  );
}
