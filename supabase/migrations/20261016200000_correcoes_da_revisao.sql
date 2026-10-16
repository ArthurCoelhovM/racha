-- Correções da revisão de 16/10/2026
-- Pagamento em dobro, edição com quem saiu, datas de São Paulo, e-mail escondido,
-- pendências calculadas só no banco, exclusão de gasto, avisos de edição, dono do grupo e limpeza.

-- ---------------------------------------------------------------
-- Datas: o dia vale no horário de São Paulo, não em UTC
-- ---------------------------------------------------------------

create or replace function public.hoje_sp()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

alter table public.gastos alter column data set default public.hoje_sp();

-- ---------------------------------------------------------------
-- Código de convite com sorteio seguro
-- (os 6 primeiros bytes de gen_random_uuid() são aleatórios; 256 é múltiplo de 32)
-- ---------------------------------------------------------------

create or replace function public.gerar_codigo()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + get_byte(x.b, i) % 32, 1), '' order by i)
  from (select uuid_send(gen_random_uuid()) as b) x, generate_series(0, 5) i
$$;

create or replace function public.novo_codigo_convite(p_grupo uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
begin
  if not public.eh_membro(p_grupo) then
    raise exception 'Você não participa deste grupo';
  end if;

  for tentativa in 1 .. 5 loop
    begin
      update public.grupos
      set codigo_convite = public.gerar_codigo()
      where id = p_grupo
      returning codigo_convite into v_codigo;
      return v_codigo;
    exception when unique_violation then
      if tentativa = 5 then
        raise;
      end if;
    end;
  end loop;
  return v_codigo;
end;
$$;

-- ---------------------------------------------------------------
-- Papéis no grupo
-- ---------------------------------------------------------------

create or replace function public.eh_dono(g uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membros m
    where m.grupo_id = g and m.usuario_id = auth.uid() and m.ativo and m.papel = 'dono'
  )
$$;

-- se o grupo ficou sem dono ativo, o membro mais antigo assume
create or replace function public.garantir_dono(p_grupo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.membros where grupo_id = p_grupo and ativo and papel = 'dono') then
    return;
  end if;
  update public.membros
  set papel = 'dono'
  where grupo_id = p_grupo
    and usuario_id = (
      select usuario_id from public.membros
      where grupo_id = p_grupo and ativo
      order by entrou_em, usuario_id
      limit 1
    );
end;
$$;

create or replace function public.sair_do_grupo(p_grupo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.membros
  set ativo = false, papel = 'membro'
  where grupo_id = p_grupo and usuario_id = auth.uid() and ativo;

  if not found then
    raise exception 'Você não participa deste grupo';
  end if;

  perform public.garantir_dono(p_grupo);
end;
$$;

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
  set nome = 'Conta excluída', email = null, push_token = null
  where id = p_usuario;

  delete from public.dispositivos where usuario_id = p_usuario;
  delete from public.avisos where usuario_id = p_usuario;
  update public.recorrentes set ativo = false where criado_por = p_usuario;

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
-- E-mail: cada um vê só o próprio (pela sessão); dos outros, só o nome
-- ---------------------------------------------------------------

revoke select on public.perfis from authenticated;
grant select (id, nome, criado_em) on public.perfis to authenticated;

-- ---------------------------------------------------------------
-- Pendências: uma regra só, usada pelas telas, pelos lembretes e pelo pagamento
-- ---------------------------------------------------------------

-- quanto cada pessoa ainda deve a outra no grupo.
-- com abatimento: uma linha por par, já compensada. sem abatimento: uma linha por gasto;
-- pagamento ligado a um gasto quita aquele gasto e o resto quita os gastos mais antigos do par.
create or replace function public.pendencias_internas(p_grupo uuid, p_abatimento boolean default null)
returns table (devedor uuid, credor uuid, gasto_id uuid, valor numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_abatimento boolean := coalesce(p_abatimento, (select g.abatimento from public.grupos g where g.id = p_grupo));
begin
  if v_abatimento then
    return query
    with movimentos as (
      select d.devedor as de, d.credor as para, d.valor as v from public.dividas d where d.grupo_id = p_grupo
      union all
      select p.de, p.para, -p.valor from public.pagamentos p where p.grupo_id = p_grupo
    ),
    pares as (
      select least(m.de, m.para) as a,
             greatest(m.de, m.para) as b,
             sum(case when m.de < m.para then m.v else -m.v end) as liquido
      from movimentos m
      group by 1, 2
    )
    select case when x.liquido > 0 then x.a else x.b end,
           case when x.liquido > 0 then x.b else x.a end,
           null::uuid,
           abs(x.liquido)
    from pares x
    where abs(x.liquido) > 0.000000001;
  else
    return query
    with d as (
      select dv.devedor as de, dv.credor as para, dv.gasto_id as gid, dv.valor as devido, g.data as dia, g.criado_em as em
      from public.dividas dv
      join public.gastos g on g.id = dv.gasto_id
      where dv.grupo_id = p_grupo
    ),
    ligados as (
      select p.de, p.para, p.gasto_id as gid, sum(p.valor) as pago
      from public.pagamentos p
      where p.grupo_id = p_grupo and p.gasto_id is not null
      group by 1, 2, 3
    ),
    apos as (
      select d.de, d.para, d.gid, d.dia, d.em,
             d.devido - least(d.devido, coalesce(l.pago, 0)) as resta,
             greatest(coalesce(l.pago, 0) - d.devido, 0) as excesso
      from d
      left join ligados l on l.de = d.de and l.para = d.para and l.gid = d.gid
    ),
    sobras as (
      select s.de, s.para, sum(s.v) as sobra
      from (
        select p.de, p.para, p.valor as v
        from public.pagamentos p
        where p.grupo_id = p_grupo
          and not exists (select 1 from d where d.gid = p.gasto_id and d.de = p.de and d.para = p.para)
        union all
        select a.de, a.para, a.excesso from apos a where a.excesso > 0
      ) s
      group by 1, 2
    ),
    fila as (
      select a.de, a.para, a.gid, a.resta,
             coalesce(s.sobra, 0) as sobra,
             coalesce(sum(a.resta) over (
               partition by a.de, a.para
               order by a.dia, a.em, a.gid
               rows between unbounded preceding and 1 preceding
             ), 0) as antes
      from apos a
      left join sobras s on s.de = a.de and s.para = a.para
    ),
    final as (
      select f.de, f.para, f.gid, f.resta - least(f.resta, greatest(f.sobra - f.antes, 0)) as falta
      from fila f
    )
    select f.de, f.para, f.gid, f.falta
    from final f
    where f.falta > 0.000000001;
  end if;
end;
$$;

-- para o app: valor exato e valor de cobrança em texto, sem perder casas no JSON
create or replace function public.pendencias_do_grupo(p_grupo uuid, p_abatimento boolean default null)
returns table (devedor uuid, credor uuid, gasto_id uuid, descricao text, data date, valor text, cobrar text)
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
  select p.devedor, p.credor, p.gasto_id, g.descricao, g.data, p.valor::text, public.valor_a_cobrar(p.valor)::text
  from public.pendencias_internas(p_grupo, p_abatimento) p
  left join public.gastos g on g.id = p.gasto_id
  order by g.data desc nulls last, g.criado_em desc nulls last, p.valor desc, p.devedor, p.credor;
end;
$$;

-- a lista de grupos soma as mesmas pendências que a tela do grupo mostra
create or replace function public.resumo_meus_grupos()
returns table (
  grupo_id uuid,
  nome text,
  cor text,
  abatimento boolean,
  total_membros int,
  voce_deve numeric,
  te_devem numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    g.nome,
    g.cor,
    g.abatimento,
    (select count(*)::int from public.membros m2 where m2.grupo_id = g.id and m2.ativo),
    s.deve,
    s.devem
  from public.grupos g
  join public.membros m on m.grupo_id = g.id and m.usuario_id = auth.uid() and m.ativo
  cross join lateral (
    select
      coalesce(sum(public.valor_a_cobrar(p.valor)) filter (where p.devedor = auth.uid()), 0) as deve,
      coalesce(sum(public.valor_a_cobrar(p.valor)) filter (where p.credor = auth.uid()), 0) as devem
    from public.pendencias_internas(g.id) p
  ) s
  order by g.criado_em desc
$$;

create or replace function public.dividas_em_aberto()
returns table (grupo_id uuid, usuario_id uuid, total numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, p.devedor, sum(public.valor_a_cobrar(p.valor))
  from public.grupos g
  cross join lateral public.pendencias_internas(g.id) p
  group by 1, 2
$$;

-- ---------------------------------------------------------------
-- Pagamento: confere o que está em aberto e trava o par enquanto grava
-- ---------------------------------------------------------------

create or replace function public.marcar_pago(
  p_grupo uuid,
  p_de uuid,
  p_para uuid,
  p_valor numeric,
  p_gasto uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_abatimento boolean;
  v_aberto numeric;
begin
  if not public.eh_membro(p_grupo) then
    raise exception 'Você não participa deste grupo';
  end if;

  if auth.uid() not in (p_de, p_para) then
    raise exception 'Só quem paga ou quem recebe pode marcar o pagamento';
  end if;

  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor inválido';
  end if;

  if (select count(*) from public.membros where grupo_id = p_grupo and usuario_id in (p_de, p_para)) <> 2 then
    raise exception 'As duas pessoas precisam ser do grupo';
  end if;

  if p_gasto is not null and not exists (
    select 1 from public.gastos where id = p_gasto and grupo_id = p_grupo
  ) then
    raise exception 'Gasto não encontrado neste grupo';
  end if;

  -- devedor e credor marcando ao mesmo tempo: o segundo espera o primeiro terminar
  perform pg_advisory_xact_lock(
    hashtextextended(p_grupo::text || least(p_de, p_para)::text || greatest(p_de, p_para)::text, 0)
  );

  select g.abatimento into v_abatimento from public.grupos g where g.id = p_grupo;

  select coalesce(sum(x.valor), 0) into v_aberto
  from public.pendencias_internas(p_grupo) x
  where x.devedor = p_de
    and x.credor = p_para
    and (v_abatimento or p_gasto is null or x.gasto_id = p_gasto);

  if v_aberto <= 0.000000001 then
    raise exception 'Essa dívida já está paga. Puxe a tela para atualizar.';
  end if;

  if p_valor > v_aberto + 0.000000001 then
    raise exception 'O valor passa do que está em aberto (%).', public.reais(public.valor_a_cobrar(v_aberto));
  end if;

  insert into public.pagamentos (grupo_id, de, para, valor, valor_cobrado, gasto_id, marcado_por)
  values (p_grupo, p_de, p_para, p_valor, public.valor_a_cobrar(p_valor), p_gasto, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------
-- Gastos: quem já estava no gasto continua nele ao editar, mesmo que tenha saído do grupo
-- ---------------------------------------------------------------

create or replace function public.gravar_gasto(p jsonb, p_autor uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_grupo uuid := (p ->> 'grupo_id')::uuid;
  v_total numeric := round((p ->> 'valor_total')::numeric, 2);
  v_tipo text := p ->> 'tipo_divisao';
  v_soma_pago numeric;
  v_soma_partes numeric;
  v_antes jsonb;
  v_depois jsonb;
begin
  if not exists (
    select 1 from public.grupos where id = v_grupo and v_tipo = any (divisoes_permitidas)
  ) then
    raise exception 'Este grupo não permite a divisão "%"', v_tipo;
  end if;

  if v_id is not null then
    select to_jsonb(g) || jsonb_build_object(
      'pagadores', (select jsonb_agg(to_jsonb(pp)) from public.gasto_pagadores pp where pp.gasto_id = g.id),
      'divisoes', (select jsonb_agg(to_jsonb(dd)) from public.gasto_divisoes dd where dd.gasto_id = g.id)
    )
    into v_antes
    from public.gastos g
    where g.id = v_id and g.grupo_id = v_grupo
    for update;

    if v_antes is null then
      raise exception 'Gasto não encontrado neste grupo';
    end if;
  end if;

  if exists (
    select 1
    from (
      select (x ->> 'usuario_id')::uuid as u from jsonb_array_elements(p -> 'pagadores') x
      union
      select (x ->> 'usuario_id')::uuid from jsonb_array_elements(p -> 'divisoes') x
    ) pessoas
    where not exists (
      select 1 from public.membros m
      where m.grupo_id = v_grupo and m.usuario_id = pessoas.u and m.ativo
    )
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(v_antes -> 'pagadores', '[]') || coalesce(v_antes -> 'divisoes', '[]')) y
      where (y ->> 'usuario_id')::uuid = pessoas.u
    )
  ) then
    raise exception 'Todas as pessoas do gasto precisam ser membros do grupo';
  end if;

  select coalesce(sum((x ->> 'valor')::numeric), 0) into v_soma_pago
  from jsonb_array_elements(p -> 'pagadores') x;

  select coalesce(sum((x ->> 'valor')::numeric), 0) into v_soma_partes
  from jsonb_array_elements(p -> 'divisoes') x;

  if v_soma_pago <> v_total then
    raise exception 'A soma dos pagadores (%) é diferente do total (%)', v_soma_pago, v_total;
  end if;

  if abs(v_soma_partes - v_total) > 0.000001 then
    raise exception 'A soma das partes (%) é diferente do total (%)', v_soma_partes, v_total;
  end if;

  if v_id is not null then
    update public.gastos
    set descricao = trim(p ->> 'descricao'),
        valor_total = v_total,
        data = coalesce((p ->> 'data')::date, public.hoje_sp()),
        tipo_divisao = v_tipo,
        itens = p -> 'itens',
        atualizado_em = now()
    where id = v_id;

    delete from public.gasto_pagadores where gasto_id = v_id;
    delete from public.gasto_divisoes where gasto_id = v_id;
    delete from public.dividas where gasto_id = v_id;
  else
    insert into public.gastos (grupo_id, descricao, valor_total, data, tipo_divisao, itens, criado_por, recorrente_id)
    values (
      v_grupo,
      trim(p ->> 'descricao'),
      v_total,
      coalesce((p ->> 'data')::date, public.hoje_sp()),
      v_tipo,
      p -> 'itens',
      p_autor,
      nullif(p ->> 'recorrente_id', '')::uuid
    )
    returning id into v_id;
  end if;

  insert into public.gasto_pagadores (gasto_id, usuario_id, valor)
  select v_id, (x ->> 'usuario_id')::uuid, (x ->> 'valor')::numeric
  from jsonb_array_elements(p -> 'pagadores') x;

  insert into public.gasto_divisoes (gasto_id, usuario_id, parametro, valor)
  select v_id, (x ->> 'usuario_id')::uuid, nullif(x ->> 'parametro', '')::numeric, (x ->> 'valor')::numeric
  from jsonb_array_elements(p -> 'divisoes') x
  where (x ->> 'valor')::numeric > 0;

  with movimentos as (
    select usuario_id as u, valor as pago, 0::numeric as parte from public.gasto_pagadores where gasto_id = v_id
    union all
    select usuario_id, 0, valor from public.gasto_divisoes where gasto_id = v_id
  ),
  posicoes as (
    select u, sum(pago) - sum(parte) as saldo from movimentos group by u
  ),
  credito as (
    select sum(saldo) as soma from posicoes where saldo > 0
  ),
  calculo as (
    select d.u as devedor, c.u as credor, round((-d.saldo) * c.saldo / t.soma, 18) as valor
    from posicoes d
    cross join posicoes c
    cross join credito t
    where d.saldo < 0 and c.saldo > 0
  )
  insert into public.dividas (grupo_id, gasto_id, devedor, credor, valor)
  select v_grupo, v_id, devedor, credor, valor
  from calculo
  where valor > 0;

  select p - 'id' || jsonb_build_object('id', v_id) into v_depois;

  insert into public.historico (grupo_id, usuario_id, entidade, acao, registro_id, antes, depois)
  values (
    v_grupo, p_autor, 'gastos',
    case when v_antes is null then 'insert' else 'update' end,
    v_id, v_antes, v_depois
  );

  return v_id;
end;
$$;

create or replace function public.criar_recorrente(p jsonb, p_frequencia text, p_gasto uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grupo uuid := (p ->> 'grupo_id')::uuid;
  v_base date := coalesce((p ->> 'data')::date, public.hoje_sp());
  v_dia int := extract(day from v_base)::int;
  v_id uuid;
begin
  if not public.eh_membro(v_grupo) then
    raise exception 'Você não participa deste grupo';
  end if;
  if p_frequencia not in ('semanal', 'mensal') then
    raise exception 'Frequência inválida';
  end if;

  insert into public.recorrentes (grupo_id, descricao, valor_total, frequencia, dia, modelo, proxima_data, criado_por)
  values (
    v_grupo,
    trim(p ->> 'descricao'),
    round((p ->> 'valor_total')::numeric, 2),
    p_frequencia,
    v_dia,
    p - 'id' - 'data' - 'recorrente_id',
    public.proxima_ocorrencia(v_base, p_frequencia, v_dia),
    auth.uid()
  )
  returning id into v_id;

  if p_gasto is not null then
    update public.gastos set recorrente_id = v_id where id = p_gasto and grupo_id = v_grupo;
  end if;

  return v_id;
end;
$$;

create or replace function public.lancar_recorrentes_internos(p_grupos uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recorrentes%rowtype;
  v_hoje date := public.hoje_sp();
  v_lancados int := 0;
begin
  for r in
    select * from public.recorrentes
    where ativo and proxima_data <= v_hoje and (p_grupos is null or grupo_id = any (p_grupos))
    for update skip locked
  loop
    while r.ativo and r.proxima_data <= v_hoje loop
      begin
        perform public.gravar_gasto(
          r.modelo || jsonb_build_object('data', r.proxima_data, 'recorrente_id', r.id),
          r.criado_por
        );
        v_lancados := v_lancados + 1;
        r.proxima_data := public.proxima_ocorrencia(r.proxima_data, r.frequencia, r.dia);
      exception when others then
        r.ativo := false;
        insert into public.avisos (usuario_id, grupo_id, tipo, titulo, corpo)
        values (
          r.criado_por, r.grupo_id, 'recorrente_parado', 'Gasto recorrente parado',
          'Não deu para lançar "' || r.descricao || '": ' || sqlerrm || '. Crie de novo com os dados certos.'
        );
      end;
    end loop;
    update public.recorrentes set proxima_data = r.proxima_data, ativo = r.ativo where id = r.id;
  end loop;
  return v_lancados;
end;
$$;

-- exclusão por função: só quem registrou ou o dono, e o histórico guarda quem pagou e as partes
create or replace function public.excluir_gasto(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gasto public.gastos%rowtype;
  v_antes jsonb;
begin
  select * into v_gasto from public.gastos where id = p_id for update;
  if v_gasto.id is null or not public.eh_membro(v_gasto.grupo_id) then
    raise exception 'Gasto não encontrado';
  end if;
  if v_gasto.criado_por <> auth.uid() and not public.eh_dono(v_gasto.grupo_id) then
    raise exception 'Só quem registrou o gasto ou o dono do grupo pode excluir';
  end if;

  select to_jsonb(v_gasto) || jsonb_build_object(
    'pagadores', (select jsonb_agg(to_jsonb(pp)) from public.gasto_pagadores pp where pp.gasto_id = p_id),
    'divisoes', (select jsonb_agg(to_jsonb(dd)) from public.gasto_divisoes dd where dd.gasto_id = p_id)
  )
  into v_antes;

  delete from public.gastos where id = p_id;

  insert into public.historico (grupo_id, usuario_id, entidade, acao, registro_id, antes, depois)
  values (v_gasto.grupo_id, auth.uid(), 'gastos', 'delete', p_id, v_antes, null);
end;
$$;

drop trigger if exists historico_gastos_exclusao on public.gastos;
drop policy if exists "membros excluem gastos" on public.gastos;
revoke delete on public.gastos from authenticated;

-- ---------------------------------------------------------------
-- Histórico do grupo só quando algo mudou de verdade
-- ---------------------------------------------------------------

drop trigger if exists historico_grupos on public.grupos;
create trigger historico_grupos
after update on public.grupos
for each row
when (old.* is distinct from new.*)
execute function public.registrar_historico();

-- ---------------------------------------------------------------
-- Avisos: edição, exclusão e mudança no abatimento
-- ---------------------------------------------------------------

alter table public.avisos drop constraint if exists avisos_tipo_check;
alter table public.avisos add constraint avisos_tipo_check check (
  tipo in ('gasto_novo', 'gasto_editado', 'gasto_excluido', 'pagamento', 'membro', 'grupo', 'lembrete', 'recorrente_parado')
);

-- soma o valor de uma pessoa numa lista de pagadores ou divisões guardada em jsonb
create or replace function public.valor_de(lista jsonb, pessoa uuid)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum((x ->> 'valor')::numeric), 0)
  from jsonb_array_elements(coalesce(lista, '[]'::jsonb)) x
  where (x ->> 'usuario_id')::uuid = pessoa
$$;

create or replace function public.avisar_por_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb := new.depois;
  a jsonb := new.antes;
  v_grupo text;
  v_autor text;
  v_outro uuid;
begin
  select nome into v_grupo from public.grupos where id = new.grupo_id;
  select nome into v_autor from public.perfis where id = new.usuario_id;
  v_autor := coalesce(nullif(v_autor, ''), 'Alguém');

  if new.entidade = 'gastos' and new.acao = 'insert' then
    insert into public.avisos (usuario_id, grupo_id, tipo, titulo, corpo, dados)
    select
      m.usuario_id,
      new.grupo_id,
      'gasto_novo',
      v_grupo || ': ' || (d ->> 'descricao'),
      case when d ? 'recorrente_id' then 'Gasto recorrente lançado: ' else v_autor || ' registrou ' end
        || public.reais((d ->> 'valor_total')::numeric)
        || case
             when public.valor_de(d -> 'divisoes', m.usuario_id) > 0
               then '. Sua parte: ' || public.reais(public.valor_a_cobrar(public.valor_de(d -> 'divisoes', m.usuario_id))) || '.'
             else '. Você aparece como quem pagou.'
           end,
      jsonb_build_object('gasto_id', new.registro_id)
    from public.membros m
    where m.grupo_id = new.grupo_id
      and m.ativo
      and (m.usuario_id is distinct from new.usuario_id or d ? 'recorrente_id')
      and (public.valor_de(d -> 'divisoes', m.usuario_id) > 0 or public.valor_de(d -> 'pagadores', m.usuario_id) > 0);

  elsif new.entidade = 'gastos' and new.acao = 'update' then
    -- só quem teve a parte ou o valor pago alterado
    insert into public.avisos (usuario_id, grupo_id, tipo, titulo, corpo, dados)
    select
      m.usuario_id,
      new.grupo_id,
      'gasto_editado',
      v_grupo || ': ' || (d ->> 'descricao'),
      v_autor || ' editou o gasto. ' ||
        case
          when x.parte_antes <> x.parte_depois
            then 'Sua parte: ' || public.reais(x.parte_antes) || ' → ' || public.reais(x.parte_depois) || '.'
          else 'O que você pagou: ' || public.reais(x.pago_antes) || ' → ' || public.reais(x.pago_depois) || '.'
        end,
      jsonb_build_object('gasto_id', new.registro_id)
    from public.membros m
    cross join lateral (
      select
        public.valor_a_cobrar(public.valor_de(a -> 'divisoes', m.usuario_id)) as parte_antes,
        public.valor_a_cobrar(public.valor_de(d -> 'divisoes', m.usuario_id)) as parte_depois,
        public.valor_de(a -> 'pagadores', m.usuario_id) as pago_antes,
        public.valor_de(d -> 'pagadores', m.usuario_id) as pago_depois
    ) x
    where m.grupo_id = new.grupo_id
      and m.ativo
      and m.usuario_id is distinct from new.usuario_id
      and (x.parte_antes <> x.parte_depois or x.pago_antes <> x.pago_depois);

  elsif new.entidade = 'gastos' and new.acao = 'delete' then
    insert into public.avisos (usuario_id, grupo_id, tipo, titulo, corpo, dados)
    select
      m.usuario_id,
      new.grupo_id,
      'gasto_excluido',
      v_grupo || ': gasto excluído',
      v_autor || ' excluiu "' || (a ->> 'descricao') || '" de ' || public.reais((a ->> 'valor_total')::numeric)
        || case
             when public.valor_de(a -> 'divisoes', m.usuario_id) > 0
               then '. Sua parte era ' || public.reais(public.valor_a_cobrar(public.valor_de(a -> 'divisoes', m.usuario_id))) || '.'
             else '.'
           end,
      null
    from public.membros m
    where m.grupo_id = new.grupo_id
      and m.ativo
      and m.usuario_id is distinct from new.usuario_id
      and (public.valor_de(a -> 'divisoes', m.usuario_id) > 0 or public.valor_de(a -> 'pagadores', m.usuario_id) > 0);

  elsif new.entidade = 'grupos' and new.acao = 'update'
        and (a ->> 'abatimento') is distinct from (d ->> 'abatimento') then
    insert into public.avisos (usuario_id, grupo_id, tipo, titulo, corpo)
    select
      m.usuario_id,
      new.grupo_id,
      'grupo',
      v_grupo || ': abatimento ' || case when (d ->> 'abatimento')::boolean then 'ligado' else 'desligado' end,
      v_autor || case
        when (d ->> 'abatimento')::boolean
          then ' ligou o abatimento. Agora o que duas pessoas devem uma à outra se compensa, inclusive nos gastos antigos.'
        else ' desligou o abatimento. Agora cada gasto é cobrado separado, inclusive os antigos.'
      end
    from public.membros m
    where m.grupo_id = new.grupo_id and m.ativo and m.usuario_id is distinct from new.usuario_id;

  elsif new.entidade = 'pagamentos' and new.acao = 'insert' then
    v_outro := case
      when new.usuario_id = (d ->> 'de')::uuid then (d ->> 'para')::uuid
      else (d ->> 'de')::uuid
    end;
    insert into public.avisos (usuario_id, grupo_id, tipo, titulo, corpo, dados)
    values (
      v_outro,
      new.grupo_id,
      'pagamento',
      v_grupo || ': pagamento marcado',
      case
        when new.usuario_id = (d ->> 'de')::uuid
          then v_autor || ' marcou que te pagou ' || public.reais((d ->> 'valor_cobrado')::numeric) || '.'
        else v_autor || ' marcou que recebeu os seus ' || public.reais((d ->> 'valor_cobrado')::numeric) || '.'
      end,
      jsonb_build_object('pagamento_id', new.registro_id)
    );

  elsif new.entidade = 'membros' and new.acao = 'insert' then
    insert into public.avisos (usuario_id, grupo_id, tipo, titulo, corpo)
    select
      m.usuario_id,
      new.grupo_id,
      'membro',
      v_grupo || ': gente nova',
      coalesce(nullif((select nome from public.perfis where id = new.registro_id), ''), 'Alguém') || ' entrou no grupo.'
    from public.membros m
    where m.grupo_id = new.grupo_id and m.ativo and m.usuario_id <> new.registro_id;
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------
-- Leitor de cupom: no máximo 10 leituras a cada 10 minutos por pessoa
-- ---------------------------------------------------------------

create table public.leituras_nfce (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfis (id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index leituras_nfce_usuario on public.leituras_nfce (usuario_id, criado_em desc);
alter table public.leituras_nfce enable row level security;
revoke all on public.leituras_nfce from anon, authenticated;

create or replace function public.registrar_leitura_nfce()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Faça login para ler o cupom';
  end if;
  if (
    select count(*) from public.leituras_nfce
    where usuario_id = auth.uid() and criado_em > now() - interval '10 minutes'
  ) >= 10 then
    raise exception 'Muitas leituras seguidas. Espere alguns minutos e tente de novo.';
  end if;
  insert into public.leituras_nfce (usuario_id) values (auth.uid());
end;
$$;

-- ---------------------------------------------------------------
-- Limpeza: avisos lidos com mais de 90 dias, avisos com mais de 1 ano e tentativas antigas
-- ---------------------------------------------------------------

create or replace function public.limpar_dados_antigos()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total int := 0;
  v_parcial int;
begin
  delete from public.avisos
  where (lido and criado_em < now() - interval '90 days') or criado_em < now() - interval '365 days';
  get diagnostics v_parcial = row_count;
  v_total := v_total + v_parcial;

  delete from public.tentativas_convite where criado_em < now() - interval '1 day';
  get diagnostics v_parcial = row_count;
  v_total := v_total + v_parcial;

  delete from public.leituras_nfce where criado_em < now() - interval '1 day';
  get diagnostics v_parcial = row_count;
  v_total := v_total + v_parcial;

  return v_total;
end;
$$;

-- ---------------------------------------------------------------
-- Permissões das funções
-- ---------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.valor_a_cobrar(numeric) to authenticated;
grant execute on function public.reais(numeric) to authenticated;
grant execute on function public.hoje_sp() to authenticated;
grant execute on function public.eh_membro(uuid) to authenticated;
grant execute on function public.eh_dono(uuid) to authenticated;
grant execute on function public.compartilha_grupo(uuid) to authenticated;
grant execute on function public.criar_grupo(text, text, boolean, text[], int) to authenticated;
grant execute on function public.entrar_no_grupo(text) to authenticated;
grant execute on function public.sair_do_grupo(uuid) to authenticated;
grant execute on function public.novo_codigo_convite(uuid) to authenticated;
grant execute on function public.salvar_gasto(jsonb) to authenticated;
grant execute on function public.excluir_gasto(uuid) to authenticated;
grant execute on function public.marcar_pago(uuid, uuid, uuid, numeric, uuid) to authenticated;
grant execute on function public.resumo_meus_grupos() to authenticated;
grant execute on function public.pendencias_do_grupo(uuid, boolean) to authenticated;
grant execute on function public.criar_recorrente(jsonb, text, uuid) to authenticated;
grant execute on function public.parar_recorrente(uuid) to authenticated;
grant execute on function public.lancar_meus_recorrentes() to authenticated;
grant execute on function public.registrar_dispositivo(text, text, jsonb) to authenticated;
grant execute on function public.remover_dispositivo(text) to authenticated;
grant execute on function public.registrar_leitura_nfce() to authenticated;

-- usada só pela Edge Function de exclusão de conta
grant execute on function public.anonimizar_conta(uuid) to service_role;
