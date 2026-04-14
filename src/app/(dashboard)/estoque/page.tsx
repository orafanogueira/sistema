import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Car, ImageOff } from "lucide-react";
import { formatBRL, formatInt } from "@/lib/utils";

export default async function EstoquePage() {
  const supabase = await createClient();
  const { data: veiculos } = await supabase
    .from("veiculos").select("*,cliente:clientes(nome)")
    .order("updated_at", { ascending: false }).limit(120);

  const stats = {
    total: (veiculos || []).length,
    disponivel: (veiculos || []).filter((v) => v.status === "disponivel").length,
    vendido: (veiculos || []).filter((v) => v.status === "vendido").length,
    valorTotal: (veiculos || []).filter((v) => v.status === "disponivel").reduce((s, v) => s + Number(v.preco || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Estoque</h1>
          <p className="text-muted-foreground">Gerencie veiculos disponiveis para venda.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Importar (CSV)</Button>
          <Button><Plus className="h-4 w-4" /> Novo veiculo</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Total</div><div className="text-2xl font-black mt-1">{formatInt(stats.total)}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Disponiveis</div><div className="text-2xl font-black mt-1 text-green-400">{formatInt(stats.disponivel)}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Vendidos</div><div className="text-2xl font-black mt-1 text-cyan">{formatInt(stats.vendido)}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Valor estoque</div><div className="text-2xl font-black mt-1 text-yellow-400">{formatBRL(stats.valorTotal)}</div></CardContent></Card>
      </div>

      {(veiculos || []).length === 0 ? (
        <Card><CardContent className="p-16 text-center">
          <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <div className="font-bold text-lg mb-1">Estoque vazio</div>
          <div className="text-sm text-muted-foreground mb-6">Importe sua DMS ou adicione veiculos manualmente.</div>
          <Button><Plus className="h-4 w-4" /> Adicionar veiculo</Button>
        </CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
          {(veiculos || []).map((v) => {
            const fotos = (v.fotos as { url: string }[]) || [];
            return (
              <Card key={v.id} className="overflow-hidden hover:border-cyan/30 transition-colors">
                {fotos.length > 0 ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={fotos[0].url} alt={v.modelo} className="aspect-video object-cover w-full" />
                ) : (
                  <div className="aspect-video bg-secondary flex items-center justify-center"><ImageOff className="h-8 w-8 text-muted-foreground" /></div>
                )}
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <div className="font-bold text-sm">{v.marca} {v.modelo}</div>
                    <Badge variant={v.status === "disponivel" ? "success" : v.status === "vendido" ? "secondary" : "warning"} className="text-[10px]">{v.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{v.ano} · {formatInt(Number(v.km || 0))} km · {v.combustivel}</div>
                  <div className="text-cyan font-black mt-2">{formatBRL(Number(v.preco || 0))}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
