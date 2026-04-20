"use client";
import { Phone, MessageSquare, Target, Calendar, CheckCircle2, Video } from "lucide-react";

interface Funil {
  ligacoes_disparadas: number;
  ligacoes_atendidas: number;
  ligacoes_com_interesse: number;
  whatsapp_apos_ligacao: number;
  agendamento_proposto: number;
  agendamento_confirmado: number;
  evento_criado_calendar: number;
  reuniao_realizada: number;
}

interface Conversoes {
  taxa_atendimento: number;
  taxa_interesse_apos_atender: number;
  taxa_proposta_apos_interesse: number;
  taxa_confirmacao: number;
  taxa_evento_calendar: number;
  taxa_reuniao_apos_evento: number;
  taxa_total_lig_ate_reuniao: number;
}

export function FunilUI({ funil, conversoes }: { funil: Funil; conversoes: Conversoes }) {
  const etapas = [
    { label: "Ligações disparadas", valor: funil.ligacoes_disparadas, cor: "from-purple-500 to-purple-600", icon: Phone, taxa: null },
    { label: "Atenderam", valor: funil.ligacoes_atendidas, cor: "from-blue-500 to-blue-600", icon: Phone, taxa: conversoes.taxa_atendimento },
    { label: "Aceitaram consultoria", valor: funil.ligacoes_com_interesse, cor: "from-cyan-500 to-cyan-600", icon: Target, taxa: conversoes.taxa_interesse_apos_atender },
    { label: "WhatsApp enviado", valor: funil.whatsapp_apos_ligacao, cor: "from-green-500 to-green-600", icon: MessageSquare, taxa: null },
    { label: "Horário proposto", valor: funil.agendamento_proposto, cor: "from-yellow-500 to-yellow-600", icon: Calendar, taxa: conversoes.taxa_proposta_apos_interesse },
    { label: "Confirmado por você", valor: funil.agendamento_confirmado, cor: "from-amber-500 to-amber-600", icon: CheckCircle2, taxa: conversoes.taxa_confirmacao },
    { label: "Evento no Calendar", valor: funil.evento_criado_calendar, cor: "from-orange-500 to-red-500", icon: Calendar, taxa: conversoes.taxa_evento_calendar },
    { label: "Reunião realizada", valor: funil.reuniao_realizada, cor: "from-red-500 to-pink-600", icon: Video, taxa: conversoes.taxa_reuniao_apos_evento },
  ];

  const max = Math.max(...etapas.map((e) => e.valor), 1);

  return (
    <div className="space-y-2">
      {etapas.map((e, i) => {
        const width = Math.max(20, (e.valor / max) * 100);
        const Icon = e.icon;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="w-[180px] text-xs text-right text-muted-foreground flex items-center justify-end gap-2">
              <Icon className="h-3 w-3" />
              {e.label}
            </div>
            <div className="flex-1 bg-background/40 rounded h-8 relative overflow-hidden">
              <div
                className={`bg-gradient-to-r ${e.cor} h-full flex items-center justify-between px-3 transition-all`}
                style={{ width: `${width}%` }}
              >
                <span className="text-xs font-bold text-white">{e.valor}</span>
                {e.taxa !== null && (
                  <span className="text-[10px] text-white/80">{e.taxa}%</span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Taxa total (ligação → reunião realizada):</span>
          <span className="font-bold text-cyan">{conversoes.taxa_total_lig_ate_reuniao}%</span>
        </div>
      </div>
    </div>
  );
}
