-- ============================================================
-- Site Institucional de Engenharia de Software - IFPE BJ
-- Entrega 25 - RF 013 a RF 020
-- Monitorias, outros serviços, editais e informações de ingresso
-- ============================================================
-- Como usar:
-- 1. Rode depois de supabase/schema-admin.sql.
-- 2. Acesse os novos módulos no painel administrativo.
-- 3. As páginas públicas leem apenas itens publicados e visíveis.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- RF 013 - Oportunidades de monitoria
-- ------------------------------------------------------------
create table if not exists public.monitorias_oportunidades (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  slug text not null unique,
  disciplina text,
  tipo text not null default 'voluntaria' check (tipo in ('bolsista', 'voluntaria', 'mista')),
  vagas integer not null default 0 check (vagas >= 0),
  carga_horaria text,
  professor text,
  inscricao_inicio date,
  inscricao_fim date,
  resumo text not null,
  requisitos text,
  descricao text,
  link_externo text,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'oculto')),
  visivel boolean not null default false,
  publicado_em timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_monitorias_status_visivel on public.monitorias_oportunidades(status, visivel);
create index if not exists idx_monitorias_tipo on public.monitorias_oportunidades(tipo);
create index if not exists idx_monitorias_prazo on public.monitorias_oportunidades(inscricao_fim);

drop trigger if exists trg_monitorias_updated_at on public.monitorias_oportunidades;
create trigger trg_monitorias_updated_at
before update on public.monitorias_oportunidades
for each row execute function public.set_updated_at();

create or replace view public.monitorias_publicas as
select
  id, titulo, slug, disciplina, tipo, vagas, carga_horaria, professor,
  inscricao_inicio, inscricao_fim, resumo, requisitos, descricao, link_externo,
  publicado_em, criado_em, atualizado_em
from public.monitorias_oportunidades
where status = 'publicado' and visivel = true;

-- ------------------------------------------------------------
-- RF 014-016 - Outros serviços
-- ------------------------------------------------------------
create table if not exists public.outros_servicos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  slug text not null unique,
  tipo text not null default 'outro' check (tipo in ('biblioteca', 'atividades_complementares', 'tcc', 'outro')),
  descricao text not null,
  link_url text not null,
  link_label text not null default 'Acessar serviço',
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'oculto')),
  visivel boolean not null default false,
  ordem integer not null default 0,
  publicado_em timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_outros_servicos_status_visivel on public.outros_servicos(status, visivel);
create index if not exists idx_outros_servicos_tipo on public.outros_servicos(tipo);
create index if not exists idx_outros_servicos_ordem on public.outros_servicos(ordem);

drop trigger if exists trg_outros_servicos_updated_at on public.outros_servicos;
create trigger trg_outros_servicos_updated_at
before update on public.outros_servicos
for each row execute function public.set_updated_at();

create or replace view public.outros_servicos_publicos as
select id, titulo, slug, tipo, descricao, link_url, link_label, ordem, publicado_em, criado_em, atualizado_em
from public.outros_servicos
where status = 'publicado' and visivel = true;

-- ------------------------------------------------------------
-- RF 017 - Editais
-- ------------------------------------------------------------
create table if not exists public.editais (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  slug text not null unique,
  categoria text not null default 'geral' check (categoria in ('moradia', 'manutencao', 'auxilio', 'selecao', 'geral')),
  numero text,
  resumo text not null,
  descricao text,
  data_publicacao date,
  data_limite date,
  orgao text,
  link_documento text,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'oculto')),
  visivel boolean not null default false,
  publicado_em timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_editais_status_visivel on public.editais(status, visivel);
create index if not exists idx_editais_categoria on public.editais(categoria);
create index if not exists idx_editais_data_publicacao on public.editais(data_publicacao);

drop trigger if exists trg_editais_updated_at on public.editais;
create trigger trg_editais_updated_at
before update on public.editais
for each row execute function public.set_updated_at();

create or replace view public.editais_publicos as
select id, titulo, slug, categoria, numero, resumo, descricao, data_publicacao, data_limite, orgao, link_documento, publicado_em, criado_em, atualizado_em
from public.editais
where status = 'publicado' and visivel = true;

-- ------------------------------------------------------------
-- RF 018-020 - Informações de ingresso
-- ------------------------------------------------------------
create table if not exists public.ingresso_informacoes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  slug text not null unique,
  tipo text not null default 'geral' check (tipo in ('inscricoes', 'aprovados', 'remanejamento', 'matricula', 'rematricula', 'reingresso', 'geral')),
  resumo text not null,
  conteudo text,
  data_inicio date,
  data_fim date,
  link_url text,
  link_label text not null default 'Acessar informação',
  documento_path text,
  documento_nome text,
  documento_tamanho bigint,
  documento_tipo text,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'oculto')),
  visivel boolean not null default false,
  destaque boolean not null default false,
  ordem integer not null default 0,
  publicado_em timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Migração segura para bases que já tinham o módulo de ingresso criado.
alter table public.ingresso_informacoes add column if not exists documento_path text;
alter table public.ingresso_informacoes add column if not exists documento_nome text;
alter table public.ingresso_informacoes add column if not exists documento_tamanho bigint;
alter table public.ingresso_informacoes add column if not exists documento_tipo text;

alter table public.ingresso_informacoes
  drop constraint if exists ingresso_informacoes_tipo_check;

update public.ingresso_informacoes
set tipo = 'aprovados'
where tipo = 'aprovados_remanejamento';

update public.ingresso_informacoes
set tipo = 'matricula'
where tipo = 'matricula_rematricula';

alter table public.ingresso_informacoes
  add constraint ingresso_informacoes_tipo_check
  check (tipo in ('inscricoes', 'aprovados', 'remanejamento', 'matricula', 'rematricula', 'reingresso', 'geral'));

create index if not exists idx_ingresso_info_status_visivel on public.ingresso_informacoes(status, visivel);
create index if not exists idx_ingresso_info_tipo on public.ingresso_informacoes(tipo);
create index if not exists idx_ingresso_info_ordem on public.ingresso_informacoes(ordem);

drop trigger if exists trg_ingresso_info_updated_at on public.ingresso_informacoes;
create trigger trg_ingresso_info_updated_at
before update on public.ingresso_informacoes
for each row execute function public.set_updated_at();

create or replace view public.ingresso_informacoes_publicas as
select
  id, titulo, slug, tipo, resumo, conteudo, data_inicio, data_fim,
  link_url, link_label, documento_nome, documento_tamanho, documento_tipo,
  destaque, ordem, publicado_em, criado_em, atualizado_em
from public.ingresso_informacoes
where status = 'publicado' and visivel = true;

-- ------------------------------------------------------------
-- Storage para PDFs de ingresso, aprovados e remanejamento
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ingresso-documentos',
  'ingresso-documentos',
  true,
  20971520,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Ingresso documentos leitura publica" on storage.objects;
drop policy if exists "Ingresso documentos admin upload" on storage.objects;
drop policy if exists "Ingresso documentos admin atualiza" on storage.objects;
drop policy if exists "Ingresso documentos admin remove" on storage.objects;

create policy "Ingresso documentos leitura publica"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'ingresso-documentos');

create policy "Ingresso documentos admin upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'ingresso-documentos'
  and public.current_user_is_site_admin()
);

create policy "Ingresso documentos admin atualiza"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'ingresso-documentos'
  and public.current_user_is_site_admin()
)
with check (
  bucket_id = 'ingresso-documentos'
  and public.current_user_is_site_admin()
);

create policy "Ingresso documentos admin remove"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'ingresso-documentos'
  and public.current_user_is_site_admin()
);

-- ------------------------------------------------------------
-- Grants explícitos para Data API
-- ------------------------------------------------------------
grant select on public.monitorias_publicas to anon, authenticated;
grant select on public.outros_servicos_publicos to anon, authenticated;
grant select on public.editais_publicos to anon, authenticated;
grant select on public.ingresso_informacoes_publicas to anon, authenticated;

grant select on public.monitorias_oportunidades to anon, authenticated;
grant select on public.outros_servicos to anon, authenticated;
grant select on public.editais to anon, authenticated;
grant select on public.ingresso_informacoes to anon, authenticated;

grant insert, update, delete on public.monitorias_oportunidades to authenticated;
grant insert, update, delete on public.outros_servicos to authenticated;
grant insert, update, delete on public.editais to authenticated;
grant insert, update, delete on public.ingresso_informacoes to authenticated;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.monitorias_oportunidades enable row level security;
alter table public.outros_servicos enable row level security;
alter table public.editais enable row level security;
alter table public.ingresso_informacoes enable row level security;

drop policy if exists "Publico le monitorias publicadas" on public.monitorias_oportunidades;
drop policy if exists "Admins gerenciam monitorias" on public.monitorias_oportunidades;
drop policy if exists "Publico le servicos publicados" on public.outros_servicos;
drop policy if exists "Admins gerenciam servicos" on public.outros_servicos;
drop policy if exists "Publico le editais publicados" on public.editais;
drop policy if exists "Admins gerenciam editais" on public.editais;
drop policy if exists "Publico le ingresso publicado" on public.ingresso_informacoes;
drop policy if exists "Admins gerenciam ingresso" on public.ingresso_informacoes;

create policy "Publico le monitorias publicadas"
on public.monitorias_oportunidades
for select
to anon, authenticated
using (status = 'publicado' and visivel = true);

create policy "Admins gerenciam monitorias"
on public.monitorias_oportunidades
for all
to authenticated
using (public.current_user_is_site_admin())
with check (public.current_user_is_site_admin());

create policy "Publico le servicos publicados"
on public.outros_servicos
for select
to anon, authenticated
using (status = 'publicado' and visivel = true);

create policy "Admins gerenciam servicos"
on public.outros_servicos
for all
to authenticated
using (public.current_user_is_site_admin())
with check (public.current_user_is_site_admin());

create policy "Publico le editais publicados"
on public.editais
for select
to anon, authenticated
using (status = 'publicado' and visivel = true);

create policy "Admins gerenciam editais"
on public.editais
for all
to authenticated
using (public.current_user_is_site_admin())
with check (public.current_user_is_site_admin());

create policy "Publico le ingresso publicado"
on public.ingresso_informacoes
for select
to anon, authenticated
using (status = 'publicado' and visivel = true);

create policy "Admins gerenciam ingresso"
on public.ingresso_informacoes
for all
to authenticated
using (public.current_user_is_site_admin())
with check (public.current_user_is_site_admin());

-- ------------------------------------------------------------
-- Dados demonstrativos iniciais
-- ------------------------------------------------------------
insert into public.monitorias_oportunidades (titulo, slug, disciplina, tipo, vagas, carga_horaria, professor, inscricao_inicio, inscricao_fim, resumo, requisitos, descricao, link_externo, status, visivel, publicado_em)
values
('Monitoria de Algoritmos e Estruturas de Dados', 'monitoria-algoritmos-estruturas-dados', 'Algoritmos e Estruturas de Dados', 'voluntaria', 2, '6h semanais', 'A definir', current_date, current_date + 20, 'Apoio a estudantes em listas, revisão de conceitos e prática de programação.', 'Ter cursado ou estar cursando a disciplina com bom desempenho.', 'Oportunidade demonstrativa para validar a área de monitorias.', null, 'publicado', true, now())
on conflict (slug) do nothing;

insert into public.outros_servicos (titulo, slug, tipo, descricao, link_url, link_label, status, visivel, ordem, publicado_em)
values
('Biblioteca Geral do curso', 'biblioteca-geral-curso', 'biblioteca', 'Acesso à biblioteca local do curso e materiais de apoio acadêmico.', 'https://example.com/biblioteca', 'Acessar biblioteca', 'publicado', true, 1, now()),
('Atividades Complementares', 'atividades-complementares', 'atividades_complementares', 'Orientações, regras e acompanhamento sobre atividades complementares.', 'https://example.com/atividades-complementares', 'Ver orientações', 'publicado', true, 2, now()),
('Trabalho de Conclusão de Curso', 'orientacoes-tcc', 'tcc', 'Informações sobre etapas, documentação, prazos e orientações para TCC.', 'https://example.com/tcc', 'Acessar orientações', 'publicado', true, 3, now())
on conflict (slug) do nothing;

insert into public.editais (titulo, slug, categoria, numero, resumo, descricao, data_publicacao, data_limite, orgao, link_documento, status, visivel, publicado_em)
values
('Edital demonstrativo de auxílio estudantil', 'edital-demonstrativo-auxilio-estudantil', 'auxilio', '01/2026', 'Exemplo de edital para validar a página pública de editais.', 'Substitua por editais reais quando disponíveis.', current_date, current_date + 30, 'Setor responsável', null, 'publicado', true, now())
on conflict (slug) do nothing;

insert into public.ingresso_informacoes (titulo, slug, tipo, resumo, conteudo, data_inicio, data_fim, link_url, link_label, status, visivel, destaque, ordem, publicado_em)
values
('Período de inscrições demonstrativo', 'periodo-inscricoes-demonstrativo', 'inscricoes', 'Exemplo de período de inscrição para validar a seção dinâmica.', 'Substitua pelas datas oficiais quando forem divulgadas.', current_date, current_date + 15, 'https://ingresso.ifpe.edu.br/inscricao/', 'Acessar Ingresso IFPE', 'publicado', true, true, 1, now()),
('Lista de aprovados demonstrativa', 'lista-aprovados-demonstrativa', 'aprovados', 'Área preparada para PDF ou link oficial de lista de aprovados.', 'Cadastre aqui chamadas oficiais, listas e orientações quando houver.', null, null, 'https://ingresso.ifpe.edu.br/inscricao/', 'Ver lista oficial', 'publicado', true, false, 2, now()),
('Remanejamento demonstrativo', 'remanejamento-demonstrativo', 'remanejamento', 'Área preparada para chamadas, remanejamentos e convocações complementares.', 'Use este espaço para documentos, períodos e orientações oficiais.', null, null, 'https://ingresso.ifpe.edu.br/inscricao/', 'Ver remanejamento', 'publicado', true, false, 3, now()),
('Matrícula inicial', 'matricula-inicial-demonstrativa', 'matricula', 'Área preparada para prazos e orientações de matrícula inicial.', 'Use este espaço para documentos, períodos e orientações oficiais.', null, null, null, 'Ver orientação', 'publicado', true, false, 4, now()),
('Rematrícula', 'rematricula-demonstrativa', 'rematricula', 'Área preparada para prazos e orientações de rematrícula.', 'Use este espaço para renovação de vínculo, escolha de componentes e canais oficiais.', null, null, null, 'Ver orientação', 'publicado', true, false, 5, now()),
('Reingresso', 'reingresso-demonstrativo', 'reingresso', 'Área preparada para orientações de retorno ao curso quando houver edital ou chamada.', 'Informe aqui links, documentos e condições oficiais quando o processo existir.', null, null, null, 'Ver orientação', 'publicado', true, false, 6, now())
on conflict (slug) do nothing;
