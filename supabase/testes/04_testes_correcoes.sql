\set ON_ERROR_STOP on
\set QUIET on

-- Testes das correções da revisão: cada bloco falhava antes da correção

\set lia  '00000000-0000-0000-0000-000000000101'
\set malu '00000000-0000-0000-0000-000000000102'
\set nina '00000000-0000-0000-0000-000000000103'
\set otto '00000000-0000-0000-0000-000000000104'

reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  (:'lia',  'lia@exemplo.com',  '{"nome": "Lia"}'),
  (:'malu', 'malu@exemplo.com', '{"nome": "Malu"}'),
  (:'nina', 'nina@exemplo.com', '{"nome": "Nina"}'),
  (:'otto', 'otto@exemplo.com', '{"nome": "Otto"}');

set role authenticated;
select set_config('request.jwt.claim.sub', :'lia', false) \g /dev/null
select public.criar_grupo('Viagem', '#5B4CF0', true) as viagem \gset
select public.criar_grupo('Casa nova', '#E8680A', false) as casa \gset
select codigo_convite as cod_viagem from public.grupos where id = :'viagem' \gset
select codigo_convite as cod_casa from public.grupos where id = :'casa' \gset

select set_config('request.jwt.claim.sub', :'malu', false) \g /dev/null
select public.entrar_no_grupo(:'cod_viagem') \g /dev/null
select public.entrar_no_grupo(:'cod_casa') \g /dev/null
select set_config('request.jwt.claim.sub', :'nina', false) \g /dev/null
select public.entrar_no_grupo(:'cod_viagem') \g /dev/null

-- ---------------------------------------------------------------
-- Bug 2: pagamento em dobro e valor acima do aberto
-- ---------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'malu', false) \g /dev/null
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'viagem', 'descricao', 'Hotel', 'valor_total', 100, 'tipo_divisao', 'igual',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'malu', 'valor', 100)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'lia', 'valor', 50),
    jsonb_build_object('usuario_id', :'malu', 'valor', 50))
)) as hotel \gset

-- Lia marca que pagou; Malu tenta marcar o mesmo pagamento logo depois
select set_config('request.jwt.claim.sub', :'lia', false) \g /dev/null
select public.marcar_pago(:'viagem', :'lia', :'malu', 50) \g /dev/null
select set_config('request.jwt.claim.sub', :'malu', false) \g /dev/null
select testes.deve_falhar(format('select public.marcar_pago(%L, %L, %L, 50)', :'viagem', :'lia', :'malu'), 'já está paga') \g /dev/null
do $$ begin
  assert (select count(*) from public.pendencias_do_grupo((select id from public.grupos where nome = 'Viagem'))) = 0,
    'a dívida não inverteu';
end $$;

-- valor acima do aberto e pagamento parcial
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'viagem', 'descricao', 'Jantar', 'valor_total', 60, 'tipo_divisao', 'igual',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'malu', 'valor', 60)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'lia', 'valor', 30),
    jsonb_build_object('usuario_id', :'malu', 'valor', 30))
)) \g /dev/null
select set_config('request.jwt.claim.sub', :'lia', false) \g /dev/null
select testes.deve_falhar(format('select public.marcar_pago(%L, %L, %L, 40)', :'viagem', :'lia', :'malu'), 'passa do que está em aberto (R$ 30,00)') \g /dev/null
select testes.deve_falhar(format('select public.marcar_pago(%L, %L, %L, 5)', :'viagem', :'malu', :'lia'), 'já está paga') \g /dev/null
select public.marcar_pago(:'viagem', :'lia', :'malu', 10) \g /dev/null
select public.marcar_pago(:'viagem', :'lia', :'malu', 20) \g /dev/null
select testes.deve_falhar(format('select public.marcar_pago(%L, %L, %L, 0.01)', :'viagem', :'lia', :'malu'), 'já está paga') \g /dev/null

-- ---------------------------------------------------------------
-- Bug 6: tela inicial e tela do grupo somam as mesmas pendências
-- ---------------------------------------------------------------
-- Casa nova, sem abatimento: dois gastos de 10 divididos por 3 -> duas dívidas de 3,333...
select set_config('request.jwt.claim.sub', :'lia', false) \g /dev/null
select set_config('request.jwt.claim.sub', :'nina', false) \g /dev/null
select public.entrar_no_grupo(:'cod_casa') \g /dev/null
select set_config('request.jwt.claim.sub', :'lia', false) \g /dev/null

select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'casa', 'descricao', 'Pão', 'valor_total', 10, 'tipo_divisao', 'igual', 'data', '2026-10-01',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'lia', 'valor', 10)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'lia', 'valor', 3.333333333333333334),
    jsonb_build_object('usuario_id', :'malu', 'valor', 3.333333333333333333),
    jsonb_build_object('usuario_id', :'nina', 'valor', 3.333333333333333333))
)) as pao \gset
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'casa', 'descricao', 'Leite', 'valor_total', 10, 'tipo_divisao', 'igual', 'data', '2026-10-02',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'lia', 'valor', 10)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'lia', 'valor', 3.333333333333333334),
    jsonb_build_object('usuario_id', :'malu', 'valor', 3.333333333333333333),
    jsonb_build_object('usuario_id', :'nina', 'valor', 3.333333333333333333))
)) as leite \gset

select set_config('request.jwt.claim.sub', :'malu', false) \g /dev/null
do $$
declare
  casa uuid := (select id from public.grupos where nome = 'Casa nova');
begin
  assert (select count(*) from public.pendencias_do_grupo(casa) where devedor = '00000000-0000-0000-0000-000000000102') = 2,
    'sem abatimento, uma pendência por gasto';
  assert (select sum(cobrar::numeric) from public.pendencias_do_grupo(casa) where devedor = '00000000-0000-0000-0000-000000000102') = 6.68,
    'cada gasto é cobrado arredondado para cima';
  assert (select voce_deve from public.resumo_meus_grupos() where grupo_id = casa) = 6.68,
    format('a tela inicial mostra o mesmo total: %s', (select voce_deve from public.resumo_meus_grupos() where grupo_id = casa));
  assert (select valor from public.pendencias_do_grupo(casa) where descricao = 'Pão' and devedor = '00000000-0000-0000-0000-000000000102')
    = '3.333333333333333333', 'o valor exato vem em texto, sem perder casas';
end $$;

-- sem abatimento: pagamento sem gasto quita os mais antigos primeiro (Pão, depois Leite)
select public.marcar_pago(:'casa', :'malu', :'lia', 5) \g /dev/null
do $$
declare
  casa uuid := (select id from public.grupos where nome = 'Casa nova');
begin
  assert not exists (select 1 from public.pendencias_do_grupo(casa) where descricao = 'Pão' and devedor = '00000000-0000-0000-0000-000000000102'),
    'o Pão foi quitado primeiro';
  assert (select valor::numeric from public.pendencias_do_grupo(casa) where descricao = 'Leite' and devedor = '00000000-0000-0000-0000-000000000102')
    = 1.666666666666666666, 'o resto ficou no Leite';
end $$;
-- pagamento ligado a um gasto não passa do que falta nele
select testes.deve_falhar(format('select public.marcar_pago(%L, %L, %L, 2, %L)', :'casa', :'malu', :'lia', :'leite'), 'passa do que está em aberto (R$ 1,67)') \g /dev/null
select public.marcar_pago(:'casa', :'malu', :'lia', 1.666666666666666666, :'leite') \g /dev/null
do $$ begin
  assert (select voce_deve from public.resumo_meus_grupos() where nome = 'Casa nova') = 0, 'Malu quitou a Casa nova';
end $$;

-- simular o abatimento sem mudar o grupo (para mostrar o antes e depois)
select set_config('request.jwt.claim.sub', :'malu', false) \g /dev/null
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'casa', 'descricao', 'Gás', 'valor_total', 20, 'tipo_divisao', 'exato',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'malu', 'valor', 20)),
  'divisoes', jsonb_build_array(jsonb_build_object('usuario_id', :'lia', 'parametro', 20, 'valor', 20))
)) \g /dev/null
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'casa', 'descricao', 'Feira', 'valor_total', 12, 'tipo_divisao', 'exato',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'lia', 'valor', 12)),
  'divisoes', jsonb_build_array(jsonb_build_object('usuario_id', :'malu', 'parametro', 12, 'valor', 12))
)) \g /dev/null
do $$
declare
  casa uuid := (select id from public.grupos where nome = 'Casa nova');
  malu uuid := '00000000-0000-0000-0000-000000000102';
begin
  assert (select sum(cobrar::numeric) from public.pendencias_do_grupo(casa) where devedor = malu) = 12, 'sem abatimento Malu deve 12';
  assert (select sum(cobrar::numeric) from public.pendencias_do_grupo(casa, true) where credor = malu) = 8,
    'com abatimento simulado, Lia deve só a diferença';
  assert (select count(*) from public.pendencias_do_grupo(casa, true) where devedor = malu) = 0, 'e Malu não deve nada';
  assert not (select abatimento from public.grupos where id = casa), 'a simulação não mudou o grupo';
end $$;

-- quem é de fora não vê as pendências
select set_config('request.jwt.claim.sub', :'otto', false) \g /dev/null
select testes.deve_falhar(format('select * from public.pendencias_do_grupo(%L)', :'casa'), 'não participa') \g /dev/null

-- ---------------------------------------------------------------
-- Bug 3: editar gasto antigo mantém quem saiu do grupo
-- ---------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'lia', false) \g /dev/null
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'viagem', 'descricao', 'Passeio', 'valor_total', 90, 'tipo_divisao', 'igual',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'lia', 'valor', 90)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'lia', 'valor', 30),
    jsonb_build_object('usuario_id', :'malu', 'valor', 30),
    jsonb_build_object('usuario_id', :'nina', 'valor', 30))
)) as passeio \gset

select set_config('request.jwt.claim.sub', :'nina', false) \g /dev/null
select public.sair_do_grupo(:'viagem') \g /dev/null

select set_config('request.jwt.claim.sub', :'lia', false) \g /dev/null
select public.salvar_gasto(jsonb_build_object(
  'id', :'passeio', 'grupo_id', :'viagem', 'descricao', 'Passeio de barco', 'valor_total', 90, 'tipo_divisao', 'igual',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'lia', 'valor', 90)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'lia', 'valor', 30),
    jsonb_build_object('usuario_id', :'malu', 'valor', 30),
    jsonb_build_object('usuario_id', :'nina', 'valor', 30))
)) \g /dev/null
do $$ begin
  assert (select valor from public.dividas d join public.gastos g on g.id = d.gasto_id
          where g.descricao = 'Passeio de barco' and d.devedor = '00000000-0000-0000-0000-000000000103') = 30,
    'Nina continua devendo a parte dela no gasto editado';
end $$;

-- mas quem saiu não entra em gasto novo, e quem nunca esteve no gasto também não
select testes.deve_falhar(format(
  $q$select public.salvar_gasto('{"grupo_id": "%s", "descricao": "x", "valor_total": 10, "tipo_divisao": "igual",
     "pagadores": [{"usuario_id": "%s", "valor": 10}], "divisoes": [{"usuario_id": "%s", "valor": 10}]}'::jsonb)$q$,
  :'viagem', :'lia', :'nina'), 'membros do grupo') \g /dev/null
select testes.deve_falhar(format(
  $q$select public.salvar_gasto('{"id": "%s", "grupo_id": "%s", "descricao": "x", "valor_total": 90, "tipo_divisao": "igual",
     "pagadores": [{"usuario_id": "%s", "valor": 90}], "divisoes": [{"usuario_id": "%s", "valor": 90}]}'::jsonb)$q$,
  :'passeio', :'viagem', :'lia', :'otto'), 'membros do grupo') \g /dev/null

-- ---------------------------------------------------------------
-- Bug 4: datas no horário de São Paulo
-- ---------------------------------------------------------------
do $$ begin
  assert public.hoje_sp() = (now() at time zone 'America/Sao_Paulo')::date, 'hoje_sp segue São Paulo';
  assert (select pg_get_expr(adbin, adrelid) from pg_attrdef
          where adrelid = 'public.gastos'::regclass
            and adnum = (select attnum from pg_attribute where attrelid = 'public.gastos'::regclass and attname = 'data'))
         = 'hoje_sp()', 'a data padrão do gasto também';
end $$;

-- ---------------------------------------------------------------
-- Bug 5: e-mail dos outros não aparece
-- ---------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'malu', false) \g /dev/null
select testes.deve_falhar('select email from public.perfis', 'permission denied') \g /dev/null
select testes.deve_falhar('select * from public.perfis', 'permission denied') \g /dev/null
do $$ begin
  assert (select nome from public.perfis where id = '00000000-0000-0000-0000-000000000101') = 'Lia', 'o nome continua visível';
end $$;

-- ---------------------------------------------------------------
-- Bugs 7 e 8: exclusão, avisos de edição e de abatimento
-- ---------------------------------------------------------------
-- Malu registrou o Jantar; Nina já saiu; Lia (dona) pode excluir qualquer gasto
select set_config('request.jwt.claim.sub', :'malu', false) \g /dev/null
update public.avisos set lido = true;
select testes.deve_falhar(format('select public.excluir_gasto(%L)', :'passeio'), 'Só quem registrou') \g /dev/null

-- edição que muda a parte da Malu: ela é avisada; edição só no nome não avisa
select set_config('request.jwt.claim.sub', :'lia', false) \g /dev/null
select public.salvar_gasto(jsonb_build_object(
  'id', :'passeio', 'grupo_id', :'viagem', 'descricao', 'Passeio de barco', 'valor_total', 90, 'tipo_divisao', 'exato',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'lia', 'valor', 90)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'lia', 'parametro', 20, 'valor', 20),
    jsonb_build_object('usuario_id', :'malu', 'parametro', 40, 'valor', 40),
    jsonb_build_object('usuario_id', :'nina', 'parametro', 30, 'valor', 30))
)) \g /dev/null
select public.salvar_gasto(jsonb_build_object(
  'id', :'passeio', 'grupo_id', :'viagem', 'descricao', 'Barco', 'valor_total', 90, 'tipo_divisao', 'exato',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'lia', 'valor', 90)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'lia', 'parametro', 20, 'valor', 20),
    jsonb_build_object('usuario_id', :'malu', 'parametro', 40, 'valor', 40),
    jsonb_build_object('usuario_id', :'nina', 'parametro', 30, 'valor', 30))
)) \g /dev/null

select set_config('request.jwt.claim.sub', :'malu', false) \g /dev/null
do $$ begin
  assert (select count(*) from public.avisos where tipo = 'gasto_editado') = 1, 'uma edição avisada, a do nome não';
  assert (select corpo from public.avisos where tipo = 'gasto_editado') = 'Lia editou o gasto. Sua parte: R$ 30,00 → R$ 40,00.',
    format('texto: %s', (select corpo from public.avisos where tipo = 'gasto_editado'));
end $$;

select set_config('request.jwt.claim.sub', :'lia', false) \g /dev/null
select public.excluir_gasto(:'passeio') \g /dev/null
-- abatimento desligado e ligado: todo mundo é avisado
update public.grupos set abatimento = false where id = :'viagem';

select set_config('request.jwt.claim.sub', :'malu', false) \g /dev/null
do $$ begin
  assert (select corpo from public.avisos where tipo = 'gasto_excluido') = 'Lia excluiu "Barco" de R$ 90,00. Sua parte era R$ 40,00.',
    format('texto: %s', (select corpo from public.avisos where tipo = 'gasto_excluido'));
  assert (select titulo from public.avisos where tipo = 'grupo') = 'Viagem: abatimento desligado', 'aviso de abatimento';
  assert (select count(*) from public.historico where entidade = 'gastos' and acao = 'delete') = 1, 'exclusão no histórico';
  assert (select jsonb_array_length(antes -> 'divisoes') from public.historico where entidade = 'gastos' and acao = 'delete') = 3,
    'o histórico da exclusão guarda as partes';
end $$;

-- ---------------------------------------------------------------
-- Bug 9: trocar o código fica no histórico como troca de código; salvar sem mudar nada não registra
-- ---------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'lia', false) \g /dev/null
update public.grupos set nome = nome where id = :'viagem';
select public.novo_codigo_convite(:'viagem') \g /dev/null
do $$ begin
  assert (select count(*) from public.historico where entidade = 'grupos') = 2, 'só o abatimento e a troca de código';
  assert (select (antes ->> 'codigo_convite') <> (depois ->> 'codigo_convite') from public.historico
          where entidade = 'grupos' order by id desc limit 1), 'a última mudança é a do código';
end $$;

-- ---------------------------------------------------------------
-- Bug 15: código com 6 letras do alfabeto sem confusão
-- ---------------------------------------------------------------
reset role;
do $$ begin
  assert (select bool_and(c ~ '^[A-HJ-NP-Z2-9]{6}$') from (select public.gerar_codigo() as c from generate_series(1, 500)) x),
    'formato do código';
  assert (select count(distinct public.gerar_codigo()) from generate_series(1, 500)) >= 499, 'códigos variados';
end $$;

-- ---------------------------------------------------------------
-- Bug 16: o grupo nunca fica sem dono
-- ---------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'lia', false) \g /dev/null
select public.sair_do_grupo(:'viagem') \g /dev/null
reset role;
do $$
declare
  viagem uuid := (select id from public.grupos where nome = 'Viagem');
begin
  assert (select usuario_id from public.membros where grupo_id = viagem and papel = 'dono')
         = '00000000-0000-0000-0000-000000000102', 'Malu, a mais antiga que ficou, virou dona';
  assert (select count(*) from public.membros where grupo_id = viagem and papel = 'dono') = 1, 'só uma dona';
end $$;
-- a conta da dona é excluída: o membro ativo mais antigo assume
select public.anonimizar_conta(:'lia') \g /dev/null
do $$
declare
  casa uuid := (select id from public.grupos where nome = 'Casa nova');
begin
  assert (select usuario_id from public.membros where grupo_id = casa and papel = 'dono')
         = '00000000-0000-0000-0000-000000000102', 'Malu assume a Casa nova';
end $$;

-- ---------------------------------------------------------------
-- Bug 13: limite de leituras de cupom
-- ---------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'malu', false) \g /dev/null
select public.registrar_leitura_nfce() from generate_series(1, 10) \g /dev/null
select testes.deve_falhar('select public.registrar_leitura_nfce()', 'Muitas leituras') \g /dev/null

-- ---------------------------------------------------------------
-- Bug 17: limpeza de dados antigos
-- ---------------------------------------------------------------
reset role;
update public.avisos set criado_em = now() - interval '100 days' where usuario_id = :'malu' and lido;
update public.leituras_nfce set criado_em = now() - interval '2 days';
do $$
declare
  malu uuid := '00000000-0000-0000-0000-000000000102';
  nao_lidos int := (select count(*) from public.avisos where usuario_id = malu and not lido);
begin
  assert public.limpar_dados_antigos() > 0, 'apagou alguma coisa';
  assert (select count(*) from public.avisos where usuario_id = malu and lido) = 0, 'avisos lidos antigos sumiram';
  assert (select count(*) from public.avisos where usuario_id = malu and not lido) = nao_lidos, 'não lidos ficaram';
  assert (select count(*) from public.leituras_nfce) = 0, 'leituras antigas sumiram';
end $$;
set role authenticated;
select testes.deve_falhar('select public.limpar_dados_antigos()', 'permission denied') \g /dev/null

reset role;
\echo 'Todos os testes das correções passaram.'
