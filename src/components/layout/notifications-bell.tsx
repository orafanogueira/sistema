"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

interface Alert {
  id: string; type: string; severity: string; title: string; message: string | null;
  created_at: string; is_read: boolean; cliente_id: string | null;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unread, setUnread] = useState(0);

  async function load() {
    try {
      const res = await fetch("/api/alerts-feed");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data || []);
        setUnread((data || []).filter((a: Alert) => !a.is_read).length);
      }
    } catch { /* ignora */ }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    // Realtime via Supabase channel
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    try {
      const sb = createClient();
      channel = sb.channel("alerts-realtime")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, () => load())
        .subscribe();
    } catch {}
    return () => {
      clearInterval(interval);
      if (channel) channel.unsubscribe();
    };
  }, []);

  const markAsRead = async (id: string) => {
    await fetch(`/api/alerts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_read: true }) });
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, is_read: true } : a));
    setUnread((u) => Math.max(0, u - 1));
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-md hover:bg-secondary">
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <Card className="absolute right-0 mt-2 w-80 z-50 max-h-96 overflow-y-auto shadow-2xl">
          <CardContent className="p-2 space-y-1">
            <div className="flex items-center justify-between p-2">
              <div className="text-sm font-bold">Notificacoes</div>
              <Link href="/alertas" className="text-xs text-cyan hover:underline" onClick={() => setOpen(false)}>Ver todos</Link>
            </div>
            {alerts.length === 0 ? (
              <div className="text-xs text-muted-foreground p-6 text-center">Nenhuma notificacao</div>
            ) : alerts.slice(0, 10).map((a) => {
              const Icon = a.severity === "critical" ? AlertCircle : a.severity === "warning" ? AlertTriangle : Info;
              const colorClass = a.severity === "critical" ? "text-red-400" : a.severity === "warning" ? "text-yellow-400" : "text-cyan";
              return (
                <button key={a.id}
                  onClick={() => markAsRead(a.id)}
                  className={`w-full text-left p-2 rounded hover:bg-secondary ${!a.is_read ? "bg-secondary/50" : ""}`}>
                  <div className="flex items-start gap-2">
                    <Icon className={`h-3 w-3 mt-1 flex-shrink-0 ${colorClass}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-semibold ${!a.is_read ? "" : "text-muted-foreground"}`}>{a.title}</div>
                      {a.message && <div className="text-[10px] text-muted-foreground line-clamp-2">{a.message}</div>}
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
