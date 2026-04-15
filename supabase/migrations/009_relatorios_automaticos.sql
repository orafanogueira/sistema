-- ============================================================
-- Migration 009 - Relatorios mensais automatizados
-- ============================================================

-- Relatorios agendados ja foram criados em 008. Aqui so adicionamos
-- indices e extensoes.

create index if not exists idx_rel_ag_next_send on relatorios_agendados(next_send_at) where is_active = true;

-- function pra calcular proximo envio
create or replace function relatorio_proximo_envio(p_dia_do_mes int, p_last_sent timestamptz)
returns timestamptz as $$
declare
  hoje date := current_date;
  proximo date;
begin
  if p_last_sent is null then
    -- nunca enviou: proxima eh o dia do mes que vem se ja passou
    proximo := make_date(extract(year from hoje)::int, extract(month from hoje)::int, least(p_dia_do_mes, 28));
    if proximo < hoje then
      proximo := proximo + interval '1 month';
    end if;
  else
    -- proxima: dia do mes + 1 mes depois do last_sent
    proximo := make_date(
      extract(year from p_last_sent + interval '1 month')::int,
      extract(month from p_last_sent + interval '1 month')::int,
      least(p_dia_do_mes, 28)
    );
  end if;
  return proximo::timestamptz;
end;
$$ language plpgsql;
