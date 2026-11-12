\set ON_ERROR_STOP on
\set QUIET on

\set hugo '00000000-0000-0000-0000-0000000000b7'
\set iris '00000000-0000-0000-0000-0000000000c8'
\set juca '00000000-0000-0000-0000-0000000000d9'

reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  (:'hugo', 'hugo@exemplo.com', '{"nome": "Hugo"}'),
  (:'iris', 'iris@exemplo.com', '{"nome": "Íris"}'),
  (:'juca', 'juca@exemplo.com', '{"nome": "Juca"}');

-- ---------------------------------------------------------------
-- Aparelhos para push
-- ---------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'hugo', false) \g /dev/null

select public.registrar_dispositivo('web', 'https://push.exemplo.com/abc123456',
  '{"endpoint": "https://push.exemplo.com/abc123456", "keys": {"p256dh": "x", "auth": "y"}}') \g /dev/null
select public.registrar_dispositivo('expo', 'ExponentPushToken[hugo-1234]') \g /dev/null
select testes.deve_falhar($q$select public.registrar_dispositivo('web', 'https://push.exemplo.com/sem-chaves', '{"endpoint": "x"}')$q$, 'incompleta') \g /dev/null
select testes.deve_falhar($q$select public.registrar_dispositivo('sms', 'https://push.exemplo.com/x')$q$, 'inválido') \g /dev/null
select testes.deve_falhar($q$insert into public.dispositivos (usuario_id, plataforma, identificador) values ('00000000-0000-0000-0000-0000000000b7', 'expo', 'ExponentPushToken[x]')$q$, 'permission denied') \g /dev/null
do $$ begin
  assert (select count(*) from public.dispositivos) = 2, 'Hugo tem dois aparelhos';
end $$;

-- Íris entra no mesmo navegador: a assinatura passa a ser dela
select set_config('request.jwt.claim.sub', :'iris', false) \g /dev/null
select public.registrar_dispositivo('web', 'https://push.exemplo.com/abc123456',
  '{"endpoint": "https://push.exemplo.com/abc123456", "keys": {"p256dh": "x2", "auth": "y2"}}') \g /dev/null
do $$ begin
  assert (select count(*) from public.dispositivos) = 1, 'Íris vê o aparelho que agora é dela';
end $$;

select set_config('request.jwt.claim.sub', :'hugo', false) \g /dev/null
do $$ begin
  assert (select count(*) from public.dispositivos) = 1, 'Hugo ficou só com o Android';
end $$;
select public.remover_dispositivo('ExponentPushToken[hugo-1234]') \g /dev/null
select public.remover_dispositivo('https://push.exemplo.com/abc123456') \g /dev/null
do $$ begin
  assert (select count(*) from public.dispositivos) = 0, 'Hugo removeu o dele e não consegue remover o da Íris';
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.dispositivos) = 1, 'o da Íris continua';
end $$;

-- ---------------------------------------------------------------
-- Limite de tentativas no convite
-- ---------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'hugo', false) \g /dev/null
select public.criar_grupo('Futebol') as futebol \gset
select public.codigo_do_grupo(:'futebol') as cod_futebol \gset

select set_config('request.jwt.claim.sub', :'juca', false) \g /dev/null
do $$ begin
  for i in 1..8 loop
    assert public.entrar_no_grupo('AAAAA' || i) is null, 'código errado devolve nulo';
  end loop;
end $$;
select testes.deve_falhar(format('select public.entrar_no_grupo(%L)', :'cod_futebol'), 'Muitas tentativas') \g /dev/null

reset role;
update public.tentativas_convite set criado_em = now() - interval '20 minutes';
set role authenticated;
select set_config('request.jwt.claim.sub', :'juca', false) \g /dev/null
select public.entrar_no_grupo(:'cod_futebol') \g /dev/null
do $$ begin
  assert (select count(*) from public.grupos where nome = 'Futebol') = 1, 'depois de 15 minutos entra normalmente';
end $$;

-- ---------------------------------------------------------------
-- Exclusão de conta
-- ---------------------------------------------------------------
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'futebol', 'descricao', 'Quadra', 'valor_total', 80, 'tipo_divisao', 'igual',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'hugo', 'valor', 80)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'hugo', 'valor', 40),
    jsonb_build_object('usuario_id', :'juca', 'valor', 40))
)) \g /dev/null
select testes.deve_falhar(format('select public.anonimizar_conta(%L)', :'juca'), 'permission denied') \g /dev/null

reset role;
select public.anonimizar_conta(:'juca') \g /dev/null
do $$
declare
  juca uuid := '00000000-0000-0000-0000-0000000000d9';
begin
  assert (select nome from public.perfis where id = juca) = 'Conta excluída', 'nome apagado';
  assert (select email from public.perfis where id = juca) is null, 'e-mail apagado';
  assert not (select ativo from public.membros where usuario_id = juca), 'saiu dos grupos';
  assert (select count(*) from public.avisos where usuario_id = juca) = 0, 'avisos apagados';
  assert (select count(*) from public.dividas where devedor = juca) = 1, 'a dívida continua no histórico do grupo';
end $$;

\echo 'Todos os testes de push, convite e exclusão de conta passaram.'
