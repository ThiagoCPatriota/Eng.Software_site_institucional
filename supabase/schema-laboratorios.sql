-- ============================================================
-- Módulo de Laboratórios - Site Institucional ES IFPE BJ
-- Rode depois do supabase/schema-admin.sql
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.laboratorios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text,
  localizacao text,
  capacidade integer,
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint laboratorios_nome_unique unique (nome)
);

create table if not exists public.laboratorio_reservas (
  id uuid primary key default gen_random_uuid(),
  laboratorio_id uuid not null references public.laboratorios(id) on delete cascade,
  tipo text not null default 'reserva' check (tipo in ('reserva', 'indisponivel', 'aula', 'manutencao', 'projeto', 'apresentacao')),
  status text not null default 'solicitada' check (status in ('solicitada', 'aprovada', 'recusada', 'cancelada')),
  origem text not null default 'aluno' check (origem in ('aluno', 'admin')),
  data_reserva date,
  dia_semana integer not null check (dia_semana between 1 and 5),
  hora_inicio time not null,
  hora_fim time not null,
  titulo text not null,
  responsavel_nome text,
  responsavel_email text,
  finalidade text,
  visivel boolean not null default false,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint laboratorio_reservas_horario_valido check (hora_fim > hora_inicio)
);

create index if not exists idx_laboratorios_ativos on public.laboratorios(ativo, nome);
create index if not exists idx_laboratorio_reservas_publico on public.laboratorio_reservas(laboratorio_id, status, visivel, data_reserva, dia_semana, hora_inicio);
create index if not exists idx_laboratorio_reservas_admin on public.laboratorio_reservas(status, origem, criado_em desc);


create or replace view public.laboratorio_reservas_publicas as
select
  id,
  laboratorio_id,
  tipo,
  status,
  origem,
  data_reserva,
  dia_semana,
  hora_inicio,
  hora_fim,
  titulo,
  responsavel_nome,
  finalidade,
  visivel,
  criado_em,
  atualizado_em
from public.laboratorio_reservas
where visivel = true and status = 'aprovada';

-- Reaproveita a função set_updated_at criada no schema-admin.sql.
drop trigger if exists trg_laboratorios_updated_at on public.laboratorios;
create trigger trg_laboratorios_updated_at
before update on public.laboratorios
for each row execute function public.set_updated_at();

drop trigger if exists trg_laboratorio_reservas_updated_at on public.laboratorio_reservas;
create trigger trg_laboratorio_reservas_updated_at
before update on public.laboratorio_reservas
for each row execute function public.set_updated_at();

-- Grants explícitos para uso com a chave pública no frontend e RLS abaixo.
grant select on public.laboratorios to anon, authenticated;
grant insert, update, delete on public.laboratorios to authenticated;

revoke insert on public.laboratorio_reservas from anon;
grant select, insert, update, delete on public.laboratorio_reservas to authenticated;
grant select on public.laboratorio_reservas_publicas to anon, authenticated;

grant execute on function public.current_user_is_site_admin() to anon, authenticated;

alter table public.laboratorios enable row level security;
alter table public.laboratorio_reservas enable row level security;

drop policy if exists "Publico le laboratorios ativos" on public.laboratorios;
drop policy if exists "Admins gerenciam laboratorios" on public.laboratorios;
drop policy if exists "Publico le reservas aprovadas" on public.laboratorio_reservas;
drop policy if exists "Publico solicita reservas" on public.laboratorio_reservas;
drop policy if exists "Aluno logado solicita reservas" on public.laboratorio_reservas;
drop policy if exists "Aluno le as proprias reservas" on public.laboratorio_reservas;
drop policy if exists "Admins leem todas reservas" on public.laboratorio_reservas;
drop policy if exists "Admins criam reservas" on public.laboratorio_reservas;
drop policy if exists "Admins atualizam reservas" on public.laboratorio_reservas;
drop policy if exists "Admins removem reservas" on public.laboratorio_reservas;

create policy "Publico le laboratorios ativos"
on public.laboratorios
for select
to anon, authenticated
using (ativo = true);

create policy "Admins gerenciam laboratorios"
on public.laboratorios
for all
to authenticated
using (public.current_user_is_site_admin())
with check (public.current_user_is_site_admin());

create policy "Aluno logado solicita reservas"
on public.laboratorio_reservas
for insert
to authenticated
with check (
  auth.uid() is not null
  and criado_por = auth.uid()
  and origem = 'aluno'
  and status = 'solicitada'
  and visivel = false
  and tipo = 'reserva'
);

create policy "Aluno le as proprias reservas"
on public.laboratorio_reservas
for select
to authenticated
using (criado_por = auth.uid());

create policy "Admins leem todas reservas"
on public.laboratorio_reservas
for select
to authenticated
using (public.current_user_is_site_admin());

create policy "Admins criam reservas"
on public.laboratorio_reservas
for insert
to authenticated
with check (public.current_user_is_site_admin());

create policy "Admins atualizam reservas"
on public.laboratorio_reservas
for update
to authenticated
using (public.current_user_is_site_admin())
with check (public.current_user_is_site_admin());

create policy "Admins removem reservas"
on public.laboratorio_reservas
for delete
to authenticated
using (public.current_user_is_site_admin());

insert into public.laboratorios (nome, codigo, localizacao, capacidade, descricao, ativo)
values
  ('Laboratório de Software 01', 'Lab 01', 'Bloco D', 30, 'Ambiente para aulas práticas, estudo e desenvolvimento de projetos.', true),
  ('Laboratório de Software 02', 'Lab 02', 'Bloco D', 30, 'Ambiente para programação, apresentações e atividades orientadas.', true),
  ('Laboratório Maker / Projetos', 'Maker', 'A definir', 20, 'Espaço preparado para projetos, protótipos e atividades integradoras.', true)
on conflict (nome) do nothing;

insert into public.laboratorio_reservas (
  laboratorio_id, tipo, status, origem, data_reserva, dia_semana,
  hora_inicio, hora_fim, titulo, responsavel_nome, finalidade, visivel
)
select id, 'manutencao', 'aprovada', 'admin', null, 3, '15:10', '16:40', 'Manutenção preventiva', 'Coordenação', 'Exemplo de bloqueio semanal para validar o módulo.', true
from public.laboratorios
where nome = 'Laboratório de Software 01'
on conflict do nothing;
