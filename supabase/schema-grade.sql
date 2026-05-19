-- ============================================================
-- RF 005 - PPC / Matriz Curricular administrável
-- Site Institucional de Engenharia de Software - IFPE BJ
-- ============================================================
-- Como usar:
-- 1. Rode este SQL depois do schema-admin.sql.
-- 2. Acesse admin/grade.html para cadastrar, editar ou remover componentes.
-- 3. A página pública grade.html passa a listar os componentes visíveis.
-- ============================================================

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create table if not exists public.componentes_curriculares (
  id uuid primary key default gen_random_uuid(),
  periodo integer not null check (periodo between 1 and 8),
  ordem integer not null default 0,
  codigo text not null,
  nome text not null,
  carga_horaria integer not null default 0 check (carga_horaria >= 0),
  creditos integer not null default 0 check (creditos >= 0),
  pre_requisitos text,
  tipo text not null default 'obrigatorio' check (tipo in ('obrigatorio', 'optativo', 'eletivo', 'atividade')),
  descricao text,
  visivel boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint componentes_curriculares_codigo_unique unique (codigo)
);

create index if not exists idx_componentes_curriculares_periodo_ordem on public.componentes_curriculares(periodo, ordem);
create index if not exists idx_componentes_curriculares_visivel on public.componentes_curriculares(visivel);

drop trigger if exists trg_componentes_curriculares_updated_at on public.componentes_curriculares;
create trigger trg_componentes_curriculares_updated_at
before update on public.componentes_curriculares
for each row execute function public.set_updated_at();

-- View pública usada pela página grade.html.
drop view if exists public.componentes_curriculares_publicos;
create view public.componentes_curriculares_publicos as
select
  id,
  periodo,
  ordem,
  codigo,
  nome,
  carga_horaria,
  creditos,
  pre_requisitos,
  tipo,
  descricao,
  criado_em,
  atualizado_em
from public.componentes_curriculares
where visivel = true
order by periodo asc, ordem asc, nome asc;

-- Permissões explícitas para a Data API.
grant select on public.componentes_curriculares to anon, authenticated;
grant insert, update, delete on public.componentes_curriculares to authenticated;
grant select on public.componentes_curriculares_publicos to anon, authenticated;
grant execute on function public.current_user_is_site_admin() to anon, authenticated;

alter table public.componentes_curriculares enable row level security;

drop policy if exists "Publico le componentes visiveis" on public.componentes_curriculares;
drop policy if exists "Admins leem todos os componentes" on public.componentes_curriculares;
drop policy if exists "Admins criam componentes" on public.componentes_curriculares;
drop policy if exists "Admins atualizam componentes" on public.componentes_curriculares;
drop policy if exists "Admins removem componentes" on public.componentes_curriculares;

create policy "Publico le componentes visiveis"
on public.componentes_curriculares
for select
to anon, authenticated
using (visivel = true);

create policy "Admins leem todos os componentes"
on public.componentes_curriculares
for select
to authenticated
using (public.current_user_is_site_admin());

create policy "Admins criam componentes"
on public.componentes_curriculares
for insert
to authenticated
with check (public.current_user_is_site_admin());

create policy "Admins atualizam componentes"
on public.componentes_curriculares
for update
to authenticated
using (public.current_user_is_site_admin())
with check (public.current_user_is_site_admin());

create policy "Admins removem componentes"
on public.componentes_curriculares
for delete
to authenticated
using (public.current_user_is_site_admin());

-- Carga inicial demonstrativa baseada na matriz que já estava na página pública.
-- Não sobrescreve componentes com o mesmo código.
insert into public.componentes_curriculares
  (periodo, ordem, codigo, nome, carga_horaria, creditos, pre_requisitos, tipo, visivel)
values
  (1, 1, 'CBBJ.10', 'Comunicação e Expressão', 60, 4, null, 'obrigatorio', true),
  (1, 2, 'CBBJ.6', 'Ética, Normas e Postura Profissional', 30, 2, null, 'obrigatorio', true),
  (1, 3, 'CBBJ.11', 'Introdução à Engenharia de Software', 60, 4, null, 'obrigatorio', true),
  (1, 4, 'CBBJ.9', 'Introdução à Programação', 90, 6, null, 'obrigatorio', true),
  (1, 5, 'CBBJ.1', 'Língua Inglesa I', 30, 2, null, 'obrigatorio', true),
  (1, 6, 'CBBJ.7', 'Matemática Discreta', 60, 4, null, 'obrigatorio', true),
  (1, 7, 'CBBJ.8', 'Sistemas Digitais', 60, 4, null, 'obrigatorio', true),
  (2, 1, 'CBBJ.14', 'Algoritmos e Estrutura de Dados', 90, 6, 'CBBJ.9', 'obrigatorio', true),
  (2, 2, 'CBBJ.13', 'Cálculo Aplicado à Informática', 90, 6, 'CBBJ.7', 'obrigatorio', true),
  (2, 3, 'CBBJ.16', 'Introdução à Geometria Analítica e Álgebra Linear', 90, 6, 'CBBJ.7', 'obrigatorio', true),
  (2, 4, 'CBBJ.12', 'Língua Inglesa II', 30, 2, 'CBBJ.1', 'obrigatorio', true),
  (2, 5, 'CBBJ.17', 'Organização e Arquitetura de Computadores', 60, 4, 'CBBJ.8', 'obrigatorio', true),
  (2, 6, 'CBBJ.15', 'Processo de Software', 60, 4, 'CBBJ.11', 'obrigatorio', true),
  (3, 1, 'CBBJ.22', 'Banco de Dados I', 60, 4, 'CBBJ.7', 'obrigatorio', true),
  (3, 2, 'CBBJ.23', 'Engenharia de Requisitos', 60, 4, 'CBBJ.15', 'obrigatorio', true),
  (3, 3, 'CBBJ.20', 'Estatística e Probabilidade Aplicada', 60, 4, 'CBBJ.13', 'obrigatorio', true),
  (3, 4, 'CBBJ.18', 'Língua Inglesa III', 30, 2, 'CBBJ.12', 'obrigatorio', true),
  (3, 5, 'CBBJ.24', 'Metodologia Científica', 60, 4, null, 'obrigatorio', true),
  (3, 6, 'CBBJ.19', 'Programação Orientada à Objetos', 90, 6, 'CBBJ.14', 'obrigatorio', true),
  (3, 7, 'CBBJ.21', 'Sistemas Operacionais', 60, 4, 'CBBJ.17', 'obrigatorio', true),
  (4, 1, 'CBBJ.31', 'Banco de Dados II', 60, 4, 'CBBJ.22', 'obrigatorio', true),
  (4, 2, 'CBBJ.27', 'Desenvolvimento Web', 90, 6, 'CBBJ.14', 'obrigatorio', true),
  (4, 3, 'CBBJ.28', 'Economia para Engenharia de Software', 60, 4, 'CBBJ.23', 'obrigatorio', true),
  (4, 4, 'CBBJ.30', 'Interação Humano Computador', 60, 4, 'CBBJ.10', 'obrigatorio', true),
  (4, 5, 'CBBJ.25', 'Língua Inglesa IV', 30, 2, 'CBBJ.18', 'obrigatorio', true),
  (4, 6, 'CBBJ.29', 'Projeto de Software', 60, 4, 'CBBJ.15', 'obrigatorio', true),
  (4, 7, 'CBBJ.26', 'Redes de Computadores I', 60, 4, 'CBBJ.21', 'obrigatorio', true),
  (5, 1, 'CBBJ.36', 'Arquitetura de Software', 60, 4, 'CBBJ.29', 'obrigatorio', true),
  (5, 2, 'CBBJ.34', 'Gerência de Projetos de Software', 60, 4, 'CBBJ.29', 'obrigatorio', true),
  (5, 3, 'CBBJ.32', 'Língua Inglesa V', 30, 2, 'CBBJ.25', 'obrigatorio', true),
  (5, 4, 'CBBJ.35', 'Modelagem de Processos de Negócios', 60, 4, 'CBBJ.28', 'obrigatorio', true),
  (5, 5, 'CBBJ.37', 'Padrões de Projetos de Software', 60, 4, 'CBBJ.29', 'obrigatorio', true),
  (5, 6, 'CBBJ.33', 'Programação para Dispositivos Móveis', 90, 6, 'CBBJ.19', 'obrigatorio', true),
  (5, 7, 'CBBJ.38', 'Redes de Computadores II', 60, 4, 'CBBJ.26', 'obrigatorio', true),
  (5, 8, 'CBBJ.41', 'Gerência de Configuração e Mudanças', 60, 4, 'CBBJ.34', 'obrigatorio', true),
  (6, 1, 'CBBJ.39', 'Língua Inglesa VI', 30, 2, 'CBBJ.32', 'obrigatorio', true),
  (6, 2, 'CBBJ.42', 'Projeto Integrador', 90, 6, 'CBBJ.29', 'obrigatorio', true),
  (6, 3, 'CBBJ.43', 'Qualidade de Software', 60, 4, 'CBBJ.34', 'obrigatorio', true),
  (6, 4, 'CBBJ.44', 'Sistemas Paralelos e Distribuídos', 60, 4, 'CBBJ.29', 'obrigatorio', true),
  (6, 5, 'CBBJ.40', 'Verificação e Validação de Software', 90, 6, 'CBBJ.34', 'obrigatorio', true),
  (6, 6, 'CBBJ.46', 'Empreendedorismo e Inovação', 60, 4, null, 'obrigatorio', true),
  (6, 7, 'CBBJ.48', 'Engenharia de Software Educacional', 60, 4, 'CBBJ.11', 'obrigatorio', true),
  (6, 8, 'CBBJ.52', 'Libras', 60, 4, 'CBBJ.42', 'obrigatorio', true),
  (6, 9, 'CBBJ.45', 'Metodologia da Pesquisa I', 90, 6, 'CBBJ.42', 'obrigatorio', true),
  (7, 1, 'CBBJ.47', 'Segurança e Auditoria de Sistemas', 60, 4, 'CBBJ.44', 'obrigatorio', true),
  (7, 2, 'CBBJ.55', 'Tópicos Avançados em Banco de Dados I', 60, 4, 'CBBJ.42', 'obrigatorio', true),
  (7, 3, 'CBBJ.59', 'Tópicos Avançados em TIC I', 60, 4, 'CBBJ.42', 'obrigatorio', true),
  (7, 4, 'CBBJ.53', 'Tópicos Avançados em Programação I', 60, 4, 'CBBJ.42', 'obrigatorio', true),
  (7, 5, 'CBBJ.57', 'Tópicos Avançados em Redes de Computadores I', 60, 4, 'CBBJ.42', 'obrigatorio', true),
  (7, 6, 'CBBJ.50', 'Eng. de Software para Desenvolvimento de Jogos', 60, 4, 'CBBJ.11', 'obrigatorio', true),
  (7, 7, 'CBBJ.51', 'Introdução aos Sistemas Inteligentes', 60, 4, 'CBBJ.42', 'obrigatorio', true),
  (7, 8, 'CBBJ.49', 'Metodologia da Pesquisa II', 60, 4, 'CBBJ.45', 'obrigatorio', true),
  (8, 1, 'CBBJ.56', 'Tópicos Avançados em Banco de Dados II', 60, 4, 'CBBJ.42', 'obrigatorio', true),
  (8, 2, 'CBBJ.60', 'Tópicos Avançados em TIC II', 60, 4, 'CBBJ.42', 'obrigatorio', true),
  (8, 3, 'CBBJ.54', 'Tópicos Avançados em Programação II', 60, 4, 'CBBJ.42', 'obrigatorio', true),
  (8, 4, 'CBBJ.58', 'Tópicos Avançados em Redes de Computadores II', 60, 4, 'CBBJ.42', 'obrigatorio', true)
on conflict (codigo) do nothing;
