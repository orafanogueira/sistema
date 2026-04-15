"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Plus, X, Loader2, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { useRouter } from "next/navigation";

const SEGMENTOS_BR = [
  "oficinas mecanicas", "clinicas odontologicas", "clinicas medicas",
  "academias", "salões de beleza", "advocacia", "contabilidade",
  "imobiliarias", "lojas de roupa", "restaurantes", "pet shops",
  "concessionarias de veiculos", "autoescolas", "escolas particulares",
  "clinicas veterinarias", "corretoras de seguros", "construtoras",
];
const SEGMENTOS_US = [
  "auto repair shops", "dental clinics", "medical clinics",
  "gyms", "beauty salons", "law firms", "accounting firms",
  "real estate agencies", "clothing stores", "restaurants", "pet stores",
  "car dealerships", "driving schools", "private schools",
  "veterinary clinics", "insurance brokers", "construction companies",
];

export function NovaListaButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", segmento: "", cidade: "", estado: "SP", qtd_alvo: 20, pais: "BR",
  });
  const segmentos = form.pais === "US" ? SEGMENTOS_US : SEGMENTOS_BR;

  const save = async () => {
    if (!form.segmento.trim() || !form.cidade.trim())
      return toast.error("Segmento e cidade obrigatorios");
    setLoading(true);
    try {
      const r = await fetch("/api/prospeccao/listas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      toast.success(`Lista criada`, `${data.inserted} empresas encontradas`);
      setOpen(false);
      router.push(`/prospeccao/${data.lista.id}`);
    } catch (e: unknown) {
      toast.error("Erro ao gerar lista", e instanceof Error ? e.message : "tente novamente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova lista</Button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(560px,94vw)] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl p-6 z-50">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan" /> Gerar lista de prospeccao
              </Dialog.Title>
              <Dialog.Close asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></Dialog.Close>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Pais</Label>
                <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm"
                  value={form.pais} onChange={(e) => setForm({ ...form, pais: e.target.value, segmento: "", estado: e.target.value === "US" ? "CA" : "SP" })}>
                  <option value="BR">🇧🇷 Brasil</option>
                  <option value="US">🇺🇸 Estados Unidos</option>
                </select>
              </div>

              <div>
                <Label>Segmento</Label>
                <Input className="mt-1" list="segmentos"
                  placeholder={form.pais === "US" ? "Ex: auto repair shops" : "Ex: oficinas mecanicas"}
                  value={form.segmento} onChange={(e) => setForm({ ...form, segmento: e.target.value })} />
                <datalist id="segmentos">
                  {segmentos.map((s) => <option key={s} value={s} />)}
                </datalist>
                <div className="text-xs text-muted-foreground mt-1">
                  {form.pais === "US" ? "Use termos em ingles pra melhor resultado" : "Termos em portugues"}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>Cidade</Label>
                  <Input className="mt-1" placeholder={form.pais === "US" ? "Austin" : "Sorocaba"}
                    value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
                </div>
                <div>
                  <Label>{form.pais === "US" ? "State" : "Estado"}</Label>
                  <Input className="mt-1" placeholder={form.pais === "US" ? "TX" : "SP"} maxLength={2}
                    value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase() })} />
                </div>
              </div>

              <div>
                <Label>Quantidade (max 50)</Label>
                <Input type="number" className="mt-1" min={5} max={50}
                  value={form.qtd_alvo} onChange={(e) => setForm({ ...form, qtd_alvo: Number(e.target.value) })} />
              </div>

              <div>
                <Label>Nome da lista (opcional)</Label>
                <Input className="mt-1" placeholder="auto: segmento - cidade"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div className="bg-cyan/5 border border-cyan/20 rounded p-3 text-xs text-muted-foreground">
                <div className="font-semibold text-foreground mb-1">Dados que vem do Google Places:</div>
                Nome, endereco, telefone, site, rating, categoria, Google Maps URL. <br />
                Email <b>nao</b> e retornado pela API — vendedores conseguem na ligacao.
              </div>

              <Button onClick={save} disabled={loading} className="w-full">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Buscando no Google Places...</> : "Gerar lista"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
