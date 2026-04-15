import { Youtube } from "lucide-react";
import { YoutubeTabs } from "@/components/youtube/youtube-tabs";

export const dynamic = "force-dynamic";

export default function YoutubePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
          <Youtube className="h-7 w-7 text-red-500" /> YouTube IA
        </h1>
        <p className="text-muted-foreground">Minerador + gerador de titulos, descricoes e roteiros magneticos.</p>
      </div>
      <YoutubeTabs />
    </div>
  );
}
