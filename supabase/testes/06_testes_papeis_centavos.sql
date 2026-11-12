\set ON_ERROR_STOP on
\set QUIET on

-- Papéis e permissões, centavos exatos e quem saiu do grupo (pedidos de 12/11)

\set rui  '00000000-0000-0000-0000-000000000301'
\set sol  '00000000-0000-0000-0000-000000000302'
\set teo  '00000000-0000-0000-0000-000000000303'
\set ula  '00000000-0000-0000-0000-000000000304'
\set vivi '00000000-0000-0000-0000-000000000305'
\set xan  '00000000-0000-0000-0000-000000000306'

reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  (:'rui',  'rui@exemplo.com',  '{"nome": "Rui"}'),
  (:'sol',  'sol@exemplo.com',  '{"nome": "Sol"}'),
  (:'teo',  'teo@exemplo.com',  '{"nome": "Teo"}'),
  (:'ula',  'ula@exemplo.com',  '{"nome": "Ula"}'),
  (:'vivi', 'vivi@exemplo.com', '{"nome": "Vivi"}'),
  (:'xan',  'xan@exemplo.com',  '{"nome": "Xan"}');

set role authenticated;
select set_config('request.jwt.claim.sub', :'rui', false) \g /dev/null
select public.criar_grupo('República', '#0F766E', false) as rep \gset
select public.codigo_do_grupo(:'rep') as cod \gset
select set_config('request.jwt.claim.sub', :'sol', false) \g /dev/null
select public.entrar_no_grupo(:'cod') \g /dev/null
select set_config('request.jwt.claim.sub', :'teo', false) \g /dev/null
select public.entrar_no_grupo(:'cod') \g /dev/null

-- ---------------------------------------------------------------
-- Papéis: por padrão, configurações e remover pessoas são de admin para cima
-- ---------------------------------------------------------------
select testes.deve_falhar(format('select public.atualizar_grupo(%L, ''X'', ''#000000'', true, array[''igual''], 7)', :'rep'), 'mudar as configurações') \g /dev/null
select testes.deve_falhar(format('select public.remover_membro(%L, %L)', :'rep', :'sol'), 'remover pessoas') \g /dev/null
select testes.deve_falhar(format('select public.definir_papel(%L, %L, ''admin'')', :'rep', :'teo'), 'Só o dono') \g /dev/null
select testes.deve_falhar(format('select public.definir_permissoes(%L, ''{"registrar_gastos": "admin"}'')', :'rep'), 'Só o dono') \g /dev/null
-- membro convida por padrão
select public.codigo_do_grupo(:'rep') is not null as ok \gset

select set_config('request.jwt.claim.sub', :'rui', false) \g /dev/null
select public.definir_papel(:'rep', :'sol', 'admin') \g /dev/null
select testes.deve_falhar(format('select public.definir_papel(%L, %L, ''dono'')', :'rep', :'teo'), 'Papel inválido') \g /dev/null
select testes.deve_falhar(format('select public.definir_permissoes(%L, ''{"registrar_gastos": "chefe"}'')', :'rep'), 'inválidas') \g /dev/null
select testes.deve_falhar(format('select public.definir_permissoes(%L, ''{"apagar_tudo": "membro"}'')', :'rep'), 'inválidas') \g /dev/null

-- admin muda as configurações
select set_config('request.jwt.claim.sub', :'sol', false) \g /dev/null
select public.atualizar_grupo(:'rep', 'República 21', '#0F766E', false, array['igual', 'exato', 'itens'], 7) \g /dev/null

-- o dono restringe registrar gastos e convidar a admins
select set_config('request.jwt.claim.sub', :'rui', false) \g /dev/null
select public.definir_permissoes(:'rep', '{"registrar_gastos": "admin", "convidar_membros": "admin"}') \g /dev/null

select set_config('request.jwt.claim.sub', :'teo', false) \g /dev/null
select testes.deve_falhar(format(
  $q$select public.salvar_gasto('{"grupo_id": "%s", "descricao": "x", "valor_total": 10, "tipo_divisao": "igual",
     "pagadores": [{"usuario_id": "%s", "valor": 10}], "divisoes": [{"usuario_id": "%s", "valor": 10}]}'::jsonb)$q$,
  :'rep', :'teo', :'teo'), 'registrar gastos') \g /dev/null
select testes.deve_falhar(format('select public.codigo_do_grupo(%L)', :'rep'), 'convidar') \g /dev/null
select testes.deve_falhar(format('select public.novo_codigo_convite(%L)', :'rep'), 'convidar') \g /dev/null
select testes.deve_falhar(format('select codigo_convite from public.grupos where id = %L', :'rep'), 'permission denied') \g /dev/null

-- volta a liberar e testa editar gasto dos outros
select set_config('request.jwt.claim.sub', :'rui', false) \g /dev/null
select public.definir_permissoes(:'rep', '{"registrar_gastos": "membro", "convidar_membros": "membro"}') \g /dev/null

-- ---------------------------------------------------------------
-- Centavos: R$ 100 entre 3, Rui pagou -> 33,34 para o Rui e 33,33 para os outros
-- ---------------------------------------------------------------
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'rep', 'descricao', 'Mercado', 'valor_total', 100, 'tipo_divisao', 'igual',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'rui', 'valor', 100)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'sol', 'valor', 33.333333333333333333),
    jsonb_build_object('usuario_id', :'rui', 'valor', 33.333333333333333334),
    jsonb_build_object('usuario_id', :'teo', 'valor', 33.333333333333333333))
)) as mercado \gset

reset role;
do $$
declare
  rui uuid := '00000000-0000-0000-0000-000000000301';
  m uuid := (select id from public.gastos where descricao = 'Mercado');
begin
  assert (select valor from public.gasto_divisoes where gasto_id = m and usuario_id = rui) = 33.34, 'quem pagou fica com o centavo';
  assert (select count(*) from public.gasto_divisoes where gasto_id = m and valor = 33.33) = 2, 'os outros pagam 33,33';
  assert (select sum(valor) from public.gasto_divisoes where gasto_id = m) = 100, 'somam o total';
  assert (select sum(valor) from public.dividas where gasto_id = m) = 66.66, 'dívidas em centavos';
  assert (select bool_and(valor = round(valor, 2)) from public.dividas), 'toda dívida em centavos';
end $$;

-- Teo não pode editar o gasto do Rui (editar gastos de outros é de admin)
set role authenticated;
select set_config('request.jwt.claim.sub', :'teo', false) \g /dev/null
select testes.deve_falhar(format(
  $q$select public.salvar_gasto('{"id": "%s", "grupo_id": "%s", "descricao": "Mercado!", "valor_total": 100, "tipo_divisao": "igual",
     "pagadores": [{"usuario_id": "%s", "valor": 100}], "divisoes": [{"usuario_id": "%s", "valor": 100}]}'::jsonb)$q$,
  :'mercado', :'rep', :'rui', :'rui'), 'editar gastos de outras pessoas') \g /dev/null
select testes.deve_falhar(format('select public.excluir_gasto(%L)', :'mercado'), 'excluir gastos de outras pessoas') \g /dev/null

-- valor pago com mais de 2 casas é recusado
select testes.deve_falhar(format(
  $q$select public.salvar_gasto('{"grupo_id": "%s", "descricao": "x", "valor_total": 10, "tipo_divisao": "igual",
     "pagadores": [{"usuario_id": "%s", "valor": 9.995}, {"usuario_id": "%s", "valor": 0.005}],
     "divisoes": [{"usuario_id": "%s", "valor": 10}]}'::jsonb)$q$,
  :'rep', :'teo', :'rui', :'teo'), 'reais e centavos') \g /dev/null

-- Vários pagadores e nenhum deles divide: cada devedor paga a sua parte e cada pagador recebe o que adiantou
select set_config('request.jwt.claim.sub', :'rui', false) \g /dev/null
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'rep', 'descricao', 'Presente', 'valor_total', 10, 'tipo_divisao', 'igual',
  'pagadores', jsonb_build_array(
    jsonb_build_object('usuario_id', :'rui', 'valor', 3.33),
    jsonb_build_object('usuario_id', :'sol', 'valor', 3.34),
    jsonb_build_object('usuario_id', :'teo', 'valor', 3.33)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'rui', 'valor', 0),
    jsonb_build_object('usuario_id', :'sol', 'valor', 5),
    jsonb_build_object('usuario_id', :'teo', 'valor', 5))
)) as presente \gset

reset role;
do $$
declare
  p uuid := (select id from public.gastos where descricao = 'Presente');
  v_errado int;
begin
  -- quanto cada um ficou devendo é exatamente parte - pago
  select count(*) into v_errado
  from (
    select u, sum(saldo) as saldo from (
      select usuario_id as u, valor as saldo from public.gasto_pagadores where gasto_id = p
      union all select usuario_id, -valor from public.gasto_divisoes where gasto_id = p
      union all select devedor, valor from public.dividas where gasto_id = p
      union all select credor, -valor from public.dividas where gasto_id = p
    ) x group by u
  ) y where saldo <> 0;
  assert v_errado = 0, 'as dívidas fecham exatamente o que cada um pagou e deve';
  assert (select bool_and(valor = round(valor, 2)) from public.dividas where gasto_id = p), 'em centavos';
end $$;

-- ---------------------------------------------------------------
-- Pagamento em centavos
-- ---------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'teo', false) \g /dev/null
select public.marcar_pago(:'rep', :'teo', :'rui', 33.33, :'mercado') \g /dev/null
do $$ begin
  assert not exists (select 1 from public.pendencias_do_grupo((select id from public.grupos where nome = 'República 21'))
                     where gasto_id = (select id from public.gastos where descricao = 'Mercado')
                       and devedor = '00000000-0000-0000-0000-000000000303'),
    'Teo quitou o mercado sem sobrar fração';
end $$;

-- ---------------------------------------------------------------
-- Remover e passar o dono; quem saiu continua vendo e pagando
-- ---------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'sol', false) \g /dev/null
select public.remover_membro(:'rep', :'teo') \g /dev/null
select testes.deve_falhar(format('select public.remover_membro(%L, %L)', :'rep', :'rui'), 'dono não pode') \g /dev/null

select set_config('request.jwt.claim.sub', :'teo', false) \g /dev/null
do $$
declare
  rep uuid := (select grupo_id from public.pendencias_de_grupos_que_sai() limit 1);
begin
  assert (select count(*) from public.avisos where tipo = 'membro' and corpo like 'Você foi removido%') = 1, 'Teo é avisado';
  assert exists (select 1 from public.pendencias_de_grupos_que_sai()), 'Teo vê o que deve no grupo que deixou';
  assert (select grupo_nome from public.pendencias_de_grupos_que_sai() limit 1) = 'República 21', 'com o nome do grupo';
  assert not public.eh_membro(rep), 'mas não é mais membro';
end $$;
select count(*) as antes_teo from public.pendencias_de_grupos_que_sai() where devedor = :'teo' \gset
select grupo_id as rep2, devedor as de2, credor as para2, gasto_id as gasto2, valor as valor2
from public.pendencias_de_grupos_que_sai() where devedor = :'teo' limit 1 \gset
select public.marcar_pago(:'rep2', :'de2', :'para2', :'valor2', nullif(:'gasto2', '')::uuid) \g /dev/null
select count(*) = :antes_teo - 1 as quitou from public.pendencias_de_grupos_que_sai() where devedor = :'teo' \gset
\if :quitou
\else
  \echo 'Quem saiu não conseguiu marcar o que pagou'
  select 1/0;
\endif

select set_config('request.jwt.claim.sub', :'rui', false) \g /dev/null
select public.passar_dono(:'rep', :'sol') \g /dev/null
do $$ begin
  assert (select papel from public.membros where usuario_id = '00000000-0000-0000-0000-000000000302'
          and grupo_id = (select id from public.grupos where nome = 'República 21')) = 'dono', 'Sol é a dona';
  assert (select papel from public.membros where usuario_id = '00000000-0000-0000-0000-000000000301'
          and grupo_id = (select id from public.grupos where nome = 'República 21')) = 'admin', 'Rui virou admin';
end $$;

-- a dona sai: o admin assume antes de um membro mais antigo
select set_config('request.jwt.claim.sub', :'ula', false) \g /dev/null
select public.criar_grupo('Futsal') as fut \gset
select public.codigo_do_grupo(:'fut') as cod_fut \gset
select set_config('request.jwt.claim.sub', :'vivi', false) \g /dev/null
select public.entrar_no_grupo(:'cod_fut') \g /dev/null
select set_config('request.jwt.claim.sub', :'xan', false) \g /dev/null
select public.entrar_no_grupo(:'cod_fut') \g /dev/null
select set_config('request.jwt.claim.sub', :'ula', false) \g /dev/null
select public.definir_papel(:'fut', :'xan', 'admin') \g /dev/null
select public.sair_do_grupo(:'fut') \g /dev/null
reset role;
do $$ begin
  assert (select papel from public.membros where usuario_id = '00000000-0000-0000-0000-000000000306'
          and grupo_id = (select id from public.grupos where nome = 'Futsal')) = 'dono', 'o admin vira dono';
end $$;

-- Cobrar: Rui cobra a Sol (que deve o Presente); a segunda cobrança seguida é recusada
set role authenticated;
select set_config('request.jwt.claim.sub', :'rui', false) \g /dev/null
select public.cobrar(:'rep', :'sol') as cobrado \gset
select testes.deve_falhar(format('select public.cobrar(%L, %L)', :'rep', :'sol'), '12 horas') \g /dev/null
select testes.deve_falhar(format('select public.cobrar(%L, %L)', :'rep', :'rui'), 'não te deve') \g /dev/null
select set_config('request.jwt.claim.sub', :'sol', false) \g /dev/null
do $$ begin
  assert (select corpo from public.avisos where tipo = 'cobranca') like 'Rui pediu para você acertar R$ %', 'Sol recebe a cobrança';
end $$;

\echo 'Todos os testes de papéis, centavos e de quem saiu passaram.'
