-- ============================================================
-- MIGRATION 019: Disparo WhatsApp (multi-número, rotação, IA copy)
-- ============================================================

create table if not exists whatsapp_numeros (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  nome text not null,                          -- "Número 1 - Comercial"
  telefone text not null,                      -- +5511999999999
  zapi_instance_id text,
  zapi_token text,
  is_active boolean default true,
  msgs_enviadas_hoje int default 0,
  max_por_dia int default 100,
  max_por_hora int default 15,
  ultimo_envio_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_wpp_numeros_tenant on whatsapp_numeros(tenant_id);

do $$ begin
  create type disparo_status as enum ('pendente','enviando','enviado','erro','respondido','cancelado');
exception when duplicate_object then null; end $$;

create table if not exists disparo_campanhas (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  nome text not null,
  lista_id uuid references prospeccao_listas(id) on delete set null,
  tipo text default 'prospeccao',              -- prospeccao, followup, broadcast
  prompt_template text,                        -- prompt IA pra gerar copy personalizado
  mensagem_padrao text,                        -- fallback se IA falhar
  intervalo_min_seg int default 30,            -- min segundos entre msgs
  intervalo_max_seg int default 90,            -- max segundos (aleatorio entre min-max)
  status text default 'rascunho',              -- rascunho, ativa, pausada, concluida
  total_mensagens int default 0,
  total_enviadas int default 0,
  total_erros int default 0,
  total_respondidas int default 0,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_disparo_camp_tenant on disparo_campanhas(tenant_id);

create table if not exists disparo_mensagens (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  campanha_id uuid not null references disparo_campanhas(id) on delete cascade,
  lead_id uuid references prospeccao_leads(id) on delete set null,
  numero_id uuid references whatsapp_numeros(id) on delete set null,
  telefone_destino text not null,
  nome_destino text,
  empresa_destino text,
  texto_gerado text,                           -- copy personalizado pela IA
  status disparo_status default 'pendente',
  sent_at timestamptz,
  error_message text,
  responded_at timestamptz,
  response_text text,
  position int default 0,                      -- ordem na fila
  created_at timestamptz default now()
);
create index if not exists idx_disparo_msgs_camp on disparo_mensagens(campanha_id, status);
create index if not exists idx_disparo_msgs_numero on disparo_mensagens(numero_id, status);

alter table whatsapp_numeros enable row level security;
alter table disparo_campanhas enable row level security;
alter table disparo_mensagens enable row level security;

do $$ begin create policy "wpp_num_all" on whatsapp_numeros for all
  using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin create policy "disp_camp_all" on disparo_campanhas for all
  using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin create policy "disp_msg_all" on disparo_mensagens for all
  using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;
