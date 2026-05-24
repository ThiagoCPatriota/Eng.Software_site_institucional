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



-- ============================================================
-- ADM RF 017: Configuração administrável da Home
-- ============================================================
create table if not exists public.site_home_config (
  id text primary key default 'principal' check (id = 'principal'),
  hero_kicker text not null default 'IFPE Campus Belo Jardim',
  hero_titulo text not null default 'Engenharia de Software',
  hero_subtitulo text not null default 'Formação pública, prática e conectada ao desenvolvimento de sistemas, projetos, inovação e impacto regional.',
  cta_primario_texto text not null default 'Conheça o curso',
  cta_primario_url text not null default 'sobre.html',
  cta_secundario_texto text not null default 'Veja formas de ingresso',
  cta_secundario_url text not null default 'ingresso.html',
  cta_terciario_texto text not null default 'Projetos e notícias',
  cta_terciario_url text not null default 'projetos.html',
  destaque_1_valor text not null default '8 períodos',
  destaque_1_rotulo text not null default 'Jornada acadêmica',
  destaque_2_valor text not null default 'Presencial',
  destaque_2_rotulo text not null default 'Vivência no campus e contato com docentes',
  destaque_3_valor text not null default 'Projetos e extensão',
  destaque_3_rotulo text not null default 'Prática, pesquisa, desafios e oportunidades reais',
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ADM RF 018: Controle de visibilidade das páginas públicas.
create table if not exists public.site_paginas_visibilidade (
  slug text primary key,
  titulo text not null,
  url text not null,
  grupo text not null default 'Geral',
  visivel boolean not null default true,
  ordem integer not null default 0,
  observacao text,
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

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


drop trigger if exists trg_site_home_config_updated_at on public.site_home_config;
create trigger trg_site_home_config_updated_at
before update on public.site_home_config
for each row execute function public.set_updated_at();

drop trigger if exists trg_site_paginas_visibilidade_updated_at on public.site_paginas_visibilidade;
create trigger trg_site_paginas_visibilidade_updated_at
before update on public.site_paginas_visibilidade
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

grant select on public.site_home_config to anon, authenticated;
grant insert, update, delete on public.site_home_config to authenticated;
grant select on public.site_paginas_visibilidade to anon, authenticated;
grant insert, update, delete on public.site_paginas_visibilidade to authenticated;

-- RLS: sempre ligado.
alter table public.site_admin_emails enable row level security;
alter table public.site_profiles enable row level security;
alter table public.publicacoes enable row level security;
alter table public.site_home_config enable row level security;
alter table public.site_paginas_visibilidade enable row level security;

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
drop policy if exists "Publico le configuracao da home" on public.site_home_config;
drop policy if exists "Admins gerenciam configuracao da home" on public.site_home_config;
drop policy if exists "Publico le visibilidade das paginas" on public.site_paginas_visibilidade;
drop policy if exists "Admins gerenciam visibilidade das paginas" on public.site_paginas_visibilidade;

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

-- Home: pública para leitura, administrável apenas por admin/editor.
create policy "Publico le configuracao da home"
on public.site_home_config
for select
to anon, authenticated
using (true);

create policy "Admins gerenciam configuracao da home"
on public.site_home_config
for all
to authenticated
using (public.current_user_is_site_admin())
with check (public.current_user_is_site_admin());

-- Páginas: público lê para esconder menu; admin gerencia visibilidade.
create policy "Publico le visibilidade das paginas"
on public.site_paginas_visibilidade
for select
to anon, authenticated
using (true);

create policy "Admins gerenciam visibilidade das paginas"
on public.site_paginas_visibilidade
for all
to authenticated
using (public.current_user_is_site_admin())
with check (public.current_user_is_site_admin());


-- Registro padrão da home administrável.
insert into public.site_home_config (id)
values ('principal')
on conflict (id) do nothing;

-- Páginas públicas controláveis pelo ADM RF 018.
insert into public.site_paginas_visibilidade (slug, titulo, url, grupo, ordem, observacao)
values
  ('inicio', 'Início', 'index.html', 'Geral', 1, 'Página inicial do site. Recomenda-se manter ativa.'),
  ('eventos', 'Notícias', 'eventos-noticias.html', 'Geral', 2, 'Canal de notícias, eventos, avisos e benefícios.'),
  ('sobre', 'Sobre o curso', 'sobre.html', 'Curso', 3, 'Informações gerais do curso.'),
  ('ingresso', 'Formas de ingresso', 'ingresso.html', 'Curso', 4, 'Orientação para candidatos e formas de entrada.'),
  ('grade', 'Grade curricular / PPC', 'grade.html', 'Curso', 5, 'Matriz curricular e PPC do curso.'),
  ('aprovados-remanejados', 'Chamadas e vínculo', 'aprovados-remanejados.html', 'Curso', 6, 'Aprovados, remanejamento, matrícula, rematrícula e reingresso.'),
  ('projetos', 'Projetos', 'projetos.html', 'Geral', 7, 'Pesquisa, extensão, inovação e monitorias.'),
  ('editais', 'Editais', 'editais.html', 'Geral', 8, 'Editais e comunicados relacionados.'),
  ('servicos', 'Outros serviços', 'outros-servicos.html', 'Geral', 9, 'Biblioteca, atividades complementares, TCC e serviços úteis.'),
  ('estrutura', 'Ambientes', 'estrutura.html', 'Estrutura', 10, 'Ambientes e infraestrutura do campus.'),
  ('docentes', 'Docentes', 'docentes.html', 'Estrutura', 11, 'Equipe docente e coordenação.'),
  ('area-aluno', 'Área do aluno', 'area-aluno.html', 'Aluno', 12, 'Painel básico do aluno logado.'),
  ('horarios', 'Horário de aulas', 'horarios.html', 'Aluno', 13, 'Horários de aula por período.'),
  ('laboratorios', 'Horário dos laboratórios', 'laboratorios.html', 'Aluno', 14, 'Disponibilidade e reservas de laboratórios.'),
  ('contato', 'Coordenação e contato', 'contato.html', 'Contato', 15, 'Contato institucional do curso.'),
  ('faq', 'FAQ', 'faq.html', 'Contato', 16, 'Dúvidas frequentes e renovação de cadeiras.')
on conflict (slug) do update
  set titulo = excluded.titulo,
      url = excluded.url,
      grupo = excluded.grupo,
      ordem = excluded.ordem,
      observacao = excluded.observacao;

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
