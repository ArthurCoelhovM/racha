-- Arquitetura: permissões fechadas por padrão e registro de erros do app

-- ---------------------------------------------------------------
-- Permissões das funções
-- ---------------------------------------------------------------
-- Toda função nova nasce fechada. Cada migração libera só as funções que cria,
-- e a lista revisada do que fica aberto mora em supabase/testes/05_permissoes.sql:
-- se uma função for liberada ou esquecida sem atualizar a lista, os testes falham.

alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------
-- Erros do app
-- ---------------------------------------------------------------

create table public.erros (
  id bigint generated always as identity primary key,
  usuario_id uuid references public.perfis(id) on delete set null,
  mensagem text not null check (char_length(mensagem) <= 1000),
  pilha text check (char_length(pilha) <= 8000),
  tela text check (char_length(tela) <= 300),
  plataforma text check (char_length(plataforma) <= 20),
  versao text check (char_length(versao) <= 40),
  criado_em timestamptz not null default now()
);

create index erros_criado_em on public.erros (criado_em desc);
create index erros_usuario on public.erros (usuario_id, criado_em desc);

alter table public.erros enable row level security;
revoke all on public.erros from anon, authenticated;
-- ninguém lê pela API; os erros são vistos no painel do Supabase (Table Editor > erros)

create or replace function public.registrar_erro(
  p_mensagem text,
  p_pilha text default null,
  p_tela text default null,
  p_plataforma text default null,
  p_versao text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return; end if;
  -- no máximo 20 erros por pessoa a cada 10 minutos, para um laço de erro não encher a tabela
  if (select count(*) from public.erros
      where usuario_id = auth.uid() and criado_em > now() - interval '10 minutes') >= 20 then
    return;
  end if;
  insert into public.erros (usuario_id, mensagem, pilha, tela, plataforma, versao)
  values (
    auth.uid(),
    left(coalesce(nullif(p_mensagem, ''), 'Erro sem mensagem'), 1000),
    left(p_pilha, 8000),
    left(p_tela, 300),
    left(p_plataforma, 20),
    left(p_versao, 40)
  );
end;
$$;

grant execute on function public.registrar_erro(text, text, text, text, text) to authenticated;

-- a limpeza mensal passa a apagar erros com mais de 60 dias
create or replace function public.limpar_dados_antigos()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total int := 0;
  v_parcial int;
begin
  delete from public.avisos
  where (lido and criado_em < now() - interval '90 days') or criado_em < now() - interval '365 days';
  get diagnostics v_parcial = row_count;
  v_total := v_total + v_parcial;

  delete from public.tentativas_convite where criado_em < now() - interval '1 day';
  get diagnostics v_parcial = row_count;
  v_total := v_total + v_parcial;

  delete from public.leituras_nfce where criado_em < now() - interval '1 day';
  get diagnostics v_parcial = row_count;
  v_total := v_total + v_parcial;

  delete from public.erros where criado_em < now() - interval '60 days';
  get diagnostics v_parcial = row_count;
  v_total := v_total + v_parcial;

  return v_total;
end;
$$;
