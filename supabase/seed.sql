-- Seed inicial - Grupo Nogueira (tenant master)
-- Rode depois de criar tenant pelo signup. Ajuste o slug se necessario.

-- Boards padrao para o primeiro tenant
insert into boards (id, tenant_id, name, scope, team)
select uuid_generate_v4(), t.id, 'Geral - Agencia', 'geral', null from tenants t where t.is_master limit 1
on conflict do nothing;

insert into boards (id, tenant_id, name, scope, team)
select uuid_generate_v4(), t.id, 'Trafego Pago', 'time', 'trafego' from tenants t where t.is_master limit 1
on conflict do nothing;

insert into boards (id, tenant_id, name, scope, team)
select uuid_generate_v4(), t.id, 'Comercial', 'time', 'comercial' from tenants t where t.is_master limit 1
on conflict do nothing;

insert into boards (id, tenant_id, name, scope, team)
select uuid_generate_v4(), t.id, 'Social Media', 'time', 'social' from tenants t where t.is_master limit 1
on conflict do nothing;

insert into boards (id, tenant_id, name, scope, team)
select uuid_generate_v4(), t.id, 'Video Maker', 'time', 'video' from tenants t where t.is_master limit 1
on conflict do nothing;

-- Colunas padrao para cada board
with b as (select id from boards)
insert into board_columns (board_id, name, color, position)
select b.id, 'Backlog',     '#64748b', 0 from b
union all select b.id, 'Em andamento', '#00c8e0', 1 from b
union all select b.id, 'Revisao',     '#ffc048', 2 from b
union all select b.id, 'Concluido',   '#22c55e', 3 from b
on conflict do nothing;

-- Template de follow-up padrao
insert into followup_templates (tenant_id, name, channel, subject, body)
select t.id, 'Cobranca amigavel (vencimento)', 'whatsapp', null,
  'Oi {{contato_nome}}! Aqui e da {{agencia_nome}}. Passando pra lembrar que o vencimento da sua mensalidade e no dia {{vencimento}}. Qualquer duvida estou aqui. 🚀'
from tenants t where t.is_master limit 1;

insert into followup_templates (tenant_id, name, channel, subject, body)
select t.id, 'Relatorio mensal (email)', 'email', 'Seu relatorio de {{mes}} esta pronto',
  'Olá {{contato_nome}},<br><br>Segue em anexo o relatorio de {{mes}} da sua operacao de trafego.<br><br>Principais numeros:<br>- Investimento: R$ {{spend}}<br>- Cliques: {{clicks}}<br>- Cadastros: {{leads}}<br><br>Qualquer duvida, estou a disposicao.<br><br>-- {{agencia_nome}}'
from tenants t where t.is_master limit 1;

-- Agente IA padrao (interno, desativado)
insert into ai_agents (tenant_id, name, persona, system_prompt, channels, is_active)
select t.id, 'Assistente Interno', 'Assistente interno do Grupo Nogueira',
  'Voce e o assistente interno do Grupo Nogueira, agencia de trafego pago. Ajude a equipe com analises de campanha, sugestoes de otimizacao, redacao de copy e organizacao de tarefas. Seja direto, estrategico, sem enrolacao.',
  '{}', false
from tenants t where t.is_master limit 1;
