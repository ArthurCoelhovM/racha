-- Racha — esquema inicial
-- Valores exatos em numeric; o arredondamento para cima acontece só na cobrança.

-- ---------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------

create or replace function public.gerar_codigo()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6)
$$;

-- arredonda para cima no centavo, ignorando resíduos menores que 1e-9
create or replace function public.valor_a_cobrar(v numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when v <= 0.000000001 then 0
              else ceil((v - 0.000000001) * 100) / 100 end
$$;

-- ---------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  email text,
  push_token text,
  criado_em timestamptz not null default now()
);

create table public.grupos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 60),
  cor text not null default '#5B4CF0',
  abatimento boolean not null default true,
  divisoes_permitidas text[] not null default array['igual', 'exato', 'porcentagem', 'cotas', 'itens'],
  lembrete_dias int not null default 7 check (lembrete_dias between 0 and 90),
  codigo_convite text not null unique default public.gerar_codigo(),
  criado_por uuid not null references public.perfis (id),
  criado_em timestamptz not null default now(),
  constraint divisoes_validas check (
    cardinality(divisoes_permitidas) > 0
    and divisoes_permitidas <@ array['igual', 'exato', 'porcentagem', 'cotas', 'itens']
  )
);

create table public.membros (
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  usuario_id uuid not null references public.perfis (id) on delete cascade,
  papel text not null default 'membro' check (papel in ('dono', 'membro')),
  ativo boolean not null default true,
  entrou_em timestamptz not null default now(),
  primary key (grupo_id, usuario_id)
);

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  descricao text not null check (char_length(descricao) between 1 and 80),
  valor_total numeric(14, 2) not null check (valor_total > 0),
  data date not null default current_date,
  tipo_divisao text not null check (tipo_divisao in ('igual', 'exato', 'porcentagem', 'cotas', 'itens')),
  itens jsonb,
  criado_por uuid not null references public.perfis (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index gastos_grupo_data on public.gastos (grupo_id, data desc);

create table public.gasto_pagadores (
  gasto_id uuid not null references public.gastos (id) on delete cascade,
  usuario_id uuid not null references public.perfis (id),
  valor numeric(14, 2) not null check (valor > 0),
  primary key (gasto_id, usuario_id)
);

create table public.gasto_divisoes (
  gasto_id uuid not null references public.gastos (id) on delete cascade,
  usuario_id uuid not null references public.perfis (id),
  parametro numeric,
  valor numeric not null check (valor >= 0),
  primary key (gasto_id, usuario_id)
);

-- quem deve a quem por gasto, sempre par a par
create table public.dividas (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  gasto_id uuid not null references public.gastos (id) on delete cascade,
  devedor uuid not null references public.perfis (id),
  credor uuid not null references public.perfis (id),
  valor numeric not null check (valor > 0),
  check (devedor <> credor),
  unique (gasto_id, devedor, credor)
);
create index dividas_grupo on public.dividas (grupo_id, devedor, credor);

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  de uuid not null references public.perfis (id),
  para uuid not null references public.perfis (id),
  valor numeric not null check (valor > 0),
  valor_cobrado numeric(14, 2) not null,
  gasto_id uuid references public.gastos (id) on delete cascade,
  marcado_por uuid not null references public.perfis (id),
  criado_em timestamptz not null default now(),
  check (de <> para)
);
create index pagamentos_grupo on public.pagamentos (grupo_id, de, para);

-- totais por par direcionado, mantidos por trigger
create table public.saldos_pares (
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  devedor uuid not null references public.perfis (id) on delete cascade,
  credor uuid not null references public.perfis (id) on delete cascade,
  devido numeric not null default 0,
  pago numeric not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (grupo_id, devedor, credor)
);

create table public.historico (
  id bigint generated always as identity primary key,
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  usuario_id uuid references public.perfis (id) on delete set null,
  entidade text not null,
  acao text not null,
  registro_id uuid,
  antes jsonb,
  depois jsonb,
  criado_em timestamptz not null default now()
);
create index historico_grupo on public.historico (grupo_id, criado_em desc);

-- ---------------------------------------------------------------
-- Funções de apoio para RLS
-- ---------------------------------------------------------------

create or replace function public.eh_membro(g uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membros m
    where m.grupo_id = g and m.usuario_id = auth.uid() and m.ativo
  )
$$;

create or replace function public.compartilha_grupo(outro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.membros eu
    join public.membros ele on ele.grupo_id = eu.grupo_id
    where eu.usuario_id = auth.uid() and eu.ativo and ele.usuario_id = outro
  )
$$;

-- ---------------------------------------------------------------
-- Perfil criado junto com o usuário
-- ---------------------------------------------------------------

create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, email)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
after insert on auth.users
for each row execute function public.criar_perfil();

-- ---------------------------------------------------------------
-- saldos_pares: recalculado a cada mudança em dívidas ou pagamentos
-- ---------------------------------------------------------------

create or replace function public.recalcular_saldo_par(g uuid, d uuid, c uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.grupos where id = g) then
    return;
  end if;

  insert into public.saldos_pares (grupo_id, devedor, credor, devido, pago, atualizado_em)
  values (
    g, d, c,
    coalesce((select sum(valor) from public.dividas where grupo_id = g and devedor = d and credor = c), 0),
    coalesce((select sum(valor) from public.pagamentos where grupo_id = g and de = d and para = c), 0),
    now()
  )
  on conflict (grupo_id, devedor, credor) do update
    set devido = excluded.devido, pago = excluded.pago, atualizado_em = now();
end;
$$;

create or replace function public.ao_mudar_divida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recalcular_saldo_par(old.grupo_id, old.devedor, old.credor);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recalcular_saldo_par(new.grupo_id, new.devedor, new.credor);
  end if;
  return null;
end;
$$;

create or replace function public.ao_mudar_pagamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recalcular_saldo_par(old.grupo_id, old.de, old.para);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recalcular_saldo_par(new.grupo_id, new.de, new.para);
  end if;
  return null;
end;
$$;

create trigger saldo_por_divida
after insert or update or delete on public.dividas
for each row execute function public.ao_mudar_divida();

create trigger saldo_por_pagamento
after insert or update or delete on public.pagamentos
for each row execute function public.ao_mudar_pagamento();

-- ---------------------------------------------------------------
-- Histórico de alterações
-- ---------------------------------------------------------------

create or replace function public.registrar_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grupo uuid;
  v_registro uuid;
begin
  if tg_table_name = 'grupos' then
    v_grupo := coalesce(new.id, old.id);
    v_registro := v_grupo;
  elsif tg_table_name = 'membros' then
    v_grupo := coalesce(new.grupo_id, old.grupo_id);
    v_registro := coalesce(new.usuario_id, old.usuario_id);
  else
    v_grupo := coalesce(new.grupo_id, old.grupo_id);
    v_registro := coalesce(new.id, old.id);
  end if;

  if not exists (select 1 from public.grupos where id = v_grupo) then
    return null;
  end if;

  insert into public.historico (grupo_id, usuario_id, entidade, acao, registro_id, antes, depois)
  values (
    v_grupo,
    auth.uid(),
    tg_table_name,
    lower(tg_op),
    v_registro,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end;
$$;

create trigger historico_grupos
after update on public.grupos
for each row execute function public.registrar_historico();

create trigger historico_membros
after insert or update on public.membros
for each row execute function public.registrar_historico();

create trigger historico_gastos_exclusao
after delete on public.gastos
for each row execute function public.registrar_historico();

create trigger historico_pagamentos
after insert or delete on public.pagamentos
for each row execute function public.registrar_historico();

-- ---------------------------------------------------------------
-- Grupos e convites
-- ---------------------------------------------------------------

create or replace function public.criar_grupo(
  p_nome text,
  p_cor text default '#5B4CF0',
  p_abatimento boolean default true,
  p_divisoes text[] default array['igual', 'exato', 'porcentagem', 'cotas', 'itens'],
  p_lembrete_dias int default 7
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Faça login para criar um grupo';
  end if;

  insert into public.grupos (nome, cor, abatimento, divisoes_permitidas, lembrete_dias, criado_por)
  values (trim(p_nome), p_cor, p_abatimento, p_divisoes, p_lembrete_dias, auth.uid())
  returning id into v_id;

  insert into public.membros (grupo_id, usuario_id, papel)
  values (v_id, auth.uid(), 'dono');

  return v_id;
end;
$$;

create or replace function public.entrar_no_grupo(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grupo uuid;
begin
  if auth.uid() is null then
    raise exception 'Faça login para entrar em um grupo';
  end if;

  select id into v_grupo
  from public.grupos
  where codigo_convite = upper(regexp_replace(p_codigo, '[^A-Za-z0-9]', '', 'g'));

  if v_grupo is null then
    raise exception 'Código de convite não encontrado';
  end if;

  insert into public.membros (grupo_id, usuario_id)
  values (v_grupo, auth.uid())
  on conflict (grupo_id, usuario_id) do update set ativo = true
  where not public.membros.ativo;

  return v_grupo;
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
  set ativo = false
  where grupo_id = p_grupo and usuario_id = auth.uid() and ativo;

  if not found then
    raise exception 'Você não participa deste grupo';
  end if;
end;
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

  update public.grupos
  set codigo_convite = public.gerar_codigo()
  where id = p_grupo
  returning codigo_convite into v_codigo;

  return v_codigo;
end;
$$;

-- ---------------------------------------------------------------
-- Gastos
-- ---------------------------------------------------------------

-- p: {id?, grupo_id, descricao, valor_total, data, tipo_divisao, itens?,
--     pagadores: [{usuario_id, valor}], divisoes: [{usuario_id, parametro, valor}]}
create or replace function public.salvar_gasto(p jsonb)
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
  if not public.eh_membro(v_grupo) then
    raise exception 'Você não participa deste grupo';
  end if;

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
    insert into public.gastos (grupo_id, descricao, valor_total, data, tipo_divisao, itens, criado_por)
    values (
      v_grupo,
      trim(p ->> 'descricao'),
      v_total,
      coalesce((p ->> 'data')::date, current_date),
      v_tipo,
      p -> 'itens',
      auth.uid()
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

  -- saldo de cada pessoa no gasto: quanto pagou menos a sua parte.
  -- quem ficou negativo deve a quem ficou positivo, na proporção do que cada um adiantou.
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
    v_grupo, auth.uid(), 'gastos',
    case when v_antes is null then 'insert' else 'update' end,
    v_id, v_antes, v_depois
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------------
-- Pagamentos
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

  insert into public.pagamentos (grupo_id, de, para, valor, valor_cobrado, gasto_id, marcado_por)
  values (p_grupo, p_de, p_para, p_valor, public.valor_a_cobrar(p_valor), p_gasto, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------
-- Resumo para a lista de grupos
-- ---------------------------------------------------------------

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
  with meus as (
    select g.id, g.nome, g.cor, g.abatimento, g.criado_em
    from public.grupos g
    join public.membros m on m.grupo_id = g.id
    where m.usuario_id = auth.uid() and m.ativo
  ),
  pares as (
    select
      s.grupo_id,
      case when s.devedor = auth.uid() then s.credor else s.devedor end as outro,
      sum(case when s.devedor = auth.uid() then s.devido - s.pago else 0 end) as eu_devo,
      sum(case when s.credor = auth.uid() then s.devido - s.pago else 0 end) as me_devem
    from public.saldos_pares s
    where s.grupo_id in (select id from meus)
      and auth.uid() in (s.devedor, s.credor)
    group by 1, 2
  )
  select
    g.id,
    g.nome,
    g.cor,
    g.abatimento,
    (select count(*)::int from public.membros m where m.grupo_id = g.id and m.ativo),
    coalesce(sum(case when g.abatimento then greatest(p.eu_devo - p.me_devem, 0) else greatest(p.eu_devo, 0) end), 0),
    coalesce(sum(case when g.abatimento then greatest(p.me_devem - p.eu_devo, 0) else greatest(p.me_devem, 0) end), 0)
  from meus g
  left join pares p on p.grupo_id = g.id
  group by g.id, g.nome, g.cor, g.abatimento, g.criado_em
  order by g.criado_em desc
$$;

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------

alter table public.perfis enable row level security;
alter table public.grupos enable row level security;
alter table public.membros enable row level security;
alter table public.gastos enable row level security;
alter table public.gasto_pagadores enable row level security;
alter table public.gasto_divisoes enable row level security;
alter table public.dividas enable row level security;
alter table public.pagamentos enable row level security;
alter table public.saldos_pares enable row level security;
alter table public.historico enable row level security;

create policy "ver o próprio perfil e de quem divide grupo" on public.perfis
  for select to authenticated
  using (id = auth.uid() or public.compartilha_grupo(id));

create policy "editar o próprio perfil" on public.perfis
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "membros veem o grupo" on public.grupos
  for select to authenticated
  using (public.eh_membro(id));

create policy "membros editam o grupo" on public.grupos
  for update to authenticated
  using (public.eh_membro(id))
  with check (public.eh_membro(id));

create policy "membros veem os membros" on public.membros
  for select to authenticated
  using (public.eh_membro(grupo_id));

create policy "membros veem os gastos" on public.gastos
  for select to authenticated
  using (public.eh_membro(grupo_id));

create policy "membros excluem gastos" on public.gastos
  for delete to authenticated
  using (public.eh_membro(grupo_id));

create policy "membros veem pagadores" on public.gasto_pagadores
  for select to authenticated
  using (exists (select 1 from public.gastos g where g.id = gasto_id and public.eh_membro(g.grupo_id)));

create policy "membros veem divisões" on public.gasto_divisoes
  for select to authenticated
  using (exists (select 1 from public.gastos g where g.id = gasto_id and public.eh_membro(g.grupo_id)));

create policy "membros veem dívidas" on public.dividas
  for select to authenticated
  using (public.eh_membro(grupo_id));

create policy "membros veem pagamentos" on public.pagamentos
  for select to authenticated
  using (public.eh_membro(grupo_id));

create policy "quem pagou ou recebeu desfaz o pagamento" on public.pagamentos
  for delete to authenticated
  using (public.eh_membro(grupo_id) and auth.uid() in (de, para));

create policy "membros veem saldos" on public.saldos_pares
  for select to authenticated
  using (public.eh_membro(grupo_id));

create policy "membros veem o histórico" on public.historico
  for select to authenticated
  using (public.eh_membro(grupo_id));

-- ---------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select, update on public.perfis to authenticated;
grant select, update on public.grupos to authenticated;
grant select on public.membros to authenticated;
grant select, delete on public.gastos to authenticated;
grant select on public.gasto_pagadores to authenticated;
grant select on public.gasto_divisoes to authenticated;
grant select on public.dividas to authenticated;
grant select, delete on public.pagamentos to authenticated;
grant select on public.saldos_pares to authenticated;
grant select on public.historico to authenticated;

revoke execute on all functions in schema public from public, anon;

grant execute on function public.valor_a_cobrar(numeric) to authenticated;
grant execute on function public.eh_membro(uuid) to authenticated;
grant execute on function public.compartilha_grupo(uuid) to authenticated;
grant execute on function public.criar_grupo(text, text, boolean, text[], int) to authenticated;
grant execute on function public.entrar_no_grupo(text) to authenticated;
grant execute on function public.sair_do_grupo(uuid) to authenticated;
grant execute on function public.novo_codigo_convite(uuid) to authenticated;
grant execute on function public.salvar_gasto(jsonb) to authenticated;
grant execute on function public.marcar_pago(uuid, uuid, uuid, numeric, uuid) to authenticated;
grant execute on function public.resumo_meus_grupos() to authenticated;

-- grupos.update só pode mexer nas configurações, não no código nem no criador
revoke update on public.grupos from authenticated;
grant update (nome, cor, abatimento, divisoes_permitidas, lembrete_dias) on public.grupos to authenticated;

revoke update on public.perfis from authenticated;
grant update (nome, push_token) on public.perfis to authenticated;
