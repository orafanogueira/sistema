"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "@/components/ui/toaster";

export function AssinarButton({ productKey, productName, priceMonthly, priceYearly }: {
  productKey: string; productName: string; priceMonthly: number; priceYearly: number;
}) {
  const [loading, setLoading] = useState(false);
  const [ciclo, setCiclo] = useState<"MONTHLY" | "YEARLY">("MONTHLY");

  const assinar = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/tenant-products/assinar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_key: productKey, ciclo }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      toast.success("Produto ativado", `${productName} liberado no seu tenant`);
      if (data.payment_url) {
        window.open(data.payment_url, "_blank");
      }
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: unknown) {
      toast.error("Erro", e instanceof Error ? e.message : "tente novamente");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-[11px]">
        <button onClick={() => setCiclo("MONTHLY")}
          className={`flex-1 py-1.5 rounded border transition-colors ${ciclo === "MONTHLY" ? "border-cyan bg-cyan/10 text-cyan" : "border-border text-muted-foreground"}`}>
          Mensal
        </button>
        <button onClick={() => setCiclo("YEARLY")}
          className={`flex-1 py-1.5 rounded border transition-colors ${ciclo === "YEARLY" ? "border-cyan bg-cyan/10 text-cyan" : "border-border text-muted-foreground"}`}>
          Anual (-10%)
        </button>
      </div>
      <Button onClick={assinar} disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4" /> Assinar {ciclo === "MONTHLY" ? `R$ ${priceMonthly}/mês` : `R$ ${priceYearly}/ano`}</>}
      </Button>
    </div>
  );
}
