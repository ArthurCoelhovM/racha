\set ON_ERROR_STOP on
\set QUIET on

\set eva   '00000000-0000-0000-0000-0000000000e1'
\set fabio '00000000-0000-0000-0000-0000000000f1'
\set gil   '00000000-0000-0000-0000-0000000000a9'

reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  (:'eva',   'eva@exemplo.com',   '{"nome": "Eva"}'),
  (:'fabio', 'fabio@exemplo.com', '{"nome": "Fábio"}'),
  (:'gil',   'gil@exemplo.com',   '{"nome": "Gil"}');

-- ---------------------------------------------------------------
-- Datas dos recorrentes
-- ---------------------------------------------------------------
do $$ begin
  assert public.proxima_ocorrencia('2026-01-31', 'mensal', 31) = '2026-02-28', '31/01 vai para 28/02';
  assert public.proxima_ocorrencia('2026-02-28', 'mensal', 31) = '2026-03-31', 'e volta para 31/03';
  assert public.proxima_ocorrencia('2028-01-31', 'mensal', 31) = '2028-02-29', 'ano bissexto';
  assert public.proxima_ocorrencia('2026-12-15', 'mensal', 15) = '2027-01-15', 'virada de ano';
  assert public.proxima_ocorrencia('2026-10-16', 'semanal', 16) = '2026-10-23', 'semanal soma 7 dias';
  assert public.reais(1234.5) = 'R$ 1.234,50', 'formato brasileiro';
end $$;

-- ---------------------------------------------------------------
-- Avisos
-- ---------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'eva', false) \g /dev/null
select public.criar_grupo('Apê', '#07879E', false, array['igual', 'exato'], 1) as ape \gset
select codigo_convite as cod_ape from public.grupos where id = :'ape' \gset

select set_config('request.jwt.claim.sub', :'fabio', false) \g /dev/null
select public.entrar_no_grupo(:'cod_ape') \g /dev/null

select set_config('request.jwt.claim.sub', :'eva', false) \g /dev/null
do $$ begin
  assert (select count(*) from public.avisos) = 1, 'Eva recebe um aviso';
  assert (select corpo from public.avisos where tipo = 'membro') = 'Fábio entrou no grupo.', 'aviso de entrada';
end $$;

select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'ape', 'descricao', 'Luz', 'valor_total', 100, 'tipo_divisao', 'igual',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'eva', 'valor', 100)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'eva', 'valor', 50),
    jsonb_build_object('usuario_id', :'fabio', 'valor', 50))
)) as luz \gset

do $$ begin
  assert (select count(*) from public.avisos where tipo = 'gasto_novo') = 0, 'quem registra não é avisado';
end $$;

select set_config('request.jwt.claim.sub', :'fabio', false) \g /dev/null
do $$ begin
  assert (select count(*) from public.avisos) = 1, 'Fábio só vê os avisos dele';
  assert (select corpo from public.avisos where tipo = 'gasto_novo') = 'Eva registrou R$ 100,00. Sua parte: R$ 50,00.',
    format('texto do aviso: %s', (select corpo from public.avisos where tipo = 'gasto_novo'));
  assert (select titulo from public.avisos where tipo = 'gasto_novo') = 'Apê: Luz', 'título com o grupo';
end $$;

select public.marcar_pago(:'ape', :'fabio', :'eva', 50, :'luz') \g /dev/null
update public.avisos set lido = true;
select testes.deve_falhar('update public.avisos set titulo = ''x''', 'permission denied') \g /dev/null
do $$ begin
  assert (select count(*) from public.avisos where not lido) = 0, 'Fábio marca os avisos como lidos';
end $$;

select set_config('request.jwt.claim.sub', :'eva', false) \g /dev/null
do $$ begin
  assert (select corpo from public.avisos where tipo = 'pagamento') = 'Fábio marcou que te pagou R$ 50,00.', 'aviso de pagamento';
  assert (select count(*) from public.avisos where not lido) = 2, 'o lido do Fábio não mexe nos avisos da Eva';
end $$;

-- ---------------------------------------------------------------
-- Lembretes
-- ---------------------------------------------------------------
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'ape', 'descricao', 'Água', 'valor_total', 30.01, 'tipo_divisao', 'igual',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'eva', 'valor', 30.01)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'eva', 'valor', 15.005),
    jsonb_build_object('usuario_id', :'fabio', 'valor', 15.005))
)) \g /dev/null

select testes.deve_falhar('select public.gerar_lembretes()', 'permission denied') \g /dev/null
select testes.deve_falhar('select public.lancar_recorrentes()', 'permission denied') \g /dev/null
select testes.deve_falhar(format('select public.gravar_gasto(''{"grupo_id": "%s"}''::jsonb, %L)', :'ape', :'eva'), 'permission denied') \g /dev/null

reset role;
do $$
declare
  fabio uuid := '00000000-0000-0000-0000-0000000000f1';
  ape uuid := (select id from public.grupos where nome = 'Apê');
begin
  assert (select total from public.dividas_em_aberto() where grupo_id = ape and usuario_id = fabio) = 15.005,
    'Fábio deve só a água';
  assert public.gerar_lembretes() = 0, 'dívida recente ainda não gera lembrete';

  update public.gastos set criado_em = now() - interval '2 days' where grupo_id = ape;
  assert public.gerar_lembretes() = 1, 'agora gera';
  assert (select corpo from public.avisos where usuario_id = fabio and tipo = 'lembrete') = 'Você ainda deve R$ 15,01 neste grupo.',
    'lembrete com o valor arredondado para cima';
  assert public.gerar_lembretes() = 0, 'não repete antes do prazo do grupo';

  update public.avisos set criado_em = now() - interval '25 hours' where tipo = 'lembrete';
  assert public.gerar_lembretes() = 1, 'depois do prazo lembra de novo';

  update public.grupos set lembrete_dias = 0 where id = ape;
  update public.avisos set criado_em = now() - interval '25 hours' where tipo = 'lembrete';
  assert public.gerar_lembretes() = 0, 'grupo sem lembrete não gera nada';
end $$;

-- ---------------------------------------------------------------
-- Gastos recorrentes
-- ---------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'eva', false) \g /dev/null

select jsonb_build_object(
  'grupo_id', :'ape', 'descricao', 'Internet', 'valor_total', 120, 'tipo_divisao', 'igual',
  'data', current_date - 7,
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'eva', 'valor', 120)),
  'divisoes', jsonb_build_array(
    jsonb_build_object('usuario_id', :'eva', 'valor', 60),
    jsonb_build_object('usuario_id', :'fabio', 'valor', 60))
) as internet \gset

select public.salvar_gasto(:'internet'::jsonb) as primeira \gset
select public.criar_recorrente(:'internet'::jsonb, 'semanal', :'primeira') as rec \gset
select public.lancar_meus_recorrentes() as lancados \gset

do $$
declare
  rec uuid := (select id from public.recorrentes where descricao = 'Internet');
begin
  assert (select count(*) from public.gastos where recorrente_id = rec) = 2, 'o primeiro e o de hoje';
  assert (select count(*) from public.gastos where recorrente_id = rec and data = current_date) = 1, 'lançado com a data certa';
  assert (select proxima_data from public.recorrentes where id = rec) = current_date + 7, 'próxima em 7 dias';
  assert public.lancar_meus_recorrentes() = 0, 'não lança duas vezes';
  assert (select count(*) from public.avisos where tipo = 'gasto_novo' and corpo like 'Gasto recorrente lançado: R$ 120,00%') = 1,
    'Eva também é avisada do lançamento automático';
end $$;

-- Gil, de fora, não vê nem para o recorrente
select set_config('request.jwt.claim.sub', :'gil', false) \g /dev/null
select testes.deve_falhar(format('select public.parar_recorrente(%L)', :'rec'), 'não encontrado') \g /dev/null
do $$ begin
  assert (select count(*) from public.recorrentes) = 0, 'Gil não vê recorrentes';
end $$;

-- Fábio sai do grupo: o próximo lançamento falha, o recorrente para e a Eva é avisada
select set_config('request.jwt.claim.sub', :'fabio', false) \g /dev/null
select public.sair_do_grupo(:'ape') \g /dev/null

reset role;
update public.recorrentes set proxima_data = current_date where id = :'rec';
select public.lancar_recorrentes() \g /dev/null
do $$
declare
  rec uuid := (select id from public.recorrentes where descricao = 'Internet');
begin
  assert not (select ativo from public.recorrentes where id = rec), 'recorrente parou';
  assert (select count(*) from public.avisos where tipo = 'recorrente_parado') = 1, 'criador avisado';
  assert (select count(*) from public.gastos where recorrente_id = rec) = 2, 'nada foi lançado pela metade';
end $$;

-- parar manualmente
set role authenticated;
select set_config('request.jwt.claim.sub', :'eva', false) \g /dev/null
select public.criar_recorrente(:'internet'::jsonb, 'mensal') as rec2 \gset
select public.parar_recorrente(:'rec2') \g /dev/null
do $$ begin
  assert (select count(*) from public.recorrentes where ativo) = 0, 'Eva parou o recorrente';
end $$;

reset role;
\echo 'Todos os testes de avisos, lembretes e recorrentes passaram.'
