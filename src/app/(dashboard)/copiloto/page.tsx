import { CopilotChat } from "@/components/copilot/copilot-chat";

export const dynamic = "force-dynamic";

export default function CopilotPage() {
  return (
    <div className="h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-3xl font-black tracking-tight">Copiloto IA</h1>
        <p className="text-muted-foreground">Assistente que entende teus clientes e executa acoes.</p>
      </div>
      <CopilotChat />
    </div>
  );
}
