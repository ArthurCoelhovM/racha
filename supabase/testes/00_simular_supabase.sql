-- Simula o mínimo do Supabase (papéis, schema auth e auth.uid()) para testar as migrações num Postgres comum.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create schema testes;
grant usage on schema testes to authenticated;

create function testes.deve_falhar(comando text, trecho text default null)
returns void
language plpgsql
as $$
begin
  begin
    execute comando;
  exception when others then
    if trecho is not null and position(trecho in sqlerrm) = 0 then
      raise exception 'Falhou com a mensagem errada: % (esperava "%")', sqlerrm, trecho;
    end if;
    return;
  end;
  raise exception 'Deveria ter falhado: %', comando;
end;
$$;
grant execute on function testes.deve_falhar(text, text) to authenticated;
