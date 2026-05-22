-- ============================================================
-- Site Institucional de Engenharia de Software - IFPE BJ
-- RF 009 - Eventos, notícias e destaques do campus
-- ============================================================
-- Como usar:
-- 1. Rode depois de supabase/schema-admin.sql.
-- 2. O admin cadastra conteúdos em admin/eventos.html.
-- 3. Conteúdos publicados/visíveis aparecem em projetos.html#eventos-campus.
-- 4. Conteúdos com destaque_home aparecem no Mural Acadêmico da home.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.noticias_eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  slug text not null unique,
  tipo text not null default 'evento' check (tipo in ('evento', 'noticia', 'aviso', 'beneficio')),
  resumo text not null,
  conteudo text,
  imagem_url text,
  imagem_path text,
  link_externo text,
  link_rotulo text,
  local text,
  organizador text,
  email_contato text,
  data_inicio date,
  data_fim date,
  hora_inicio time,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'oculto')),
  visivel boolean not null default false,
  destaque_home boolean not null default false,
  ordem integer not null default 0,
  publicado_em timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_noticias_eventos_tipo on public.noticias_eventos(tipo);
create index if not exists idx_noticias_eventos_status_visivel on public.noticias_eventos(status, visivel);
create index if not exists idx_noticias_eventos_home on public.noticias_eventos(destaque_home);
create index if not exists idx_noticias_eventos_data on public.noticias_eventos(data_inicio desc);

alter table public.noticias_eventos
  add column if not exists email_contato text,
  add column if not exists imagem_path text,
  add column if not exists link_rotulo text;

-- Reaproveita public.set_updated_at() criada no schema-admin.sql.
drop trigger if exists trg_noticias_eventos_updated_at on public.noticias_eventos;
create trigger trg_noticias_eventos_updated_at
before update on public.noticias_eventos
for each row execute function public.set_updated_at();

-- View pública: só entrega conteúdos realmente publicados e visíveis.
-- A view é recriada para aceitar novas colunas sem conflito de ordem/nome.
drop view if exists public.noticias_eventos_publicos;
create view public.noticias_eventos_publicos as
select
  id,
  titulo,
  slug,
  tipo,
  resumo,
  conteudo,
  imagem_url,
  imagem_path,
  link_externo,
  link_rotulo,
  local,
  organizador,
  email_contato,
  data_inicio,
  data_fim,
  hora_inicio,
  destaque_home,
  ordem,
  publicado_em,
  atualizado_em
from public.noticias_eventos
where status = 'publicado'
  and visivel = true;

-- Grants explícitos para Data API.
grant select on public.noticias_eventos to anon, authenticated;
grant insert, update, delete on public.noticias_eventos to authenticated;
grant select on public.noticias_eventos_publicos to anon, authenticated;

alter table public.noticias_eventos enable row level security;

drop policy if exists "Publico le eventos e noticias publicados" on public.noticias_eventos;
drop policy if exists "Admins leem todos os eventos e noticias" on public.noticias_eventos;
drop policy if exists "Admins criam eventos e noticias" on public.noticias_eventos;
drop policy if exists "Admins atualizam eventos e noticias" on public.noticias_eventos;
drop policy if exists "Admins removem eventos e noticias" on public.noticias_eventos;

create policy "Publico le eventos e noticias publicados"
on public.noticias_eventos
for select
to anon, authenticated
using (status = 'publicado' and visivel = true);

create policy "Admins leem todos os eventos e noticias"
on public.noticias_eventos
for select
to authenticated
using (public.current_user_is_site_admin());

create policy "Admins criam eventos e noticias"
on public.noticias_eventos
for insert
to authenticated
with check (public.current_user_is_site_admin());

create policy "Admins atualizam eventos e noticias"
on public.noticias_eventos
for update
to authenticated
using (public.current_user_is_site_admin())
with check (public.current_user_is_site_admin());

create policy "Admins removem eventos e noticias"
on public.noticias_eventos
for delete
to authenticated
using (public.current_user_is_site_admin());

-- Storage público para imagens enviadas pelo administrador.
-- A leitura é pública; upload/alteração/remoção ficam restritos a admin/editor.
insert into storage.buckets (id, name, public)
values ('noticias-eventos-imagens', 'noticias-eventos-imagens', true)
on conflict (id) do update set public = true;

drop policy if exists "Eventos imagens leitura publica" on storage.objects;
drop policy if exists "Eventos imagens admin upload" on storage.objects;
drop policy if exists "Eventos imagens admin atualiza" on storage.objects;
drop policy if exists "Eventos imagens admin remove" on storage.objects;

create policy "Eventos imagens leitura publica"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'noticias-eventos-imagens');

create policy "Eventos imagens admin upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'noticias-eventos-imagens'
  and public.current_user_is_site_admin()
);

create policy "Eventos imagens admin atualiza"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'noticias-eventos-imagens'
  and public.current_user_is_site_admin()
)
with check (
  bucket_id = 'noticias-eventos-imagens'
  and public.current_user_is_site_admin()
);

create policy "Eventos imagens admin remove"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'noticias-eventos-imagens'
  and public.current_user_is_site_admin()
);

-- Conteúdos demonstrativos para teste inicial.
insert into public.noticias_eventos (
  titulo,
  slug,
  tipo,
  resumo,
  conteudo,
  local,
  organizador,
  email_contato,
  data_inicio,
  hora_inicio,
  status,
  visivel,
  destaque_home,
  ordem,
  publicado_em
)
values
(
  'Jardim Digital',
  'jardim-digital',
  'evento',
  'Evento de tecnologia do campus com palestras, oficinas e integração com a comunidade acadêmica.',
  'Conteúdo demonstrativo para validar a visualização pública dos eventos do campus.',
  'IFPE Campus Belo Jardim',
  'Curso de Engenharia de Software',
  'coord.es@belojardim.ifpe.edu.br',
  null,
  null,
  'publicado',
  true,
  true,
  1,
  now()
),
(
  'Aniversário do IFPE',
  'aniversario-do-ifpe',
  'noticia',
  'Comemoração institucional e ações de integração com estudantes, servidores e comunidade.',
  'Notícia demonstrativa para validar o mural de notícias institucionais.',
  'Campus Belo Jardim',
  'IFPE',
  'comunicacao@belojardim.ifpe.edu.br',
  null,
  null,
  'publicado',
  true,
  true,
  2,
  now()
)
on conflict (slug) do nothing;
