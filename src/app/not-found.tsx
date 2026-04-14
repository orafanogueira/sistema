import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <div className="text-8xl font-black text-gradient mb-4">404</div>
        <div className="text-xl font-bold mb-2">Pagina nao encontrada</div>
        <div className="text-muted-foreground mb-6">A rota que voce tentou nao existe.</div>
        <Link href="/dashboard"><Button>Voltar para o dashboard</Button></Link>
      </div>
    </div>
  );
}
