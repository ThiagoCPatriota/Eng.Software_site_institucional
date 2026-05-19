-- ============================================================
-- Requisito - Candidatura/voluntariado em oportunidades de monitoria
-- Rode depois de:
-- 1. supabase/schema-admin.sql
-- 2. supabase/schema-requisitos-13-20.sql
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.monitoria_candidaturas (
  id uuid primary key default gen_random_uuid(),
  oportunidade_id uuid not null references public.monitorias_oportunidades(id) on delete cascade,
  responsavel_nome text not null,
  responsavel_email text not null,
  responsavel_matricula text not null,
  motivo text,
  experiencia_nivel text check (experiencia_nivel is null or experiencia_nivel in ('iniciante', 'intermediario', 'avancado')),
  disponibilidade text,
  aceita_avaliacao boolean,
  mensagem text,
  status text not null default 'solicitada' check (status in ('solicitada', 'em_analise', 'aprovada', 'recusada', 'cancelada')),
  feedback_admin text,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  avaliado_por uuid references auth.users(id) on delete set null,
  avaliado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);


alter table public.monitoria_candidaturas
  add column if not exists motivo text,
  add column if not exists experiencia_nivel text,
  add column if not exists disponibilidade text,
  add column if not exists aceita_avaliacao boolean;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'monitoria_candidaturas_experiencia_check'
      and conrelid = 'public.monitoria_candidaturas'::regclass
  ) then
    alter table public.monitoria_candidaturas
      add constraint monitoria_candidaturas_experiencia_check
      check (experiencia_nivel is null or experiencia_nivel in ('iniciante', 'intermediario', 'avancado'));
  end if;
end $$;

create unique index if not exists idx_monitoria_candidaturas_usuario_oportunidade
on public.monitoria_candidaturas(criado_por, oportunidade_id)
where criado_por is not null;

create index if not exists idx_monitoria_candidaturas_oportunidade
on public.monitoria_candidaturas(oportunidade_id, criado_em desc);

create index if not exists idx_monitoria_candidaturas_status
on public.monitoria_candidaturas(status, criado_em desc);

create index if not exists idx_monitoria_candidaturas_criado_por
on public.monitoria_candidaturas(criado_por, criado_em desc);

drop trigger if exists trg_monitoria_candidaturas_updated_at on public.monitoria_candidaturas;
create trigger trg_monitoria_candidaturas_updated_at
before update on public.monitoria_candidaturas
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.monitoria_candidaturas to authenticated;
grant select on public.monitoria_candidaturas to anon;

alter table public.monitoria_candidaturas enable row level security;

drop policy if exists "Aluno cria candidatura propria de monitoria" on public.monitoria_candidaturas;
drop policy if exists "Aluno le candidaturas proprias de monitoria" on public.monitoria_candidaturas;
drop policy if exists "Aluno cancela candidatura propria de monitoria" on public.monitoria_candidaturas;
drop policy if exists "Admins leem candidaturas de monitoria" on public.monitoria_candidaturas;
drop policy if exists "Admins atualizam candidaturas de monitoria" on public.monitoria_candidaturas;
drop policy if exists "Admins removem candidaturas de monitoria" on public.monitoria_candidaturas;

create policy "Aluno cria candidatura propria de monitoria"
on public.monitoria_candidaturas
for insert
to authenticated
with check (
  auth.uid() is not null
  and criado_por = auth.uid()
  and status = 'solicitada'
  and nullif(responsavel_matricula, '') is not null
  and exists (
    select 1
    from public.site_profiles sp
    where sp.user_id = auth.uid()
      and sp.ativo = true
      and nullif(sp.matricula, '') = nullif(monitoria_candidaturas.responsavel_matricula, '')
  )
  and exists (
    select 1
    from public.monitorias_oportunidades mo
    where mo.id = monitoria_candidaturas.oportunidade_id
      and mo.status = 'publicado'
      and mo.visivel = true
  )
);

create policy "Aluno le candidaturas proprias de monitoria"
on public.monitoria_candidaturas
for select
to authenticated
using (criado_por = auth.uid());

create policy "Aluno cancela candidatura propria de monitoria"
on public.monitoria_candidaturas
for update
to authenticated
using (criado_por = auth.uid() and status in ('solicitada', 'em_analise'))
with check (criado_por = auth.uid() and status = 'cancelada');

create policy "Admins leem candidaturas de monitoria"
on public.monitoria_candidaturas
for select
to authenticated
using (public.current_user_is_site_admin());

create policy "Admins atualizam candidaturas de monitoria"
on public.monitoria_candidaturas
for update
to authenticated
using (public.current_user_is_site_admin())
with check (public.current_user_is_site_admin());

create policy "Admins removem candidaturas de monitoria"
on public.monitoria_candidaturas
for delete
to authenticated
using (public.current_user_is_site_admin());
