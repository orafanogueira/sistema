/**
 * Presets por vertical: pipelines, estagios, automacoes e templates pre-prontos.
 * Cada vertical define o "playbook" do cliente.
 */

export type Vertical = "agencia" | "comercial" | "automotivo" | "generico";

export interface StagePreset {
  name: string;
  color: string;
  position: number;
  is_won?: boolean;
  is_lost?: boolean;
  sla_minutes?: number; // se passar disso, dispara timeout
}

export interface AutomationPreset {
  name: string;
  trigger: string;
  trigger_config: Record<string, unknown>;
  conditions?: unknown[];
  actions: { type: string; config: Record<string, unknown> }[];
}

export interface TemplatePreset {
  name: string;
  channel: "whatsapp" | "email";
  category: string;
  subject?: string;
  body: string;
}

export interface VerticalPreset {
  label: string;
  description: string;
  pipelines: { name: string; stages: StagePreset[] }[];
  templates: TemplatePreset[];
  automations: AutomationPreset[];
  modules: Record<string, boolean>;
}

// ============================================================
// AGENCIA (uso interno do Grupo Nogueira)
// ============================================================
const AGENCIA: VerticalPreset = {
  label: "Agencia de marketing",
  description: "Gestao de clientes, times de trafego, social, video e comercial.",
  modules: { crm: true, automotivo: false, financiamento: false, email_parser: true, kanban_classico: true },
  pipelines: [
    {
      name: "Operacao geral",
      stages: [
        { name: "Backlog", color: "#64748b", position: 0 },
        { name: "Em andamento", color: "#00c8e0", position: 1 },
        { name: "Revisao", color: "#ffc048", position: 2 },
        { name: "Entregue", color: "#22c55e", position: 3, is_won: true },
      ],
    },
    {
      name: "Comercial - novos clientes",
      stages: [
        { name: "Lead novo", color: "#64748b", position: 0, sla_minutes: 30 },
        { name: "Qualificacao", color: "#00c8e0", position: 1, sla_minutes: 60 },
        { name: "Proposta enviada", color: "#0055cc", position: 2, sla_minutes: 1440 },
        { name: "Negociacao", color: "#a855f7", position: 3 },
        { name: "Fechado", color: "#22c55e", position: 4, is_won: true },
        { name: "Perdido", color: "#ef4444", position: 5, is_lost: true },
      ],
    },
  ],
  templates: [
    { name: "Boas-vindas cliente novo", channel: "whatsapp", category: "boas_vindas",
      body: "Oi {{nome}}! Aqui e da {{agencia}}. Bem-vindo(a)! Vou te explicar como vamos trabalhar pra te trazer resultado. 🚀" },
    { name: "Primeiro contato", channel: "whatsapp", category: "qualificacao",
      body: "Oi {{nome}}, recebi teu contato. Pra montar a melhor estrategia, me conta: qual o teu objetivo principal nos proximos 90 dias?" },
    { name: "Cobranca amigavel", channel: "whatsapp", category: "cobranca",
      body: "Oi {{nome}}! Lembrete carinhoso: vencimento da mensalidade no dia {{vencimento}}. Qualquer coisa, estou aqui!" },
  ],
  automations: [
    {
      name: "Lead novo - enviar boas-vindas",
      trigger: "lead_created",
      trigger_config: {},
      actions: [
        { type: "send_message_whatsapp", config: { template_category: "boas_vindas" } },
        { type: "assign_round_robin", config: {} },
      ],
    },
    {
      name: "Sem resposta do vendedor em 30min",
      trigger: "no_response_from_seller",
      trigger_config: { minutes: 30 },
      actions: [{ type: "notify_user", config: { role: "admin", message: "Lead {{nome}} sem resposta" } }],
    },
  ],
};

// ============================================================
// COMERCIAL / SERVICOS (clinicas, escritorios, prestadores)
// ============================================================
const COMERCIAL: VerticalPreset = {
  label: "Comercial / Servicos",
  description: "Clinicas, escritorios, prestadores de servico, vendas B2B/B2C.",
  modules: { crm: true, automotivo: false, financiamento: false, email_parser: true, agendamento: true },
  pipelines: [
    {
      name: "Funil comercial",
      stages: [
        { name: "Lead novo", color: "#64748b", position: 0, sla_minutes: 5 },
        { name: "Em atendimento", color: "#00c8e0", position: 1, sla_minutes: 60 },
        { name: "Qualificado", color: "#0055cc", position: 2 },
        { name: "Proposta", color: "#a855f7", position: 3, sla_minutes: 2880 },
        { name: "Fechado/Vendido", color: "#22c55e", position: 4, is_won: true },
        { name: "Perdido", color: "#ef4444", position: 5, is_lost: true },
      ],
    },
  ],
  templates: [
    { name: "Lead novo - resposta imediata", channel: "whatsapp", category: "boas_vindas",
      body: "Oi {{nome}}! Recebi teu contato pelo {{origem}}. Como posso te ajudar?" },
    { name: "Lembrete de agendamento", channel: "whatsapp", category: "agendamento",
      body: "Oi {{nome}}! Confirmando teu horario {{data}} as {{hora}}. Qualquer mudanca, me avisa." },
    { name: "Pos-venda - pesquisa", channel: "whatsapp", category: "pos_venda",
      body: "Oi {{nome}}! Como foi tua experiencia? Notas de 0 a 10? Teu feedback ajuda muito." },
  ],
  automations: [
    {
      name: "Lead novo - 1a resposta automatica",
      trigger: "lead_created",
      trigger_config: {},
      actions: [
        { type: "send_message_whatsapp", config: { template_category: "boas_vindas" } },
        { type: "assign_round_robin", config: {} },
      ],
    },
    {
      name: "SLA: vendedor tem 5min pra responder",
      trigger: "no_response_from_seller",
      trigger_config: { minutes: 5 },
      actions: [
        { type: "run_ai_response", config: { fallback: true } },
        { type: "notify_user", config: { role: "manager", message: "Lead {{nome}} sem resposta em 5min" } },
      ],
    },
    {
      name: "Lead idle 24h - reativar",
      trigger: "lead_idle",
      trigger_config: { hours: 24 },
      actions: [{ type: "send_message_whatsapp", config: { body: "Oi {{nome}}, ainda tens interesse? Estou a disposicao." } }],
    },
  ],
};

// ============================================================
// AUTOMOTIVO (loja de carros) - o caso de uso forte
// ============================================================
const AUTOMOTIVO: VerticalPreset = {
  label: "Loja de veiculos",
  description: "Revenda de carros, usados, multimarcas. CRM completo + IA com estoque + financiamento.",
  modules: { crm: true, automotivo: true, financiamento: true, email_parser: true, portais: true, ia_estoque: true },
  pipelines: [
    {
      name: "Funil de vendas - veiculos",
      stages: [
        { name: "Lead novo", color: "#64748b", position: 0, sla_minutes: 5 },
        { name: "Primeiro contato", color: "#00c8e0", position: 1, sla_minutes: 30 },
        { name: "Visita agendada", color: "#0055cc", position: 2 },
        { name: "Compareceu", color: "#a855f7", position: 3 },
        { name: "Proposta/Test drive", color: "#ffc048", position: 4 },
        { name: "Negociacao", color: "#f59e0b", position: 5 },
        { name: "Financiamento em analise", color: "#06b6d4", position: 6 },
        { name: "Vendido", color: "#22c55e", position: 7, is_won: true },
        { name: "Perdido", color: "#ef4444", position: 8, is_lost: true },
      ],
    },
  ],
  templates: [
    { name: "Lead novo - resposta automatica", channel: "whatsapp", category: "boas_vindas",
      body: "Oi {{nome}}! Recebi teu interesse no {{modelo}}. Sou da {{loja}}, vou te passar todas informacoes em segundos! 🚗" },
    { name: "Envio de fotos do veiculo", channel: "whatsapp", category: "info_veiculo",
      body: "{{nome}}, segue as fotos e ficha tecnica do {{modelo}} {{ano}}.\n\n💰 R$ {{preco}}\n📍 {{km}} km\n⛽ {{combustivel}}\n\nQuer agendar visita pra ver pessoalmente?" },
    { name: "Agendamento de visita", channel: "whatsapp", category: "agendamento",
      body: "{{nome}}, agendamos sua visita {{data}} as {{hora}} na loja {{endereco}}. Qualquer impedimento, me avisa! 🤝" },
    { name: "Pos-visita sem fechar", channel: "whatsapp", category: "follow_up",
      body: "Oi {{nome}}! Apos tua visita, ainda esta interessado(a) no {{modelo}}? Posso facilitar a negociacao se precisar!" },
    { name: "Simulacao de financiamento", channel: "whatsapp", category: "financiamento",
      body: "{{nome}}, simulei o financiamento do {{modelo}} pra ti:\n\n💵 Entrada: R$ {{entrada}}\n📅 {{parcelas}}x de R$ {{valor_parcela}}\n📊 Taxa: {{taxa}}% a.m.\n\nQuer formalizar a proposta?" },
    { name: "FU 24h sem resposta", channel: "whatsapp", category: "follow_up",
      body: "Oi {{nome}}, te procurei ontem sobre o {{modelo}}. Continua interessado(a)? Posso te enviar mais info ou ajudar de outra forma!" },
    { name: "FU 7d - modelo similar", channel: "whatsapp", category: "follow_up",
      body: "{{nome}}, lembrei de ti! Acabou de chegar um {{modelo_similar}} {{ano}} no estoque. Quer dar uma olhada?" },
  ],
  automations: [
    {
      name: "Lead novo - resposta IA imediata",
      trigger: "lead_created",
      trigger_config: {},
      actions: [
        { type: "send_message_whatsapp", config: { template_category: "boas_vindas" } },
        { type: "assign_round_robin", config: {} },
        { type: "run_ai_response", config: { send_vehicle_photo: true } },
      ],
    },
    {
      name: "Vendedor nao respondeu em 5min - IA assume",
      trigger: "no_response_from_seller",
      trigger_config: { minutes: 5 },
      actions: [
        { type: "run_ai_response", config: { mode: "qualification" } },
        { type: "notify_user", config: { role: "manager", message: "Vendedor lento - lead {{nome}}" } },
      ],
    },
    {
      name: "Vendedor inativo 1h - escala gerente",
      trigger: "no_response_from_seller",
      trigger_config: { minutes: 60 },
      actions: [{ type: "escalate_to_manager", config: { reason: "1h sem resposta" } }],
    },
    {
      name: "Visita agendada -> evento Calendar + lembrete",
      trigger: "lead_stage_changed",
      trigger_config: { to_stage_name: "Visita agendada" },
      actions: [
        { type: "create_calendar_event", config: { duration_min: 60 } },
        { type: "send_message_whatsapp", config: { template_category: "agendamento" } },
      ],
    },
    {
      name: "FU 24h sem resposta",
      trigger: "lead_idle",
      trigger_config: { hours: 24 },
      conditions: [{ field: "status", op: "in", value: ["em_atendimento", "qualificado"] }],
      actions: [{ type: "send_message_whatsapp", config: { template_category: "follow_up" } }],
    },
    {
      name: "FU 7d - sugerir modelo similar",
      trigger: "lead_idle",
      trigger_config: { hours: 168 },
      conditions: [{ field: "status", op: "in", value: ["em_atendimento", "qualificado"] }],
      actions: [{ type: "send_message_whatsapp", config: { template_category: "follow_up" } }],
    },
    {
      name: "Vendido -> pesquisa de satisfacao + tarefa pos-venda",
      trigger: "lead_stage_changed",
      trigger_config: { to_stage_name: "Vendido" },
      actions: [
        { type: "send_message_whatsapp", config: { body: "🎉 Parabens pelo seu novo {{modelo}}! Em breve te contato pra coletar feedback." } },
        { type: "create_task", config: { title: "Pos-venda 7d - {{nome}}", due_in_days: 7 } },
      ],
    },
  ],
};

const GENERICO: VerticalPreset = {
  label: "Generico (configurar manual)",
  description: "Sem preset. Voce define tudo.",
  modules: { crm: true },
  pipelines: [{ name: "Pipeline padrao", stages: [
    { name: "Backlog", color: "#64748b", position: 0 },
    { name: "Fazendo", color: "#00c8e0", position: 1 },
    { name: "Concluido", color: "#22c55e", position: 2, is_won: true },
  ] }],
  templates: [],
  automations: [],
};

export const VERTICAL_PRESETS: Record<Vertical, VerticalPreset> = {
  agencia: AGENCIA,
  comercial: COMERCIAL,
  automotivo: AUTOMOTIVO,
  generico: GENERICO,
};

export function getPreset(vertical: Vertical): VerticalPreset {
  return VERTICAL_PRESETS[vertical] || GENERICO;
}
