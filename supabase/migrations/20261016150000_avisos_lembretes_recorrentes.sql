-- Avisos dentro do app, lembretes de dívida e gastos recorrentes

-- ---------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------

create or replace function public.reais(v numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'R$ ' || translate(to_char(coalesce(v, 0), 'FM999,999,999,990.00'), ',.', '.,')
$$;

-- próxima data de um gasto recorrente; no mensal, o dia 31 vira o último dia dos meses curtos
create or replace function public.proxima_ocorrencia(d date, frequencia text, dia int)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when frequencia = 'semanal' then d + 7
    else (
      select inicio + (least(dia, extract(day from (inicio + interval '1 month' - interval '1 day'))::int) - 1)
      from (select (date_trunc('month', d) + interval '1 month')::date as inicio) x
    )
  end
$$;

-- ---------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------

create table public.avisos (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfis (id) on delete cascade,
  grupo_id uuid references public.grupos (id) on delete cascade,
  tipo text not null check (tipo in ('gasto_novo', 'pagamento', 'membro', 'lembrete', 'recorrente_parado')),
  titulo text not null,
  corpo text not null,
  dados jsonb,
  lido boolean not null default false,
  enviado_push boolean not null default false,
  criado_em timestamptz not null default now()
);
create index avisos_usuario on public.avisos (usuario_id, criado_em desc);
create index avisos_lembrete on public.avisos (usuario_id, grupo_id, criado_em desc) where tipo = 'lembrete';

create table public.recorrentes (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  descricao text not null,
  valor_total numeric(14, 2) not null check (valor_total > 0),
  frequencia text not null check (frequencia in ('semanal', 'mensal')),
  dia int not null check (dia between 1 and 31),
  modelo jsonb not null,
  proxima_data date not null,
  ativo boolean not null default true,
  criado_por uuid not null references public.perfis (id),
  criado_em timestamptz not null default now()
);
create index recorrentes_pendentes on public.recorrentes (proxima_data) where ativo;

alter table public.gastos add column recorrente_id uuid references public.recorrentes (id) on delete set null;

-- ---------------------------------------------------------------
-- Gravação de gasto separada da checagem de quem chama,
-- para os lançamentos automáticos poderem usar a mesma regra
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
    select to_jsonb(g) || jsonb_build_object(
      'pagadores', (select jsonb_agg(to_jsonb(pp)) from public.gasto_pagadores pp where pp.gasto_id = g.id),
      'divisoes', (select jsonb_agg(to_jsonb(dd)) from public.gasto_divisoes dd where dd.gasto_id = g.id)
    )
    into v_antes
    from public.gastos g
    where g.id = v_id and g.grupo_id = v_grupo;

    if v_antes is null then
      raise exception 'Gasto não encontrado neste grupo';
    end if;

    update public.gastos
    set descricao = trim(p ->> 'descricao'),
        valor_total = v_total,
        data = coalesce((p ->> 'data')::date, current_date),
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
      coalesce((p ->> 'data')::date, current_date),
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

create or replace function public.salvar_gasto(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_membro((p ->> 'grupo_id')::uuid) then
    raise exception 'Você não participa deste grupo';
  end if;
  return public.gravar_gasto(p - 'recorrente_id', auth.uid());
end;
$$;

-- ---------------------------------------------------------------
-- Avisos gerados a partir do histórico
-- ---------------------------------------------------------------

create or replace function public.avisar_por_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  d jsonb := new.depois;
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
             when parte.valor is not null then '. Sua parte: ' || public.reais(public.valor_a_cobrar(parte.valor)) || '.'
             else '. Você aparece como quem pagou.'
           end,
      jsonb_build_object('gasto_id', new.registro_id)
    from public.membros m
    left join lateral (
      select sum((x ->> 'valor')::numeric) as valor
      from jsonb_array_elements(d -> 'divisoes') x
      where (x ->> 'usuario_id')::uuid = m.usuario_id and (x ->> 'valor')::numeric > 0
    ) parte on true
    where m.grupo_id = new.grupo_id
      and m.ativo
      and (m.usuario_id is distinct from new.usuario_id or d ? 'recorrente_id')
      and (
        parte.valor is not null
        or exists (
          select 1 from jsonb_array_elements(d -> 'pagadores') y
          where (y ->> 'usuario_id')::uuid = m.usuario_id
        )
      );

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

create trigger avisos_do_historico
after insert on public.historico
for each row execute function public.avisar_por_historico();

-- ---------------------------------------------------------------
-- Lembretes de dívida
-- ---------------------------------------------------------------

-- quanto cada pessoa deve em cada grupo, respeitando o abatimento do grupo
create or replace function public.dividas_em_aberto()
returns table (grupo_id uuid, usuario_id uuid, total numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with pares as (
    select
      s.grupo_id,
      least(s.devedor, s.credor) as a,
      greatest(s.devedor, s.credor) as b,
      sum(case when s.devedor < s.credor then s.devido - s.pago else s.pago - s.devido end) as liquido
    from public.saldos_pares s
    group by 1, 2, 3
  ),
  devidas as (
    select p.grupo_id, case when p.liquido > 0 then p.a else p.b end as usuario_id, abs(p.liquido) as valor
    from pares p
    join public.grupos g on g.id = p.grupo_id
    where g.abatimento and abs(p.liquido) > 0.000000001
    union all
    select s.grupo_id, s.devedor, s.devido - s.pago
    from public.saldos_pares s
    join public.grupos g on g.id = s.grupo_id
    where not g.abatimento and s.devido - s.pago > 0.000000001
  )
  select grupo_id, usuario_id, sum(valor)
  from devidas
  group by 1, 2
$$;

-- roda uma vez por dia; cada grupo define de quantos em quantos dias lembrar
create or replace function public.gerar_lembretes()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total int;
begin
  insert into public.avisos (usuario_id, grupo_id, tipo, titulo, corpo)
  select
    d.usuario_id,
    d.grupo_id,
    'lembrete',
    g.nome || ': lembrete',
    'Você ainda deve ' || public.reais(public.valor_a_cobrar(d.total)) || ' neste grupo.'
  from public.dividas_em_aberto() d
  join public.grupos g on g.id = d.grupo_id
  join public.membros m on m.grupo_id = d.grupo_id and m.usuario_id = d.usuario_id and m.ativo
  where g.lembrete_dias > 0
    and public.valor_a_cobrar(d.total) > 0
    -- a dívida precisa ter pelo menos um dia
    and exists (
      select 1
      from public.dividas dv
      join public.gastos ga on ga.id = dv.gasto_id
      where dv.grupo_id = d.grupo_id and dv.devedor = d.usuario_id and ga.criado_em < now() - interval '20 hours'
    )
    and not exists (
      select 1 from public.avisos a
      where a.usuario_id = d.usuario_id
        and a.grupo_id = d.grupo_id
        and a.tipo = 'lembrete'
        and a.criado_em > now() - make_interval(days => g.lembrete_dias) + interval '1 hour'
    );

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

-- ---------------------------------------------------------------
-- Gastos recorrentes
-- ---------------------------------------------------------------

-- p é o mesmo formato de salvar_gasto; p_gasto é o primeiro gasto, já salvo
create or replace function public.criar_recorrente(p jsonb, p_frequencia text, p_gasto uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grupo uuid := (p ->> 'grupo_id')::uuid;
  v_base date := coalesce((p ->> 'data')::date, current_date);
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

create or replace function public.parar_recorrente(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.recorrentes r
  set ativo = false
  where r.id = p_id and public.eh_membro(r.grupo_id);
  if not found then
    raise exception 'Gasto recorrente não encontrado';
  end if;
end;
$$;

-- lança tudo que venceu até hoje; p_grupos nulo = todos os grupos
create or replace function public.lancar_recorrentes_internos(p_grupos uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recorrentes%rowtype;
  v_lancados int := 0;
begin
  for r in
    select * from public.recorrentes
    where ativo and proxima_data <= current_date and (p_grupos is null or grupo_id = any (p_grupos))
    for update skip locked
  loop
    while r.ativo and r.proxima_data <= current_date loop
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

-- chamado pelo app ao abrir: lança os vencidos dos grupos de quem chamou
create or replace function public.lancar_meus_recorrentes()
returns int
language sql
security definer
set search_path = ''
as $$
  select public.lancar_recorrentes_internos(
    array(select grupo_id from public.membros where usuario_id = auth.uid() and ativo)
  )
$$;

-- chamado pelo agendamento diário
create or replace function public.lancar_recorrentes()
returns int
language sql
security definer
set search_path = ''
as $$
  select public.lancar_recorrentes_internos(null)
$$;

-- ---------------------------------------------------------------
-- RLS e permissões
-- ---------------------------------------------------------------

alter table public.avisos enable row level security;
alter table public.recorrentes enable row level security;

create policy "cada um vê os seus avisos" on public.avisos
  for select to authenticated
  using (usuario_id = auth.uid());

create policy "cada um marca os seus avisos como lidos" on public.avisos
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "membros veem os recorrentes" on public.recorrentes
  for select to authenticated
  using (public.eh_membro(grupo_id));

revoke all on public.avisos from anon, authenticated;
revoke all on public.recorrentes from anon, authenticated;
grant select on public.avisos to authenticated;
grant update (lido) on public.avisos to authenticated;
grant select on public.recorrentes to authenticated;

-- só o que o app usa fica aberto; o resto roda por trigger, agendamento ou dentro de outras funções
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.valor_a_cobrar(numeric) to authenticated;
grant execute on function public.reais(numeric) to authenticated;
grant execute on function public.eh_membro(uuid) to authenticated;
grant execute on function public.compartilha_grupo(uuid) to authenticated;
grant execute on function public.criar_grupo(text, text, boolean, text[], int) to authenticated;
grant execute on function public.entrar_no_grupo(text) to authenticated;
grant execute on function public.sair_do_grupo(uuid) to authenticated;
grant execute on function public.novo_codigo_convite(uuid) to authenticated;
grant execute on function public.salvar_gasto(jsonb) to authenticated;
grant execute on function public.marcar_pago(uuid, uuid, uuid, numeric, uuid) to authenticated;
grant execute on function public.resumo_meus_grupos() to authenticated;
grant execute on function public.criar_recorrente(jsonb, text, uuid) to authenticated;
grant execute on function public.parar_recorrente(uuid) to authenticated;
grant execute on function public.lancar_meus_recorrentes() to authenticated;
