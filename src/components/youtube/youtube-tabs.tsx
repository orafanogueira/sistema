"use client";
import { useState } from "react";
import { Target, Sparkles, FileText, Video, Film, Music } from "lucide-react";
import { Minerador } from "./minerador";
import { Titulos } from "./titulos";
import { Descricao } from "./descricao";
import { Roteiro } from "./roteiro";
import { VideoStudio } from "./video-studio";
import { Trilha } from "./trilha";

type Tab = "minerador" | "titulos" | "descricao" | "roteiro" | "video" | "trilha";

export function YoutubeTabs() {
  const [tab, setTab] = useState<Tab>("minerador");

  const TABS: { id: Tab; label: string; icon: React.ElementType; desc: string }[] = [
    { id: "minerador", label: "Minerador", icon: Target, desc: "Canais oportunidade" },
    { id: "titulos", label: "Titulos", icon: Sparkles, desc: "10 variacoes SEO" },
    { id: "descricao", label: "Descricao + Tags", icon: FileText, desc: "500 chars de tags" },
    { id: "roteiro", label: "Roteiro magnetico", icon: Video, desc: "Com hooks Dotti-style" },
    { id: "video", label: "Video Studio", icon: Film, desc: "Voz + imagens + thumb" },
    { id: "trilha", label: "Trilha Sonora", icon: Music, desc: "Udio AI" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`p-3 rounded-md border text-left transition-colors ${tab === t.id ? "border-cyan bg-cyan/10" : "border-border hover:border-cyan/50"}`}>
              <Icon className={`h-4 w-4 mb-1 ${tab === t.id ? "text-cyan" : "text-muted-foreground"}`} />
              <div className={`text-sm font-bold ${tab === t.id ? "text-cyan" : ""}`}>{t.label}</div>
              <div className="text-[10px] text-muted-foreground">{t.desc}</div>
            </button>
          );
        })}
      </div>

      {tab === "minerador" && <Minerador />}
      {tab === "titulos" && <Titulos />}
      {tab === "descricao" && <Descricao />}
      {tab === "roteiro" && <Roteiro />}
      {tab === "video" && <VideoStudio />}
      {tab === "trilha" && <Trilha />}
    </div>
  );
}
