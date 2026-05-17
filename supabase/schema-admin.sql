-- ============================================================
-- Site Institucional de Engenharia de Software - IFPE BJ
-- Base Supabase da primeira entrega do painel administrativo
-- ============================================================
-- Como usar:
-- 1. Troque 'admin@ifpe.edu.br' pelo e-mail real do administrador.
-- 2. Rode este SQL no SQL Editor do Supabase.
-- 3. Configure assets/js/supabase-config.js com a URL e a chave pública.
-- 4. Crie a conta pelo botão "Acesso" do site usando o mesmo e-mail admin.
-- ============================================================

create extension if not exists pgcrypto;

-- E-mails autorizados a receber perfil administrativo no cadastro.
create table if not exists public.site_admin_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'admin' check (role in ('admin', 'editor')),
  ativo boolean not null default true,
  observacao text,
  criado_em timestamptz not null default now()
);

-- Perfil público/logado do usuário do site.
-- Todo cadastro recebe um perfil. Quem estiver em site_admin_emails entra como admin/editor.
create table if not exists public.site_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text,
  matricula text,
  email_alternativo text,
  role text not null default 'aluno' check (role in ('aluno', 'admin', 'editor')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Primeiro módulo administrável: publicações, projetos, notícias, eventos etc.
create table if not exists public.publicacoes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  slug text not null unique,
  categoria text not null default 'projeto' check (
    categoria in ('projeto', 'pesquisa', 'extensao', 'inovacao', 'evento', 'noticia', 'monitoria', 'oportunidade')
  ),
  resumo text not null,
  conteudo text,
  imagem_url text,
  link_externo text,
  visivel boolean not null default false,
  destaque_home boolean not null default false,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'oculto')),
  ordem integer not null default 0,
  publicado_em timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Compatibilidade para bancos que já tinham a tabela criada em entregas anteriores.
alter table public.site_profiles
  add column if not exists matricula text,
  add column if not exists email_alternativo text;

create index if not exists idx_site_profiles_role on public.site_profiles(role);
create index if not exists idx_publicacoes_status_visivel on public.publicacoes(status, visivel);
create index if not exists idx_publicacoes_destaque_home on public.publicacoes(destaque_home);
create index if not exists idx_publicacoes_categoria on public.publicacoes(categoria);

-- Atualização automática do campo atualizado_em.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_site_profiles_updated_at on public.site_profiles;
create trigger trg_site_profiles_updated_at
before update on public.site_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_publicacoes_updated_at on public.publicacoes;
create trigger trg_publicacoes_updated_at
before update on public.publicacoes
for each row execute function public.set_updated_at();

-- Cria perfil automaticamente quando um usuário novo é cadastrado no Supabase Auth.
create or replace function public.handle_new_site_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  detected_role text;
begin
  select sae.role
    into detected_role
  from public.site_admin_emails sae
  where lower(sae.email) = lower(new.email)
    and sae.ativo = true
  limit 1;

  insert into public.site_profiles (user_id, email, nome, matricula, email_alternativo, role, ativo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'matricula', ''),
    nullif(new.raw_user_meta_data ->> 'email_alternativo', ''),
    coalesce(detected_role, 'aluno'),
    true
  )
  on conflict (user_id) do update
    set email = excluded.email,
        nome = coalesce(public.site_profiles.nome, excluded.nome),
        matricula = coalesce(public.site_profiles.matricula, excluded.matricula),
        email_alternativo = coalesce(public.site_profiles.email_alternativo, excluded.email_alternativo),
        role = case
          when detected_role is not null then detected_role
          else public.site_profiles.role
        end,
        ativo = true,
        atualizado_em = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_site_profile on auth.users;
create trigger on_auth_user_created_site_profile
after insert on auth.users
for each row execute function public.handle_new_site_user();

-- Função usada pelas políticas para saber se a sessão atual é admin/editor.
create or replace function public.current_user_is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.site_profiles sp
    where sp.user_id = auth.uid()
      and sp.ativo = true
      and sp.role in ('admin', 'editor')
  );
$$;

-- Grants explícitos para projetos Supabase novos, onde tabelas públicas podem não ser expostas automaticamente à Data API.
grant select, insert, update, delete on public.publicacoes to authenticated;
grant select on public.publicacoes to anon;
grant select, insert, update on public.site_profiles to authenticated;
grant select, insert, update, delete on public.site_admin_emails to authenticated;
grant execute on function public.current_user_is_site_admin() to anon, authenticated;
grant execute on function public.handle_new_site_user() to authenticated;

-- RLS: sempre ligado.
alter table public.site_admin_emails enable row level security;
alter table public.site_profiles enable row level security;
alter table public.publicacoes enable row level security;

-- Limpeza segura para reexecutar o SQL durante testes.
drop policy if exists "Admins gerenciam e-mails autorizados" on public.site_admin_emails;
drop policy if exists "Usuario le o proprio perfil" on public.site_profiles;
drop policy if exists "Admin le todos os perfis" on public.site_profiles;
drop policy if exists "Usuario cria perfil proprio como aluno" on public.site_profiles;
drop policy if exists "Usuario atualiza apenas dados basicos do proprio perfil" on public.site_profiles;
drop policy if exists "Admin atualiza perfis" on public.site_profiles;
drop policy if exists "Publico le publicacoes publicadas" on public.publicacoes;
drop policy if exists "Admins leem todas as publicacoes" on public.publicacoes;
drop policy if exists "Admins criam publicacoes" on public.publicacoes;
drop policy if exists "Admins atualizam publicacoes" on public.publicacoes;
drop policy if exists "Admins removem publicacoes" on public.publicacoes;

-- site_admin_emails: somente admins já reconhecidos conseguem ler/gerenciar.
create policy "Admins gerenciam e-mails autorizados"
on public.site_admin_emails
for all
to authenticated
using (public.current_user_is_site_admin())
with check (public.current_user_is_site_admin());

-- site_profiles: usuário lê o próprio perfil; admin lê todos.
create policy "Usuario le o proprio perfil"
on public.site_profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "Admin le todos os perfis"
on public.site_profiles
for select
to authenticated
using (public.current_user_is_site_admin());

-- Fallback caso um usuário antigo não tenha perfil criado pelo trigger.
create policy "Usuario cria perfil proprio como aluno"
on public.site_profiles
for insert
to authenticated
with check (auth.uid() = user_id and role = 'aluno');

create policy "Usuario atualiza apenas dados basicos do proprio perfil"
on public.site_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id and role = 'aluno');

create policy "Admin atualiza perfis"
on public.site_profiles
for update
to authenticated
using (public.current_user_is_site_admin())
with check (public.current_user_is_site_admin());

-- publicacoes: visitantes só leem o que está publicado e visível.
create policy "Publico le publicacoes publicadas"
on public.publicacoes
for select
to anon, authenticated
using (status = 'publicado' and visivel = true);

create policy "Admins leem todas as publicacoes"
on public.publicacoes
for select
to authenticated
using (public.current_user_is_site_admin());

create policy "Admins criam publicacoes"
on public.publicacoes
for insert
to authenticated
with check (public.current_user_is_site_admin());

create policy "Admins atualizam publicacoes"
on public.publicacoes
for update
to authenticated
using (public.current_user_is_site_admin())
with check (public.current_user_is_site_admin());

create policy "Admins removem publicacoes"
on public.publicacoes
for delete
to authenticated
using (public.current_user_is_site_admin());

-- Troque este e-mail pelo seu e-mail real de administrador antes de cadastrar/entrar.
insert into public.site_admin_emails (email, role, ativo, observacao)
values ('admin@ifpe.edu.br', 'admin', true, 'Substitua pelo e-mail real do administrador do site')
on conflict (email) do update
  set role = excluded.role,
      ativo = excluded.ativo,
      observacao = excluded.observacao;

-- Opcional: uma publicação demonstrativa para testar o painel.
insert into public.publicacoes (
  titulo,
  slug,
  categoria,
  resumo,
  conteudo,
  visivel,
  destaque_home,
  status,
  ordem
)
values (
  'Publicação demonstrativa do painel',
  'publicacao-demonstrativa-do-painel',
  'noticia',
  'Este item serve apenas para validar a primeira integração do admin com o Supabase.',
  'Depois de validar o cadastro, login e listagem, esta publicação pode ser editada, ocultada ou removida pelo painel.',
  true,
  false,
  'publicado',
  0
)
on conflict (slug) do nothing;
