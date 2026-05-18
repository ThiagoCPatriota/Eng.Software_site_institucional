-- ============================================================
-- Site Institucional de Engenharia de Software - IFPE BJ
-- Módulo de Docentes / Equipe do curso
-- ============================================================
-- Como usar:
-- 1. Rode primeiro supabase/schema-admin.sql.
-- 2. Depois rode este arquivo no SQL Editor do Supabase.
-- 3. Acesse admin/docentes.html com uma conta admin/editor.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.docentes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  funcao text not null default 'docente' check (
    funcao in ('docente', 'coordenacao', 'docente_coordenacao', 'apoio_academico')
  ),
  formacao text,
  area_atuacao text,
  historico text,
  projetos_interesses text,
  email text,
  telefone text,
  contato_preferencial text not null default 'email' check (
    contato_preferencial in ('email', 'telefone', 'ambos', 'nenhum')
  ),
  lattes_url text,
  imagem_url text,
  ativo boolean not null default true,
  destaque boolean not null default false,
  ordem integer not null default 0,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.docentes
  add column if not exists funcao text not null default 'docente',
  add column if not exists formacao text,
  add column if not exists area_atuacao text,
  add column if not exists historico text,
  add column if not exists projetos_interesses text,
  add column if not exists email text,
  add column if not exists telefone text,
  add column if not exists contato_preferencial text not null default 'email',
  add column if not exists lattes_url text,
  add column if not exists imagem_url text,
  add column if not exists ativo boolean not null default true,
  add column if not exists destaque boolean not null default false,
  add column if not exists ordem integer not null default 0,
  add column if not exists criado_por uuid references auth.users(id) on delete set null,
  add column if not exists atualizado_por uuid references auth.users(id) on delete set null,
  add column if not exists criado_em timestamptz not null default now(),
  add column if not exists atualizado_em timestamptz not null default now();

create index if not exists idx_docentes_ativo on public.docentes(ativo);
create index if not exists idx_docentes_funcao on public.docentes(funcao);
create index if not exists idx_docentes_destaque_ordem on public.docentes(destaque, ordem);

-- Atualização automática do campo atualizado_em, usando a função do schema-admin.sql.
drop trigger if exists trg_docentes_updated_at on public.docentes;
create trigger trg_docentes_updated_at
before update on public.docentes
for each row execute function public.set_updated_at();

-- View pública opcional para consultas mais enxutas.
create or replace view public.docentes_publicos as
select
  id,
  nome,
  slug,
  funcao,
  formacao,
  area_atuacao,
  historico,
  projetos_interesses,
  case when contato_preferencial in ('email', 'ambos') then email else null end as email,
  case when contato_preferencial in ('telefone', 'ambos') then telefone else null end as telefone,
  contato_preferencial,
  lattes_url,
  imagem_url,
  destaque,
  ordem,
  atualizado_em
from public.docentes
where ativo = true;

-- Grants explícitos para Data API.
grant select on public.docentes to anon, authenticated;
grant insert, update, delete on public.docentes to authenticated;
grant select on public.docentes_publicos to anon, authenticated;
grant execute on function public.current_user_is_site_admin() to anon, authenticated;

alter table public.docentes enable row level security;

drop policy if exists "Publico le docentes ativos" on public.docentes;
drop policy if exists "Admins leem todos os docentes" on public.docentes;
drop policy if exists "Admins criam docentes" on public.docentes;
drop policy if exists "Admins atualizam docentes" on public.docentes;
drop policy if exists "Admins removem docentes" on public.docentes;

create policy "Publico le docentes ativos"
on public.docentes
for select
to anon, authenticated
using (ativo = true);

create policy "Admins leem todos os docentes"
on public.docentes
for select
to authenticated
using (public.current_user_is_site_admin());

create policy "Admins criam docentes"
on public.docentes
for insert
to authenticated
with check (public.current_user_is_site_admin());

create policy "Admins atualizam docentes"
on public.docentes
for update
to authenticated
using (public.current_user_is_site_admin())
with check (public.current_user_is_site_admin());

create policy "Admins removem docentes"
on public.docentes
for delete
to authenticated
using (public.current_user_is_site_admin());
