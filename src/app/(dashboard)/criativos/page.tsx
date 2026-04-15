import { CarrosselGenerator } from "@/components/criativos/carrossel-generator";

export const dynamic = "force-dynamic";

export default function CriativosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Criativos IA</h1>
        <p className="text-muted-foreground">Geracao automatica de carrosseis visuais em SVG (prontos pra baixar ou editar no Canva).</p>
      </div>
      <CarrosselGenerator />
    </div>
  );
}
