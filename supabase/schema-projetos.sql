-- ============================================================
-- RF 010, RF 011, RF 012 - Propostas e projetos
-- Solicitação de propostas por aluno + análise do ADM
-- Visualização pública de projetos de Pesquisa, Extensão e Inovação
-- Rode depois de schema-admin.sql e schema-acesso-aluno.sql
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.projeto_propostas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  slug text not null unique,
  eixo text not null check (eixo in ('pesquisa', 'extensao', 'inovacao')),
  resumo text not null,
  descricao text,
  objetivo text,
  orientador text,
  equipe text,
  palavras_chave text,
  publico_alvo text,
  responsavel_nome text not null,
  responsavel_email text not null,
  responsavel_matricula text not null,
  documento_url text,
  documento_path text,
  documento_nome text,
  documento_tipo text,
  documento_tamanho integer,
  status text not null default 'solicitada' check (status in ('solicitada', 'em_analise', 'aprovada', 'revisao', 'recusada', 'arquivada')),
  visivel boolean not null default false,
  feedback_admin text,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  avaliado_por uuid references auth.users(id) on delete set null,
  aprovado_em timestamptz,
  avaliado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_projeto_propostas_publico on public.projeto_propostas(status, visivel, eixo, atualizado_em desc);
create index if not exists idx_projeto_propostas_criado_por on public.projeto_propostas(criado_por, criado_em desc);
create index if not exists idx_projeto_propostas_status on public.projeto_propostas(status, criado_em desc);

-- Reaproveita a função set_updated_at criada no schema-admin.sql.
drop trigger if exists trg_projeto_propostas_updated_at on public.projeto_propostas;
create trigger trg_projeto_propostas_updated_at
before update on public.projeto_propostas
for each row execute function public.set_updated_at();

create or replace view public.projetos_publicos as
select
  id,
  titulo,
  slug,
  eixo,
  resumo,
  descricao,
  objetivo,
  orientador,
  equipe,
  palavras_chave,
  publico_alvo,
  aprovado_em,
  atualizado_em
from public.projeto_propostas
where status = 'aprovada' and visivel = true;

-- Bucket privado para documentos enviados nas propostas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'projetos-documentos',
  'projetos-documentos',
  false,
  15728640,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'text/plain'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Grants explícitos para projetos Supabase novos.
grant select, insert, update, delete on public.projeto_propostas to authenticated;
grant select on public.projeto_propostas to anon;
grant select on public.projetos_publicos to anon, authenticated;
grant execute on function public.current_user_is_site_admin() to anon, authenticated;

grant select, insert on storage.objects to authenticated;
grant select on storage.objects to anon;

alter table public.projeto_propostas enable row level security;

-- Limpeza segura para reexecução.
drop policy if exists "Publico le projetos aprovados" on public.projeto_propostas;
drop policy if exists "Aluno cria proposta propria" on public.projeto_propostas;
drop policy if exists "Aluno le proprias propostas" on public.projeto_propostas;
drop policy if exists "Aluno atualiza proposta em revisao" on public.projeto_propostas;
drop policy if exists "Admins leem todas propostas" on public.projeto_propostas;
drop policy if exists "Admins criam propostas" on public.projeto_propostas;
drop policy if exists "Admins atualizam propostas" on public.projeto_propostas;
drop policy if exists "Admins removem propostas" on public.projeto_propostas;

create policy "Publico le projetos aprovados"
on public.projeto_propostas
for select
to anon, authenticated
using (status = 'aprovada' and visivel = true);

create policy "Aluno cria proposta propria"
on public.projeto_propostas
for insert
to authenticated
with check (
  auth.uid() is not null
  and criado_por = auth.uid()
  and status = 'solicitada'
  and visivel = false
  and eixo in ('pesquisa', 'extensao', 'inovacao')
  and nullif(responsavel_matricula, '') is not null
  and exists (
    select 1
    from public.site_profiles sp
    where sp.user_id = auth.uid()
      and sp.ativo = true
      and nullif(sp.matricula, '') = nullif(projeto_propostas.responsavel_matricula, '')
  )
);

create policy "Aluno le proprias propostas"
on public.projeto_propostas
for select
to authenticated
using (criado_por = auth.uid());

create policy "Aluno atualiza proposta em revisao"
on public.projeto_propostas
for update
to authenticated
using (criado_por = auth.uid() and status in ('solicitada', 'revisao'))
with check (
  criado_por = auth.uid()
  and status = 'solicitada'
  and visivel = false
  and nullif(responsavel_matricula, '') is not null
  and exists (
    select 1
    from public.site_profiles sp
    where sp.user_id = auth.uid()
      and sp.ativo = true
      and nullif(sp.matricula, '') = nullif(projeto_propostas.responsavel_matricula, '')
  )
);

create policy "Admins leem todas propostas"
on public.projeto_propostas
for select
to authenticated
using (public.current_user_is_site_admin());

create policy "Admins criam propostas"
on public.projeto_propostas
for insert
to authenticated
with check (public.current_user_is_site_admin());

create policy "Admins atualizam propostas"
on public.projeto_propostas
for update
to authenticated
using (public.current_user_is_site_admin())
with check (public.current_user_is_site_admin());

create policy "Admins removem propostas"
on public.projeto_propostas
for delete
to authenticated
using (public.current_user_is_site_admin());

-- Storage RLS para documentos. O caminho do arquivo deve começar com o UUID do usuário.
drop policy if exists "Aluno envia documento de projeto" on storage.objects;
drop policy if exists "Aluno le documentos proprios de projeto" on storage.objects;
drop policy if exists "Admin le documentos de projetos" on storage.objects;
drop policy if exists "Admin remove documentos de projetos" on storage.objects;

create policy "Aluno envia documento de projeto"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'projetos-documentos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Aluno le documentos proprios de projeto"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'projetos-documentos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Admin le documentos de projetos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'projetos-documentos'
  and public.current_user_is_site_admin()
);

create policy "Admin remove documentos de projetos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'projetos-documentos'
  and public.current_user_is_site_admin()
);

-- Exemplo aprovado para validar a listagem pública.
insert into public.projeto_propostas (
  titulo,
  slug,
  eixo,
  resumo,
  descricao,
  objetivo,
  orientador,
  equipe,
  palavras_chave,
  publico_alvo,
  responsavel_nome,
  responsavel_email,
  responsavel_matricula,
  status,
  visivel,
  aprovado_em
)
values (
  'Projeto demonstrativo de inovação aplicada',
  'projeto-demonstrativo-de-inovacao-aplicada',
  'inovacao',
  'Exemplo aprovado para testar a vitrine pública de projetos do curso.',
  'Este registro pode ser editado ou removido pelo painel administrativo depois da validação.',
  'Validar o fluxo de aprovação e visualização de projetos.',
  'Coordenação',
  'Equipe demonstrativa',
  'software, inovação, protótipo',
  'Comunidade acadêmica',
  'Coordenação',
  'coordenação@ifpe.edu.br',
  '000000',
  'aprovada',
  true,
  now()
)
on conflict (slug) do nothing;
