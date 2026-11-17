-- Conferir as contas, chave Pix e primeiros passos

-- ---------------------------------------------------------------
-- Chave Pix: cada pessoa cadastra a sua; quem divide grupo com ela vê
-- ---------------------------------------------------------------

alter table public.perfis
  add column chave_pix text check (chave_pix is null or char_length(chave_pix) between 3 and 77);

grant select (chave_pix) on public.perfis to authenticated;
grant update (chave_pix) on public.perfis to authenticated;

-- ---------------------------------------------------------------
-- Extrato entre você e outra pessoa do grupo.
-- efeito > 0: você passa a dever mais; efeito < 0: você passa a dever menos (ou ela a te dever).
-- ---------------------------------------------------------------

create or replace function public.extrato_com(p_grupo uuid, p_outro uuid)
returns table (
  tipo text,
  data date,
  criado_em timestamptz,
  gasto_id uuid,
  descricao text,
  valor_total numeric,
  efeito numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_eu uuid := auth.uid();
begin
  if not public.eh_membro(p_grupo) then
    raise exception 'Você não participa deste grupo';
  end if;
  if p_outro = v_eu or not exists (
    select 1 from public.membros m where m.grupo_id = p_grupo and m.usuario_id = p_outro
  ) then
    raise exception 'Essa pessoa não é deste grupo';
  end if;

  return query
  select x.tipo, x.data, x.criado_em, x.gasto_id, x.descricao, x.valor_total, x.efeito
  from (
    select 'gasto'::text as tipo, g.data, g.criado_em, g.id as gasto_id, g.descricao, g.valor_total,
           sum(case when d.devedor = v_eu then d.valor else -d.valor end) as efeito
    from public.dividas d
    join public.gastos g on g.id = d.gasto_id
    where d.grupo_id = p_grupo
      and ((d.devedor = v_eu and d.credor = p_outro) or (d.devedor = p_outro and d.credor = v_eu))
    group by g.id
    union all
    select 'pagamento', (p.criado_em at time zone 'America/Sao_Paulo')::date, p.criado_em, p.gasto_id,
           g.descricao, p.valor,
           case when p.de = v_eu then -p.valor else p.valor end
    from public.pagamentos p
    left join public.gastos g on g.id = p.gasto_id
    where p.grupo_id = p_grupo
      and ((p.de = v_eu and p.para = p_outro) or (p.de = p_outro and p.para = v_eu))
  ) x
  where abs(x.efeito) > 0.000000001
  order by x.data, x.criado_em;
end;
$$;

-- ---------------------------------------------------------------
-- Prova dos nove do grupo e pontos para olhar
-- tipo: nao_fecha | duplicado | futuro | sem_valor | pagamento_maior
-- ---------------------------------------------------------------

create or replace function public.conferir_grupo(p_grupo uuid)
returns table (
  tipo text,
  gasto_id uuid,
  descricao text,
  data date,
  detalhe text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.eh_membro(p_grupo) then
    raise exception 'Você não participa deste grupo';
  end if;

  return query
  -- as partes e os pagadores de cada gasto somam o total
  select 'nao_fecha'::text, g.id, g.descricao, g.data,
         'Total ' || public.reais(g.valor_total)
           || ', partes ' || public.reais(coalesce(dv.soma, 0))
           || ', pago ' || public.reais(coalesce(pg.soma, 0))
  from public.gastos g
  left join lateral (select sum(x.valor) as soma from public.gasto_divisoes x where x.gasto_id = g.id) dv on true
  left join lateral (select sum(x.valor) as soma from public.gasto_pagadores x where x.gasto_id = g.id) pg on true
  where g.grupo_id = p_grupo
    and (abs(coalesce(dv.soma, 0) - g.valor_total) > 0.000001
         or abs(coalesce(pg.soma, 0) - g.valor_total) > 0.000001)

  union all
  -- mesmo nome, mesmo valor, mesmo dia: o mais novo pode ser repetido
  select 'duplicado', g.id, g.descricao, g.data, 'Igual a outro gasto do mesmo dia'
  from public.gastos g
  where g.grupo_id = p_grupo
    and exists (
      select 1 from public.gastos o
      where o.grupo_id = g.grupo_id and o.id <> g.id and o.data = g.data
        and o.valor_total = g.valor_total
        and lower(trim(o.descricao)) = lower(trim(g.descricao))
        and (o.criado_em, o.id) < (g.criado_em, g.id)
    )

  union all
  select 'futuro', g.id, g.descricao, g.data, 'Data depois de hoje'
  from public.gastos g
  where g.grupo_id = p_grupo and g.data > public.hoje_sp()

  union all
  select 'sem_valor', null::uuid, r.descricao, l.data, 'Esperando o valor há mais de 7 dias'
  from public.lancamentos_pendentes l
  join public.recorrentes r on r.id = l.recorrente_id
  where l.grupo_id = p_grupo and l.gasto_id is null and l.data < public.hoje_sp() - 7

  union all
  -- pagamento ligado a um gasto, maior do que a dívida daquele gasto
  select 'pagamento_maior', g.id, g.descricao, g.data,
         'Pago ' || public.reais(public.valor_a_cobrar(p.pago))
           || ' de uma parte de ' || public.reais(public.valor_a_cobrar(coalesce(d.valor, 0)))
  from (
    select x.gasto_id, x.de, x.para, sum(x.valor) as pago
    from public.pagamentos x
    where x.grupo_id = p_grupo and x.gasto_id is not null
    group by 1, 2, 3
  ) p
  join public.gastos g on g.id = p.gasto_id
  left join public.dividas d on d.gasto_id = p.gasto_id and d.devedor = p.de and d.credor = p.para
  where p.pago > coalesce(d.valor, 0) + 0.005

  order by 1, 4 desc;
end;
$$;

-- ---------------------------------------------------------------
-- Primeiros passos: o que a pessoa já fez no app
-- ---------------------------------------------------------------

create or replace function public.primeiros_passos()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tem_grupo', exists (select 1 from public.membros m where m.usuario_id = auth.uid() and m.ativo),
    'convidou', exists (
      select 1 from public.membros m
      where m.usuario_id = auth.uid() and m.ativo
        and (select count(*) from public.membros o where o.grupo_id = m.grupo_id and o.ativo) > 1
    ),
    'registrou_gasto', exists (select 1 from public.gastos g where g.criado_por = auth.uid()),
    'marcou_pagamento', exists (
      select 1 from public.pagamentos p where p.marcado_por = auth.uid() or auth.uid() in (p.de, p.para)
    )
  )
$$;

-- ---------------------------------------------------------------
-- Excluir a conta também apaga a chave Pix
-- ---------------------------------------------------------------

create or replace function public.anonimizar_conta(p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grupo uuid;
begin
  update public.perfis
  set nome = 'Conta excluída', email = null, push_token = null, chave_pix = null
  where id = p_usuario;

  delete from public.dispositivos where usuario_id = p_usuario;
  delete from public.avisos where usuario_id = p_usuario;
  delete from public.comentarios where usuario_id = p_usuario;
  update public.recorrentes set ativo = false where criado_por = p_usuario;
  update public.membros set apelido = null where usuario_id = p_usuario;

  for v_grupo in
    update public.membros set ativo = false, papel = 'membro'
    where usuario_id = p_usuario and (ativo or papel = 'dono')
    returning grupo_id
  loop
    perform public.garantir_dono(v_grupo);
  end loop;
end;
$$;

-- ---------------------------------------------------------------
-- Meus dados: inclui a chave Pix
-- ---------------------------------------------------------------

create or replace function public.meus_dados()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'exportado_em', now(),
    'perfil', (select jsonb_build_object('id', p.id, 'nome', p.nome, 'chave_pix', p.chave_pix, 'criado_em', p.criado_em)
               from public.perfis p where p.id = auth.uid()),
    'grupos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nome', g.nome, 'papel', m.papel, 'ativo', m.ativo, 'apelido', m.apelido, 'entrou_em', m.entrou_em))
      from public.membros m join public.grupos g on g.id = m.grupo_id
      where m.usuario_id = auth.uid()), '[]'),
    'gastos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'grupo', gr.nome, 'descricao', g.descricao, 'data', g.data, 'valor_total', g.valor_total,
        'categoria', g.categoria,
        'voce_pagou', (select sum(valor) from public.gasto_pagadores where gasto_id = g.id and usuario_id = auth.uid()),
        'sua_parte', (select sum(valor) from public.gasto_divisoes where gasto_id = g.id and usuario_id = auth.uid()))
        order by g.data)
      from public.gastos g join public.grupos gr on gr.id = g.grupo_id
      where exists (select 1 from public.gasto_pagadores where gasto_id = g.id and usuario_id = auth.uid())
         or exists (select 1 from public.gasto_divisoes where gasto_id = g.id and usuario_id = auth.uid())), '[]'),
    'pagamentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'grupo', gr.nome, 'de_voce', p.de = auth.uid(), 'valor', p.valor, 'criado_em', p.criado_em)
        order by p.criado_em)
      from public.pagamentos p join public.grupos gr on gr.id = p.grupo_id
      where auth.uid() in (p.de, p.para)), '[]'),
    'comentarios', coalesce((
      select jsonb_agg(jsonb_build_object('texto', c.texto, 'criado_em', c.criado_em) order by c.criado_em)
      from public.comentarios c where c.usuario_id = auth.uid()), '[]'),
    'avisos', coalesce((
      select jsonb_agg(jsonb_build_object('titulo', a.titulo, 'corpo', a.corpo, 'criado_em', a.criado_em)
                       order by a.criado_em)
      from public.avisos a where a.usuario_id = auth.uid()), '[]'),
    'aparelhos', (select count(*) from public.dispositivos where usuario_id = auth.uid())
  )
$$;

grant execute on function public.extrato_com(uuid, uuid) to authenticated;
grant execute on function public.conferir_grupo(uuid) to authenticated;
grant execute on function public.primeiros_passos() to authenticated;
