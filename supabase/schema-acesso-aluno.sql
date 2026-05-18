-- ============================================================
-- Acesso do estudante + reservas vinculadas ao usuário logado
-- Rode depois de schema-admin.sql e schema-laboratorios.sql
-- ============================================================

alter table public.site_profiles
  add column if not exists matricula text,
  add column if not exists email_alternativo text;

alter table public.laboratorio_reservas
  add column if not exists responsavel_matricula text;

-- Atualiza a função de criação automática de perfil para guardar dados extras do cadastro.
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

-- Reservas de laboratório agora exigem usuário autenticado.
revoke insert on public.laboratorio_reservas from anon;
grant select, insert, update, delete on public.laboratorio_reservas to authenticated;

alter table public.laboratorio_reservas enable row level security;

drop policy if exists "Publico solicita reservas" on public.laboratorio_reservas;
drop policy if exists "Aluno logado solicita reservas" on public.laboratorio_reservas;
drop policy if exists "Aluno le as proprias reservas" on public.laboratorio_reservas;

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
  and nullif(responsavel_matricula, '') is not null
  and exists (
    select 1
    from public.site_profiles sp
    where sp.user_id = auth.uid()
      and sp.ativo = true
      and nullif(sp.matricula, '') = nullif(laboratorio_reservas.responsavel_matricula, '')
  )
);

create policy "Aluno le as proprias reservas"
on public.laboratorio_reservas
for select
to authenticated
using (criado_por = auth.uid());
