-- ============================================================
-- MIGRATION 012: Kanban (boards, columns, tasks)
-- ============================================================

create table if not exists boards (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  name text not null,
  scope text default 'tenant',  -- tenant, cliente, team, personal
  team text,                    -- trafego, social, video, comercial (opcional)
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_boards_tenant on boards(tenant_id);
create index if not exists idx_boards_cliente on boards(cliente_id);

create table if not exists board_columns (
  id uuid primary key default uuid_generate_v4(),
  board_id uuid not null references boards(id) on delete cascade,
  name text not null,
  color text default '#64748b',
  position int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_board_columns_board on board_columns(board_id, position);

create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  board_id uuid references boards(id) on delete cascade,
  column_id uuid references board_columns(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  assigned_to uuid references profiles(id),
  title text not null,
  description text,
  priority text default 'normal',   -- low, normal, high, urgent
  due_date date,
  tags text[] default '{}',
  position int default 0,
  completed_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_tasks_board on tasks(board_id, column_id, position);
create index if not exists idx_tasks_tenant on tasks(tenant_id);
create index if not exists idx_tasks_assigned on tasks(assigned_to) where assigned_to is not null;

-- RLS
alter table boards enable row level security;
alter table board_columns enable row level security;
alter table tasks enable row level security;

do $$ begin
  create policy "boards_tenant_members" on boards for all using (
    tenant_id in (select tenant_id from memberships where user_id = auth.uid())
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "board_columns_via_board" on board_columns for all using (
    board_id in (select id from boards where tenant_id in (select tenant_id from memberships where user_id = auth.uid()))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "tasks_tenant_members" on tasks for all using (
    tenant_id in (select tenant_id from memberships where user_id = auth.uid())
  );
exception when duplicate_object then null; end $$;
