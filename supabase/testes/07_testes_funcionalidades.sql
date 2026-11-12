\set ON_ERROR_STOP on
\set QUIET on

-- Funcionalidades novas: categorias, recorrente com valor variável, busca, arquivar, apelido, comentários e meus dados

\set yara '00000000-0000-0000-0000-000000000401'
\set zeca '00000000-0000-0000-0000-000000000402'

reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  (:'yara', 'yara@exemplo.com', '{"nome": "Yara"}'),
  (:'zeca', 'zeca@exemplo.com', '{"nome": "Zeca"}');

set role authenticated;
select set_config('request.jwt.claim.sub', :'yara', false) \g /dev/null
select public.criar_grupo('Apê 7', '#0E7C3F', false) as ape \gset
select public.codigo_do_grupo(:'ape') as cod \gset
select set_config('request.jwt.claim.sub', :'zeca', false) \g /dev/null
select public.entrar_no_grupo(:'cod') \g /dev/null
select set_config('request.jwt.claim.sub', :'yara', false) \g /dev/null

-- categoria
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'ape', 'descricao', 'Feira', 'valor_total', 80, 'tipo_divisao', 'itens', 'categoria', 'mercado',
  'data', '2026-10-05',
  'itens', jsonb_build_array(
    jsonb_build_object('descricao', 'Café', 'valor', '30.00', 'participantes', jsonb_build_array(:'yara', :'zeca')),
    jsonb_build_object('descricao', 'Pão', 'valor', '50.00', 'participantes', jsonb_build_array(:'yara', :'zeca'))),
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'yara', 'valor', 80)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'yara', 'valor', 40),
    jsonb_build_object('usuario_id', :'zeca', 'valor', 40))
)) as feira \gset
select testes.deve_falhar(format(
  $q$select public.salvar_gasto('{"grupo_id": "%s", "descricao": "x", "valor_total": 10, "tipo_divisao": "igual", "categoria": "cassino",
     "pagadores": [{"usuario_id": "%s", "valor": 10}], "divisoes": [{"usuario_id": "%s", "valor": 10}]}'::jsonb)$q$,
  :'ape', :'yara', :'yara'), 'categoria') \g /dev/null
select testes.deve_falhar(format(
  $q$select public.salvar_gasto('{"grupo_id": "%s", "descricao": "x", "valor_total": 10, "tipo_divisao": "igual", "comprovante": "outro-grupo/x.jpg",
     "pagadores": [{"usuario_id": "%s", "valor": 10}], "divisoes": [{"usuario_id": "%s", "valor": 10}]}'::jsonb)$q$,
  :'ape', :'yara', :'yara'), 'Comprovante de outro grupo') \g /dev/null

-- recorrente com valor variável: no dia, vira um lançamento pendente e um aviso para quem paga
select public.criar_recorrente(jsonb_build_object(
  'grupo_id', :'ape', 'descricao', 'Luz', 'valor_total', 150, 'tipo_divisao', 'igual', 'categoria', 'contas',
  'data', public.hoje_sp() - 31,
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'zeca', 'valor', 150)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'yara', 'valor', 75),
    jsonb_build_object('usuario_id', :'zeca', 'valor', 75))
), 'mensal', null, true) as luz \gset
select public.lancar_meus_recorrentes() \g /dev/null

do $$
declare
  ape uuid := (select id from public.grupos where nome = 'Apê 7');
begin
  assert (select count(*) from public.lancamentos_pendentes where grupo_id = ape) = 1, 'um lançamento pendente';
  assert not exists (select 1 from public.gastos where descricao = 'Luz'), 'sem gasto antes de preencher o valor';
  assert (select responsavel from public.lancamentos_pendentes where grupo_id = ape) = '00000000-0000-0000-0000-000000000402',
    'quem pagou da última vez preenche';
end $$;

select set_config('request.jwt.claim.sub', :'zeca', false) \g /dev/null
do $$ begin
  assert (select count(*) from public.avisos where tipo = 'falta_valor') = 1, 'Zeca é avisado';
end $$;
select id as pendente, data as data_pendente from public.lancamentos_pendentes limit 1 \gset
select public.preencher_lancamento(:'pendente', jsonb_build_object(
  'grupo_id', :'ape', 'descricao', 'Luz', 'valor_total', 187.40, 'tipo_divisao', 'igual', 'categoria', 'contas',
  'data', :'data_pendente',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'zeca', 'valor', 187.40)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'yara', 'valor', 93.70),
    jsonb_build_object('usuario_id', :'zeca', 'valor', 93.70))
)) \g /dev/null
select testes.deve_falhar(format(
  $q$select public.preencher_lancamento('%s', '{"grupo_id": "%s"}'::jsonb)$q$, :'pendente', :'ape'), 'já foi preenchido') \g /dev/null
do $$ begin
  assert (select valor_total from public.gastos where descricao = 'Luz') = 187.40, 'o gasto entra com o valor do mês';
  assert (select recorrente_id from public.gastos where descricao = 'Luz') is not null, 'ligado ao recorrente';
  assert (select valor_total from public.recorrentes where descricao = 'Luz') = 187.40, 'o próximo parte do último valor';
end $$;

-- busca e filtro
select set_config('request.jwt.claim.sub', :'yara', false) \g /dev/null
do $$
declare
  ape uuid := (select id from public.grupos where nome = 'Apê 7');
begin
  assert (select count(*) from public.buscar_gastos(ape, 'fei')) = 1, 'busca pela descrição';
  assert (select count(*) from public.buscar_gastos(ape, 'café')) = 1, 'busca pelos itens';
  assert (select count(*) from public.buscar_gastos(ape, null, null, null, 'contas')) = 1, 'filtro por categoria';
  assert (select count(*) from public.buscar_gastos(ape, null, null, '2026-10-20')) = 1, 'filtro por mês';
  assert (select count(*) from public.buscar_gastos(ape, null, '00000000-0000-0000-0000-000000000402')) = 2, 'filtro por pessoa';
end $$;

-- arquivar e apelido
select public.arquivar_grupo(:'ape', true) \g /dev/null
select public.definir_apelido(:'ape', '  Yarinha ') \g /dev/null
do $$ begin
  assert (select arquivado from public.resumo_meus_grupos() where nome = 'Apê 7'), 'arquivado para a Yara';
  assert (select apelido from public.membros where usuario_id = '00000000-0000-0000-0000-000000000401'
          and grupo_id = (select id from public.grupos where nome = 'Apê 7')) = 'Yarinha', 'apelido sem espaços';
end $$;
select set_config('request.jwt.claim.sub', :'zeca', false) \g /dev/null
do $$ begin
  assert not (select arquivado from public.resumo_meus_grupos() where nome = 'Apê 7'), 'continua normal para o Zeca';
end $$;

-- comentários
select public.comentar(:'feira', 'O pão foi de ontem?') \g /dev/null
select testes.deve_falhar(format('select public.comentar(%L, ''   '')', :'feira'), 'Escreva') \g /dev/null
select testes.deve_falhar(format('insert into public.comentarios (gasto_id, grupo_id, usuario_id, texto) values (%L, %L, %L, ''x'')', :'feira', :'ape', :'zeca'), 'permission denied') \g /dev/null
select set_config('request.jwt.claim.sub', :'yara', false) \g /dev/null
do $$ begin
  assert (select count(*) from public.comentarios) = 1, 'Yara vê o comentário';
  assert (select corpo from public.avisos where tipo = 'comentario') = 'Zeca comentou em "Feira": O pão foi de ontem?', 'aviso do comentário';
end $$;

-- meus dados
do $$
declare
  d jsonb := public.meus_dados();
begin
  assert d -> 'perfil' ->> 'nome' = 'Yara', 'perfil';
  assert jsonb_array_length(d -> 'gastos') = 2, 'gastos em que participa';
  assert jsonb_array_length(d -> 'grupos') = 1, 'grupos';
end $$;

-- excluir a conta apaga os comentários
reset role;
select public.anonimizar_conta(:'zeca') \g /dev/null
do $$ begin
  assert (select count(*) from public.comentarios) = 0, 'comentários apagados com a conta';
end $$;

\echo 'Todos os testes das funcionalidades novas passaram.'
