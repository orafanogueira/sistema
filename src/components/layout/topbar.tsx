"use client";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NotificationsBell } from "./notifications-bell";

export function Topbar({ userName }: { userName: string }) {
  const initials = userName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <header className="h-16 border-b border-border bg-card/40 flex items-center justify-between px-6 glass">
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente, tarefa, campanha..." className="pl-9" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <NotificationsBell />
        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="text-right">
            <div className="text-sm font-semibold leading-tight">{userName}</div>
            <div className="text-[11px] text-muted-foreground">Admin</div>
          </div>
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-500 to-cyan flex items-center justify-center text-xs font-bold">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
