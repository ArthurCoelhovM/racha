\set ON_ERROR_STOP on
\set QUIET on

-- Conferir as contas (extrato e pontos para olhar), chave Pix e primeiros passos

\set ana '00000000-0000-0000-0000-000000000501'
\set bia '00000000-0000-0000-0000-000000000502'
\set caio '00000000-0000-0000-0000-000000000503'

reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  (:'ana', 'ana8@exemplo.com', '{"nome": "Ana"}'),
  (:'bia', 'bia8@exemplo.com', '{"nome": "Bia"}'),
  (:'caio', 'caio8@exemplo.com', '{"nome": "Caio"}');

set role authenticated;

-- primeiros passos de quem acabou de chegar
select set_config('request.jwt.claim.sub', :'ana', false) \g /dev/null
do $$ begin
  assert public.primeiros_passos() = '{"tem_grupo": false, "convidou": false, "registrou_gasto": false, "marcou_pagamento": false}'::jsonb,
    'nada feito ainda';
end $$;

select public.criar_grupo('Casa 8', '#5B4CF0', true) as casa \gset
select public.codigo_do_grupo(:'casa') as cod \gset
do $$ begin
  assert (public.primeiros_passos() ->> 'tem_grupo')::boolean, 'tem grupo';
  assert not (public.primeiros_passos() ->> 'convidou')::boolean, 'ainda sozinha';
end $$;
select set_config('request.jwt.claim.sub', :'bia', false) \g /dev/null
select public.entrar_no_grupo(:'cod') \g /dev/null

-- Bia pagou a luz: 150, metade de cada
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'casa', 'descricao', 'Luz', 'valor_total', 150, 'tipo_divisao', 'igual', 'data', '2026-11-02',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'bia', 'valor', 150)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'ana', 'valor', 75),
    jsonb_build_object('usuario_id', :'bia', 'valor', 75))
)) \g /dev/null

-- Ana pagou o mercado: 100 entre as duas, 60 dela e 40 da Bia
select set_config('request.jwt.claim.sub', :'ana', false) \g /dev/null
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'casa', 'descricao', 'Mercado', 'valor_total', 100, 'tipo_divisao', 'exato', 'data', '2026-11-05',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'ana', 'valor', 100)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'ana', 'valor', 60),
    jsonb_build_object('usuario_id', :'bia', 'valor', 40))
)) as mercado \gset
-- o mesmo mercado lançado duas vezes
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'casa', 'descricao', 'mercado ', 'valor_total', 100, 'tipo_divisao', 'exato', 'data', '2026-11-05',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'ana', 'valor', 100)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'ana', 'valor', 60),
    jsonb_build_object('usuario_id', :'bia', 'valor', 40))
)) as repetido \gset
select public.excluir_gasto(:'repetido') \g /dev/null

-- Ana devia 75, Bia devia 40: abatido, Ana paga 35. Ana paga 20 por enquanto.
select public.marcar_pago(:'casa', :'ana', :'bia', 20) \g /dev/null

do $$
declare
  casa uuid := (select id from public.grupos where nome = 'Casa 8');
  bia uuid := '00000000-0000-0000-0000-000000000502';
  linhas int;
  saldo numeric;
begin
  select count(*), sum(efeito) into linhas, saldo from public.extrato_com(casa, bia);
  assert linhas = 3, 'luz, mercado e pagamento: ' || linhas;
  assert saldo = 15, 'Ana ainda deve 15 à Bia: ' || saldo;
  assert (select efeito from public.extrato_com(casa, bia) where tipo = 'gasto' and descricao = 'Luz') = 75, 'luz soma';
  assert (select efeito from public.extrato_com(casa, bia) where tipo = 'gasto' and descricao = 'Mercado') = -40,
    'mercado abate';
  assert (select efeito from public.extrato_com(casa, bia) where tipo = 'pagamento') = -20, 'pagamento abate';
  -- o saldo do extrato é o mesmo da lista de dívidas
  assert (select valor from public.pendencias_do_grupo(casa) where devedor = auth.uid())::numeric = saldo,
    'extrato bate com as dívidas';
  assert (select data from public.extrato_com(casa, bia) limit 1) = '2026-11-02', 'em ordem de data';

  assert (public.primeiros_passos() ->> 'convidou')::boolean, 'convidou a Bia';
  assert (public.primeiros_passos() ->> 'registrou_gasto')::boolean, 'registrou gasto';
  assert (public.primeiros_passos() ->> 'marcou_pagamento')::boolean, 'marcou pagamento';

  assert not exists (select 1 from public.conferir_grupo(casa)), 'tudo certo neste grupo';
end $$;

-- extrato só com quem é do grupo, e só para quem é do grupo
select testes.deve_falhar(format($q$select * from public.extrato_com('%s', '%s')$q$, :'casa', :'caio'),
  'não é deste grupo') \g /dev/null
select testes.deve_falhar(format($q$select * from public.extrato_com('%s', '%s')$q$, :'casa', :'ana'),
  'não é deste grupo') \g /dev/null
select set_config('request.jwt.claim.sub', :'caio', false) \g /dev/null
select testes.deve_falhar(format($q$select * from public.extrato_com('%s', '%s')$q$, :'casa', :'ana'),
  'não participa') \g /dev/null
select testes.deve_falhar(format($q$select * from public.conferir_grupo('%s')$q$, :'casa'), 'não participa') \g /dev/null

-- pontos para olhar: repetido e data no futuro
select set_config('request.jwt.claim.sub', :'ana', false) \g /dev/null
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'casa', 'descricao', 'Mercado', 'valor_total', 100, 'tipo_divisao', 'exato', 'data', '2026-11-05',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'ana', 'valor', 100)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'ana', 'valor', 60),
    jsonb_build_object('usuario_id', :'bia', 'valor', 40))
)) as repetido \gset
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'casa', 'descricao', 'Gás', 'valor_total', 120, 'tipo_divisao', 'igual',
  'data', public.hoje_sp() + 40,
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'ana', 'valor', 120)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'ana', 'valor', 60),
    jsonb_build_object('usuario_id', :'bia', 'valor', 60))
)) \g /dev/null

do $$
declare
  casa uuid := (select id from public.grupos where nome = 'Casa 8');
begin
  assert (select count(*) from public.conferir_grupo(casa) where tipo = 'duplicado') = 1, 'um repetido';
  assert (select descricao from public.conferir_grupo(casa) where tipo = 'futuro') = 'Gás', 'gás no futuro';
  assert not exists (select 1 from public.conferir_grupo(casa) where tipo = 'nao_fecha'), 'as contas fecham';
end $$;

-- um gasto que não fecha (só dá para fazer por baixo, o app não deixa)
reset role;
update public.gasto_divisoes set valor = 50
where gasto_id = (select id from public.gastos where descricao = 'Luz' and grupo_id = (select id from public.grupos where nome = 'Casa 8'))
  and usuario_id = :'ana';
set role authenticated;
select set_config('request.jwt.claim.sub', :'ana', false) \g /dev/null
do $$ begin
  assert (select descricao from public.conferir_grupo((select id from public.grupos where nome = 'Casa 8'))
          where tipo = 'nao_fecha') = 'Luz', 'a luz não fecha';
end $$;

-- chave Pix: a pessoa grava a dela; quem divide grupo lê; quem não divide, não
update public.perfis set chave_pix = 'ana@exemplo.com' where id = :'ana';
select set_config('request.jwt.claim.sub', :'bia', false) \g /dev/null
do $$ begin
  assert (select chave_pix from public.perfis where id = '00000000-0000-0000-0000-000000000501') = 'ana@exemplo.com',
    'Bia lê a chave da Ana';
end $$;
update public.perfis set chave_pix = 'golpe' where id = :'ana';
select set_config('request.jwt.claim.sub', :'caio', false) \g /dev/null
do $$ begin
  assert (select count(*) from public.perfis where id = '00000000-0000-0000-0000-000000000501') = 0,
    'Caio não vê a Ana';
end $$;
select set_config('request.jwt.claim.sub', :'ana', false) \g /dev/null
do $$ begin
  assert (select chave_pix from public.perfis where id = auth.uid()) = 'ana@exemplo.com', 'só ela muda a chave';
  assert (public.meus_dados() -> 'perfil' ->> 'chave_pix') = 'ana@exemplo.com', 'chave nos meus dados';
end $$;
select testes.deve_falhar($q$update public.perfis set chave_pix = 'x' where id = auth.uid()$q$, 'chave_pix') \g /dev/null

reset role;
select public.anonimizar_conta(:'ana') \g /dev/null
do $$ begin
  assert (select chave_pix from public.perfis where id = '00000000-0000-0000-0000-000000000501') is null,
    'conta excluída sem chave';
end $$;

\echo 'Todos os testes do conferir, do Pix e dos primeiros passos passaram.'
