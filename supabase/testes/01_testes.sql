\set ON_ERROR_STOP on
\set QUIET on

\set ana   '00000000-0000-0000-0000-00000000000a'
\set bia   '00000000-0000-0000-0000-00000000000b'
\set caio  '00000000-0000-0000-0000-00000000000c'
\set dani  '00000000-0000-0000-0000-00000000000d'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'ana',  'ana@exemplo.com',  '{"nome": "Ana"}'),
  (:'bia',  'bia@exemplo.com',  '{"nome": "Bia"}'),
  (:'caio', 'caio@exemplo.com', '{}'),
  (:'dani', 'dani@exemplo.com', '{"nome": "Dani"}');

do $$ begin
  assert (select count(*) from public.perfis) = 4, 'perfis criados pelo trigger';
  assert (select nome from public.perfis where email = 'caio@exemplo.com') = 'caio', 'nome padrão vem do e-mail';
end $$;

-- ---------------------------------------------------------------
-- Ana cria os grupos; Bia e Caio entram pelo código
-- ---------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'ana', false) \g /dev/null

select public.criar_grupo('Mercado', '#5B4CF0', true) as mercado \gset
select public.criar_grupo('Casa', '#E8680A', false, array['igual', 'exato']) as casa \gset
select codigo_convite as cod_mercado from public.grupos where id = :'mercado' \gset
select codigo_convite as cod_casa from public.grupos where id = :'casa' \gset

select set_config('request.jwt.claim.sub', :'bia', false) \g /dev/null
select public.entrar_no_grupo(lower(:'cod_mercado')) \g /dev/null
select public.entrar_no_grupo(:'cod_casa') \g /dev/null

select set_config('request.jwt.claim.sub', :'caio', false) \g /dev/null
select public.entrar_no_grupo(:'cod_mercado') \g /dev/null

do $$ begin
  assert (select count(*) from public.membros where grupo_id = (select id from public.grupos where nome = 'Mercado')) = 3,
    'Caio vê os 3 membros do Mercado';
  assert (select count(*) from public.grupos) = 1, 'Caio só vê o grupo em que entrou';
end $$;

-- Dani não participa de nada
select set_config('request.jwt.claim.sub', :'dani', false) \g /dev/null
do $$ begin
  assert (select count(*) from public.grupos) = 0, 'Dani não vê grupos';
  assert (select count(*) from public.membros) = 0, 'Dani não vê membros';
  assert (select count(*) from public.perfis) = 1, 'Dani só vê o próprio perfil';
end $$;
select testes.deve_falhar(format(
  $q$select public.salvar_gasto('{"grupo_id": "%s", "descricao": "x", "valor_total": 10, "tipo_divisao": "igual",
     "pagadores": [{"usuario_id": "%s", "valor": 10}], "divisoes": [{"usuario_id": "%s", "valor": 10}]}'::jsonb)$q$,
  :'mercado', :'dani', :'dani'), 'não participa') \g /dev/null
do $$ begin
  assert public.entrar_no_grupo('ZZZZZZ') is null, 'código inexistente devolve nulo';
end $$;

-- ---------------------------------------------------------------
-- Mercado (com abatimento): o exemplo do roteiro
--   gasto 1: Bia paga 100, Ana fica com 50 e Bia com 50 -> Ana deve 50 a Bia
--   gasto 2: Ana paga 60, cada uma fica com 30          -> Bia deve 30 a Ana
--   gasto 3: Bia paga 30 só para Caio                   -> Caio deve 30 a Bia
-- ---------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'ana', false) \g /dev/null

select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'mercado', 'descricao', 'Compra do mês', 'valor_total', 100, 'tipo_divisao', 'exato',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'bia', 'valor', 100)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'ana', 'parametro', 50, 'valor', 50),
    jsonb_build_object('usuario_id', :'bia', 'parametro', 50, 'valor', 50))
)) as gasto1 \gset

select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'mercado', 'descricao', 'Feira', 'valor_total', 60, 'tipo_divisao', 'igual',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'ana', 'valor', 60)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'ana', 'valor', 30),
    jsonb_build_object('usuario_id', :'bia', 'valor', 30))
)) \g /dev/null

select set_config('request.jwt.claim.sub', :'bia', false) \g /dev/null
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'mercado', 'descricao', 'Lanche do Caio', 'valor_total', 30, 'tipo_divisao', 'exato',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'bia', 'valor', 30)),
  'divisoes', jsonb_build_array(jsonb_build_object('usuario_id', :'caio', 'parametro', 30, 'valor', 30))
)) \g /dev/null

reset role;
do $$
declare
  ana uuid := '00000000-0000-0000-0000-00000000000a';
  bia uuid := '00000000-0000-0000-0000-00000000000b';
  caio uuid := '00000000-0000-0000-0000-00000000000c';
  merc uuid := (select id from public.grupos where nome = 'Mercado');
begin
  assert (select devido from public.saldos_pares where grupo_id = merc and devedor = ana and credor = bia) = 50, 'Ana deve 50 a Bia';
  assert (select devido from public.saldos_pares where grupo_id = merc and devedor = bia and credor = ana) = 30, 'Bia deve 30 a Ana';
  assert (select devido from public.saldos_pares where grupo_id = merc and devedor = caio and credor = bia) = 30, 'Caio deve 30 a Bia';
  assert not exists (select 1 from public.dividas where (devedor = ana and credor = caio) or (devedor = caio and credor = ana)),
    'nunca existe dívida passando por terceiro';
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', :'ana', false) \g /dev/null
do $$ begin
  assert (select voce_deve from public.resumo_meus_grupos() where nome = 'Mercado') = 20, 'Ana deve 20 com abatimento';
  assert (select te_devem from public.resumo_meus_grupos() where nome = 'Mercado') = 0, 'ninguém deve à Ana no Mercado';
end $$;

-- Ana marca que pagou os 20 para Bia
select public.marcar_pago(:'mercado', :'ana', :'bia', 20) \g /dev/null
do $$ begin
  assert (select voce_deve from public.resumo_meus_grupos() where nome = 'Mercado') = 0, 'Ana quitou o Mercado';
  assert (select count(*) from public.historico where entidade = 'pagamentos') = 1, 'pagamento no histórico';
end $$;

-- Caio não pode marcar pagamento entre Ana e Bia
select set_config('request.jwt.claim.sub', :'caio', false) \g /dev/null
select testes.deve_falhar(format('select public.marcar_pago(%L, %L, %L, 5)', :'mercado', :'ana', :'bia'), 'Só quem paga') \g /dev/null

-- ---------------------------------------------------------------
-- Casa (sem abatimento)
-- ---------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'bia', false) \g /dev/null
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'casa', 'descricao', 'Luz', 'valor_total', 100, 'tipo_divisao', 'igual',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'bia', 'valor', 100)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'ana', 'valor', 50),
    jsonb_build_object('usuario_id', :'bia', 'valor', 50))
)) as luz \gset
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'casa', 'descricao', 'Aluguel', 'valor_total', 60, 'tipo_divisao', 'igual',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'ana', 'valor', 60)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'ana', 'valor', 30),
    jsonb_build_object('usuario_id', :'bia', 'valor', 30))
)) \g /dev/null

select set_config('request.jwt.claim.sub', :'ana', false) \g /dev/null
do $$ begin
  assert (select voce_deve from public.resumo_meus_grupos() where nome = 'Casa') = 50, 'sem abatimento Ana deve os 50 inteiros';
  assert (select te_devem from public.resumo_meus_grupos() where nome = 'Casa') = 30, 'sem abatimento Bia deve os 30 inteiros';
end $$;

-- divisão não permitida e somas erradas
select testes.deve_falhar(format(
  $q$select public.salvar_gasto('{"grupo_id": "%s", "descricao": "x", "valor_total": 10, "tipo_divisao": "cotas",
     "pagadores": [{"usuario_id": "%s", "valor": 10}], "divisoes": [{"usuario_id": "%s", "valor": 10}]}'::jsonb)$q$,
  :'casa', :'ana', :'ana'), 'não permite') \g /dev/null
select testes.deve_falhar(format(
  $q$select public.salvar_gasto('{"grupo_id": "%s", "descricao": "x", "valor_total": 10, "tipo_divisao": "igual",
     "pagadores": [{"usuario_id": "%s", "valor": 9}], "divisoes": [{"usuario_id": "%s", "valor": 10}]}'::jsonb)$q$,
  :'casa', :'ana', :'ana'), 'pagadores') \g /dev/null
select testes.deve_falhar(format(
  $q$select public.salvar_gasto('{"grupo_id": "%s", "descricao": "x", "valor_total": 10, "tipo_divisao": "igual",
     "pagadores": [{"usuario_id": "%s", "valor": 10}], "divisoes": [{"usuario_id": "%s", "valor": 9.5}]}'::jsonb)$q$,
  :'casa', :'ana', :'ana'), 'partes') \g /dev/null
select testes.deve_falhar(format(
  $q$select public.salvar_gasto('{"grupo_id": "%s", "descricao": "x", "valor_total": 10, "tipo_divisao": "igual",
     "pagadores": [{"usuario_id": "%s", "valor": 10}], "divisoes": [{"usuario_id": "%s", "valor": 10}]}'::jsonb)$q$,
  :'casa', :'ana', :'caio'), 'membros do grupo') \g /dev/null

-- só as configurações do grupo podem ser editadas
update public.grupos set abatimento = true, lembrete_dias = 3 where id = :'casa';
select testes.deve_falhar(format('update public.grupos set codigo_convite = ''AAAAAA'' where id = %L', :'casa'), 'permission denied') \g /dev/null
select testes.deve_falhar('insert into public.dividas (grupo_id, gasto_id, devedor, credor, valor) select grupo_id, id, criado_por, criado_por, 1 from public.gastos limit 1', 'permission denied') \g /dev/null
do $$ begin
  assert (select voce_deve from public.resumo_meus_grupos() where nome = 'Casa') = 20, 'ligar o abatimento muda o resumo para 20';
  assert (select count(*) from public.historico where entidade = 'grupos') = 1, 'mudança de configuração no histórico';
end $$;
update public.grupos set abatimento = false where id = :'casa';

-- ---------------------------------------------------------------
-- Divisões com dízima e vários pagadores
-- ---------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'ana', false) \g /dev/null
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'mercado', 'descricao', 'Pizza', 'valor_total', 100, 'tipo_divisao', 'igual',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'ana', 'valor', 100)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'ana', 'valor', 33.333333333333333334),
    jsonb_build_object('usuario_id', :'bia', 'valor', 33.333333333333333333),
    jsonb_build_object('usuario_id', :'caio', 'valor', 33.333333333333333333))
)) as pizza \gset

select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'mercado', 'descricao', 'Uber', 'valor_total', 90, 'tipo_divisao', 'igual',
  'pagadores', jsonb_build_array(
    jsonb_build_object('usuario_id', :'ana', 'valor', 60),
    jsonb_build_object('usuario_id', :'bia', 'valor', 30)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'ana', 'valor', 30),
    jsonb_build_object('usuario_id', :'bia', 'valor', 30),
    jsonb_build_object('usuario_id', :'caio', 'valor', 30))
)) as uber \gset

do $$
declare
  ana uuid := '00000000-0000-0000-0000-00000000000a';
  bia uuid := '00000000-0000-0000-0000-00000000000b';
  caio uuid := '00000000-0000-0000-0000-00000000000c';
  v numeric;
begin
  select valor into v from public.dividas d join public.gastos g on g.id = d.gasto_id
  where g.descricao = 'Pizza' and d.devedor = bia and d.credor = ana;
  assert v = 33.333333333333333333, format('parte exata da Bia na pizza: %s', v);
  assert public.valor_a_cobrar(v) = 33.34, 'cobrança arredonda para cima';

  assert (select count(*) from public.dividas d join public.gastos g on g.id = d.gasto_id where g.descricao = 'Uber') = 1,
    'no Uber só Caio deve';
  assert (select valor from public.dividas d join public.gastos g on g.id = d.gasto_id
          where g.descricao = 'Uber' and d.devedor = caio and d.credor = ana) = 30,
    'Caio deve 30 a Ana no Uber (Bia já pagou a parte dela)';
end $$;

-- ---------------------------------------------------------------
-- Editar e excluir gasto
-- ---------------------------------------------------------------
select public.salvar_gasto(jsonb_build_object(
  'id', :'gasto1', 'grupo_id', :'mercado', 'descricao', 'Compra do mês', 'valor_total', 120, 'tipo_divisao', 'exato',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'bia', 'valor', 120)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'ana', 'parametro', 70, 'valor', 70),
    jsonb_build_object('usuario_id', :'bia', 'parametro', 50, 'valor', 50))
)) \g /dev/null

reset role;
do $$
declare
  ana uuid := '00000000-0000-0000-0000-00000000000a';
  bia uuid := '00000000-0000-0000-0000-00000000000b';
  merc uuid := (select id from public.grupos where nome = 'Mercado');
begin
  assert (select devido from public.saldos_pares where grupo_id = merc and devedor = ana and credor = bia) = 70,
    'edição recalcula a dívida da Ana';
  assert (select count(*) from public.historico where entidade = 'gastos' and acao = 'update') = 1, 'edição no histórico';
end $$;

set role authenticated;
-- só quem registrou (Ana) ou o dono exclui; Bia não pode
select set_config('request.jwt.claim.sub', :'bia', false) \g /dev/null
select testes.deve_falhar(format('select public.excluir_gasto(%L)', :'gasto1'), 'Só quem registrou') \g /dev/null
select testes.deve_falhar(format('delete from public.gastos where id = %L', :'gasto1'), 'permission denied') \g /dev/null
select set_config('request.jwt.claim.sub', :'ana', false) \g /dev/null
select public.excluir_gasto(:'gasto1') \g /dev/null

reset role;
do $$
declare
  ana uuid := '00000000-0000-0000-0000-00000000000a';
  bia uuid := '00000000-0000-0000-0000-00000000000b';
  merc uuid := (select id from public.grupos where nome = 'Mercado');
begin
  assert (select devido from public.saldos_pares where grupo_id = merc and devedor = ana and credor = bia) = 0,
    'excluir o gasto zera a dívida dele';
  assert (select count(*) from public.historico where entidade = 'gastos' and acao = 'delete') = 1, 'exclusão no histórico';
  assert public.valor_a_cobrar(20.000000000000000001) = 20.00, 'resíduo não vira centavo';
  assert public.valor_a_cobrar(0.0000000001) = 0, 'resíduo some';
end $$;

-- ---------------------------------------------------------------
-- Sair do grupo
-- ---------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'caio', false) \g /dev/null
select public.sair_do_grupo(:'mercado') \g /dev/null
do $$ begin
  assert (select count(*) from public.resumo_meus_grupos()) = 0, 'Caio não vê mais o Mercado';
  assert (select count(*) from public.gastos) = 0, 'e nem os gastos';
end $$;
select public.entrar_no_grupo(:'cod_mercado') \g /dev/null
do $$ begin
  assert (select count(*) from public.resumo_meus_grupos()) = 1, 'Caio pode voltar pelo código';
end $$;

select set_config('request.jwt.claim.sub', :'ana', false) \g /dev/null
do $$ begin
  assert (select count(*) from public.perfis) = 3, 'Ana vê os perfis de quem divide grupo com ela';
end $$;

reset role;
\echo 'Todos os testes do banco passaram.'
