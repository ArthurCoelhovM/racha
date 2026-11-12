\set ON_ERROR_STOP on
\set QUIET on

-- Lista revisada das funções que o app pode chamar.
-- Função nova liberada para o app: acrescente aqui no mesmo envio.
-- Função esquecida (fechada sem querer) ou liberada sem revisão: este teste falha.

reset role;

create temp table liberadas_esperadas (assinatura text primary key);
insert into liberadas_esperadas values
  ('atualizar_grupo(p_grupo uuid, p_nome text, p_cor text, p_abatimento boolean, p_divisoes text[], p_lembrete_dias integer)'),
  ('codigo_do_grupo(p_grupo uuid)'),
  ('compartilha_grupo(outro uuid)'),
  ('criar_grupo(p_nome text, p_cor text, p_abatimento boolean, p_divisoes text[], p_lembrete_dias integer)'),
  ('criar_recorrente(p jsonb, p_frequencia text, p_gasto uuid)'),
  ('definir_papel(p_grupo uuid, p_usuario uuid, p_papel text)'),
  ('definir_permissoes(p_grupo uuid, p_permissoes jsonb)'),
  ('eh_dono(g uuid)'),
  ('eh_membro(g uuid)'),
  ('entrar_no_grupo(p_codigo text)'),
  ('excluir_gasto(p_id uuid)'),
  ('hoje_sp()'),
  ('lancar_meus_recorrentes()'),
  ('marcar_pago(p_grupo uuid, p_de uuid, p_para uuid, p_valor numeric, p_gasto uuid)'),
  ('novo_codigo_convite(p_grupo uuid)'),
  ('parar_recorrente(p_id uuid)'),
  ('passar_dono(p_grupo uuid, p_usuario uuid)'),
  ('pendencias_de_grupos_que_sai()'),
  ('pendencias_do_grupo(p_grupo uuid, p_abatimento boolean)'),
  ('reais(v numeric)'),
  ('registrar_dispositivo(p_plataforma text, p_identificador text, p_assinatura jsonb)'),
  ('registrar_erro(p_mensagem text, p_pilha text, p_tela text, p_plataforma text, p_versao text)'),
  ('registrar_leitura_nfce()'),
  ('remover_dispositivo(p_identificador text)'),
  ('remover_membro(p_grupo uuid, p_usuario uuid)'),
  ('resumo_meus_grupos()'),
  ('sair_do_grupo(p_grupo uuid)'),
  ('salvar_gasto(p jsonb)'),
  ('valor_a_cobrar(v numeric)');

create temp view funcoes_publicas as
select p.oid, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as assinatura
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f';

do $$
declare
  v_sobrando text;
  v_faltando text;
  v_anon text;
begin
  select string_agg(f.assinatura, E'\n  ' order by f.assinatura) into v_sobrando
  from funcoes_publicas f
  where has_function_privilege('authenticated', f.oid, 'execute')
    and f.assinatura not in (select assinatura from liberadas_esperadas);

  select string_agg(e.assinatura, E'\n  ' order by e.assinatura) into v_faltando
  from liberadas_esperadas e
  where not exists (
    select 1 from funcoes_publicas f
    where f.assinatura = e.assinatura and has_function_privilege('authenticated', f.oid, 'execute')
  );

  select string_agg(f.assinatura, E'\n  ' order by f.assinatura) into v_anon
  from funcoes_publicas f
  where has_function_privilege('anon', f.oid, 'execute');

  if v_sobrando is not null then
    raise exception E'Funções abertas para o app que não estão na lista revisada:\n  %', v_sobrando;
  end if;
  if v_faltando is not null then
    raise exception E'Funções da lista revisada que o app não consegue chamar:\n  %', v_faltando;
  end if;
  if v_anon is not null then
    raise exception E'Funções abertas para quem não entrou na conta:\n  %', v_anon;
  end if;
end $$;

-- uma função criada agora nasce fechada
create function public.funcao_de_teste() returns int language sql as 'select 1';
do $$ begin
  if has_function_privilege('authenticated', 'public.funcao_de_teste()', 'execute') then
    raise exception 'Função nova nasceu aberta para o app';
  end if;
end $$;
drop function public.funcao_de_teste();

-- registro de erros: guarda, limita e não deixa ler
\set ana '00000000-0000-0000-0000-000000000201'
insert into auth.users (id, email, raw_user_meta_data) values (:'ana', 'ana-erros@exemplo.com', '{"nome": "Ana"}');

set role authenticated;
select set_config('request.jwt.claim.sub', :'ana', false) \g /dev/null
select public.registrar_erro('Tela quebrou', 'at linha 1', '/grupo/x', 'web', '1.0.0') \g /dev/null
select public.registrar_erro(repeat('x', 5000)) \g /dev/null
do $$ begin
  perform 1 from public.erros;
  raise exception 'O app conseguiu ler a tabela de erros';
exception when insufficient_privilege then null;
end $$;
select public.registrar_erro('repetido') from generate_series(1, 30) \g /dev/null

reset role;
do $$
declare v_total int; v_maior int;
begin
  select count(*), max(char_length(mensagem)) into v_total, v_maior
  from public.erros where usuario_id = '00000000-0000-0000-0000-000000000201';
  if v_total <> 20 then raise exception 'Esperava 20 erros guardados (limite), veio %', v_total; end if;
  if v_maior <> 1000 then raise exception 'Mensagem longa não foi cortada em 1000: %', v_maior; end if;
end $$;

\echo 'Todos os testes de permissões e de registro de erros passaram.'
