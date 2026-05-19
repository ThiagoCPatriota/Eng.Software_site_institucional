-- ============================================================
-- Módulo de Horários de Aulas - Site Institucional ES IFPE BJ
-- Rode depois do supabase/schema-admin.sql
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.horarios_aulas (
  id uuid primary key default gen_random_uuid(),
  semestre_letivo text not null default '2026.1',
  turma text,
  periodo integer not null check (periodo between 1 and 8),
  turno text not null default 'manha' check (turno in ('manha', 'tarde', 'noite')),
  dia_semana integer not null check (dia_semana between 1 and 5),
  tipo text not null default 'aula' check (tipo in ('aula', 'intervalo', 'atividade')),
  hora_inicio time not null,
  hora_fim time not null,
  disciplina text not null,
  professor text,
  sala text,
  observacao text,
  visivel boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint horarios_aulas_horario_valido check (hora_fim > hora_inicio),
  constraint horarios_aulas_slot_unique unique (semestre_letivo, turma, periodo, turno, dia_semana, hora_inicio, hora_fim, disciplina)
);

-- Ajustes evolutivos caso a tabela já exista de uma entrega anterior.
alter table public.horarios_aulas drop column if exists ordem;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'horarios_aulas'
      and constraint_name = 'horarios_aulas_periodo_check'
  ) then
    alter table public.horarios_aulas drop constraint horarios_aulas_periodo_check;
  end if;

  alter table public.horarios_aulas
    add constraint horarios_aulas_periodo_check check (periodo between 1 and 8);
end $$;

create index if not exists idx_horarios_aulas_publico on public.horarios_aulas(semestre_letivo, periodo, turno, visivel);
create index if not exists idx_horarios_aulas_grade on public.horarios_aulas(periodo, turno, dia_semana, hora_inicio);

-- Reaproveita a função set_updated_at criada no schema-admin.sql.
drop trigger if exists trg_horarios_aulas_updated_at on public.horarios_aulas;
create trigger trg_horarios_aulas_updated_at
before update on public.horarios_aulas
for each row execute function public.set_updated_at();

-- Grants explícitos para uso com a chave pública no frontend e RLS abaixo.
grant select on public.horarios_aulas to anon;
grant select, insert, update, delete on public.horarios_aulas to authenticated;

grant execute on function public.current_user_is_site_admin() to anon, authenticated;

alter table public.horarios_aulas enable row level security;

drop policy if exists "Publico le horarios visiveis" on public.horarios_aulas;
drop policy if exists "Admins leem todos os horarios" on public.horarios_aulas;
drop policy if exists "Admins criam horarios" on public.horarios_aulas;
drop policy if exists "Admins atualizam horarios" on public.horarios_aulas;
drop policy if exists "Admins removem horarios" on public.horarios_aulas;

create policy "Publico le horarios visiveis"
on public.horarios_aulas
for select
to anon, authenticated
using (visivel = true);

create policy "Admins leem todos os horarios"
on public.horarios_aulas
for select
to authenticated
using (public.current_user_is_site_admin());

create policy "Admins criam horarios"
on public.horarios_aulas
for insert
to authenticated
with check (public.current_user_is_site_admin());

create policy "Admins atualizam horarios"
on public.horarios_aulas
for update
to authenticated
using (public.current_user_is_site_admin())
with check (public.current_user_is_site_admin());

create policy "Admins removem horarios"
on public.horarios_aulas
for delete
to authenticated
using (public.current_user_is_site_admin());

-- Exemplo opcional baseado no padrão do horário 2026.1.
-- Pode apagar depois do teste e preencher tudo pelo painel.
insert into public.horarios_aulas (
  semestre_letivo, turma, periodo, turno, dia_semana, tipo,
  hora_inicio, hora_fim, disciplina, professor, visivel
)
values
  ('2026.1', '2025.2', 2, 'tarde', 1, 'aula', '13:30', '14:15', 'Cálculo Aplicado à Informática', 'Sidmar', true),
  ('2026.1', '2025.2', 2, 'tarde', 1, 'aula', '14:15', '15:00', 'Cálculo Aplicado à Informática', 'Sidmar', true),
  ('2026.1', '2025.2', 2, 'tarde', 1, 'intervalo', '15:00', '15:10', 'Intervalo', null, true),
  ('2026.1', '2025.2', 2, 'tarde', 1, 'aula', '15:10', '15:55', 'Cálculo Aplicado à Informática', 'Sidmar', true),
  ('2026.1', '2024.2', 4, 'manha', 1, 'aula', '07:30', '08:15', 'Economia para Engenharia de Software', 'Fábio', true),
  ('2026.1', '2024.2', 4, 'manha', 1, 'aula', '08:15', '09:00', 'Economia para Engenharia de Software', 'Fábio', true),
  ('2026.1', '2024.2', 4, 'manha', 1, 'intervalo', '09:00', '09:15', 'Intervalo', null, true),
  ('2026.1', '2024.2', 4, 'manha', 1, 'aula', '09:15', '10:00', 'Economia para Engenharia de Software', 'Fábio', true)
on conflict do nothing;
