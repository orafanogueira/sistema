-- ============================================================
-- MIGRATION 020: Disparo Email (sequências automáticas via Resend)
-- ============================================================

create table if not exists email_campanhas (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  nome text not null,
  lista_id uuid references prospeccao_listas(id) on delete set null,
  assunto_template text,
  corpo_template text,
  prompt_ia text,
  from_name text default 'Grupo Nogueira',
  from_email text default 'contato@gruponogueiramkt.com',
  status text default 'rascunho',
  total_emails int default 0,
  total_enviados int default 0,
  total_erros int default 0,
  total_abertos int default 0,
  total_respondidos int default 0,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_email_camp_tenant on email_campanhas(tenant_id);

create table if not exists email_mensagens (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  campanha_id uuid not null references email_campanhas(id) on delete cascade,
  lead_id uuid references prospeccao_leads(id) on delete set null,
  email_destino text not null,
  nome_destino text,
  empresa_destino text,
  assunto text,
  corpo_html text,
  status text default 'pendente',
  resend_id text,
  sent_at timestamptz,
  opened_at timestamptz,
  error_message text,
  position int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_email_msgs_camp on email_mensagens(campanha_id, status);

alter table email_campanhas enable row level security;
alter table email_mensagens enable row level security;

do $$ begin create policy "email_camp_all" on email_campanhas for all
  using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin create policy "email_msg_all" on email_mensagens for all
  using (tenant_id in (select tenant_id from memberships where user_id = auth.uid()));
exception when duplicate_object then null; end $$;
