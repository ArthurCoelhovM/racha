\set ON_ERROR_STOP on
\set QUIET on

-- Desfazer (readmitir e retomar), metas por categoria, busca em todos os grupos e perfil sem e-mail

\set dani '00000000-0000-0000-0000-000000000601'
\set edu '00000000-0000-0000-0000-000000000602'
\set fabi '00000000-0000-0000-0000-000000000603'

reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  (:'dani', 'dani9@exemplo.com', '{"nome": "Dani"}'),
  (:'edu', 'edu9@exemplo.com', '{"nome": "Edu"}'),
  (:'fabi', 'fabi9@exemplo.com', '{}');

do $$ begin
  assert (select nome from public.perfis where id = '00000000-0000-0000-0000-000000000603') = 'fabi9',
    'sem nome, usa o começo do e-mail';
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', :'dani', false) \g /dev/null
select public.criar_grupo('Casa 9', '#5B4CF0', true) as casa \gset
select public.codigo_do_grupo(:'casa') as cod \gset
select set_config('request.jwt.claim.sub', :'edu', false) \g /dev/null
select public.entrar_no_grupo(:'cod') \g /dev/null

-- remover e desfazer
select set_config('request.jwt.claim.sub', :'dani', false) \g /dev/null
select public.remover_membro(:'casa', :'edu') \g /dev/null
do $$ begin
  assert not (select ativo from public.membros where usuario_id = '00000000-0000-0000-0000-000000000602'), 'removido';
end $$;
select set_config('request.jwt.claim.sub', :'edu', false) \g /dev/null
select testes.deve_falhar(format($q$select public.readmitir_membro('%s', '%s')$q$, :'casa', :'edu'), 'permissão') \g /dev/null
select set_config('request.jwt.claim.sub', :'dani', false) \g /dev/null
select public.readmitir_membro(:'casa', :'edu') \g /dev/null
do $$ begin
  assert (select ativo from public.membros where usuario_id = '00000000-0000-0000-0000-000000000602'), 'voltou';
end $$;
select set_config('request.jwt.claim.sub', :'edu', false) \g /dev/null
do $$ begin
  assert not exists (select 1 from public.avisos where tipo = 'membro' and dados ->> 'removido' = 'true'),
    'o aviso de remoção some';
end $$;

-- quem saiu sozinho não volta pelo desfazer; remoção antiga também não
select public.sair_do_grupo(:'casa') \g /dev/null
select set_config('request.jwt.claim.sub', :'dani', false) \g /dev/null
select testes.deve_falhar(format($q$select public.readmitir_membro('%s', '%s')$q$, :'casa', :'edu'), 'Não dá mais') \g /dev/null
reset role;
update public.membros set ativo = true where usuario_id = :'edu';
set role authenticated;
select set_config('request.jwt.claim.sub', :'dani', false) \g /dev/null
select public.remover_membro(:'casa', :'edu') \g /dev/null
reset role;
update public.membros set removido_em = now() - interval '11 minutes' where usuario_id = :'edu';
set role authenticated;
select set_config('request.jwt.claim.sub', :'dani', false) \g /dev/null
select testes.deve_falhar(format($q$select public.readmitir_membro('%s', '%s')$q$, :'casa', :'edu'), 'Não dá mais') \g /dev/null

-- parar e retomar um recorrente
select public.criar_recorrente(jsonb_build_object(
  'grupo_id', :'casa', 'descricao', 'Internet', 'valor_total', 100, 'tipo_divisao', 'igual', 'data', public.hoje_sp(),
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'dani', 'valor', 100)),
  'divisoes', jsonb_build_array(jsonb_build_object('usuario_id', :'dani', 'valor', 100))
), 'mensal', null, false) as internet \gset
select public.parar_recorrente(:'internet') \g /dev/null
select public.retomar_recorrente(:'internet') \g /dev/null
do $$ begin
  assert (select ativo from public.recorrentes where descricao = 'Internet'), 'voltou a repetir';
end $$;
select testes.deve_falhar(format($q$select public.retomar_recorrente('%s')$q$, :'internet'), 'não encontrado') \g /dev/null

-- metas
select public.definir_metas(:'casa', '{"mercado": 600, "contas": 450.5}') \g /dev/null
do $$ begin
  assert (select metas ->> 'mercado' from public.grupos where nome = 'Casa 9') = '600', 'meta do mercado';
end $$;
select testes.deve_falhar(format($q$select public.definir_metas('%s', '{"cassino": 10}')$q$, :'casa'), 'Categoria') \g /dev/null
select testes.deve_falhar(format($q$select public.definir_metas('%s', '{"mercado": -1}')$q$, :'casa'), 'Meta inválida') \g /dev/null
select testes.deve_falhar(format($q$select public.definir_metas('%s', '{"mercado": "x"}')$q$, :'casa'), 'Meta inválida') \g /dev/null
select set_config('request.jwt.claim.sub', :'fabi', false) \g /dev/null
select testes.deve_falhar(format($q$select public.definir_metas('%s', '{}')$q$, :'casa'), 'permissão') \g /dev/null

-- busca em todos os grupos: só os seus
select set_config('request.jwt.claim.sub', :'dani', false) \g /dev/null
select public.salvar_gasto(jsonb_build_object(
  'grupo_id', :'casa', 'descricao', 'Feira da semana', 'valor_total', 50, 'tipo_divisao', 'igual',
  'pagadores', jsonb_build_array(jsonb_build_object('usuario_id', :'dani', 'valor', 50)),
  'divisoes', jsonb_build_array(jsonb_build_object('usuario_id', :'dani', 'valor', 50))
)) \g /dev/null
do $$ begin
  assert (select count(*) from public.buscar_em_todos('feira')) = 1, 'acha a feira';
  assert (select count(*) from public.buscar_em_todos('f')) = 0, 'precisa de duas letras';
  assert (select count(*) from public.buscar_em_todos('xyzw')) = 0, 'sem itens não quebra';
  assert (select count(*) from public.buscar_gastos((select id from public.grupos where nome = 'Casa 9'), 'xyzw')) = 0,
    'a busca do grupo também não quebra';
end $$;
select set_config('request.jwt.claim.sub', :'fabi', false) \g /dev/null
do $$ begin
  assert (select count(*) from public.buscar_em_todos('feira')) = 0, 'de fora não acha';
end $$;

\echo 'Todos os testes do desfazer, das metas e da busca geral passaram.'
