-- Pedidos de 12/11 sobre a revisão:
-- 1. Quem saiu continua vendo e pagando o que deve; o grupo vê a dívida como de quem saiu
-- 2. Valores em centavos exatos: as partes somam o total, e o centavo que sobra fica com quem pagou
-- 3. Papéis (dono, admin, membro) e permissões que o dono escolhe
-- 4. Histórico de cada gasto (a tela usa a tabela historico; aqui o código de convite sai dele)

-- ---------------------------------------------------------------
-- 3. Papéis e permissões
-- ---------------------------------------------------------------

alter table public.membros drop constraint membros_papel_check;
alter table public.membros add constraint membros_papel_check check (papel in ('dono', 'admin', 'membro'));

-- para cada ação, o papel mínimo para fazê-la
alter table public.grupos add column permissoes jsonb not null default jsonb_build_object(
  'registrar_gastos', 'membro',
  'editar_gastos_de_outros', 'admin',
  'mudar_configuracoes', 'admin',
  'convidar_membros', 'membro',
  'remover_membros', 'admin'
);

create or replace function public.nivel_do_papel(p text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p when 'dono' then 3 when 'admin' then 2 when 'membro' then 1 else 0 end
$$;

create or replace function public.permissoes_validas(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p) = 'object'
    and (select coalesce(bool_and(
          chave in ('registrar_gastos', 'editar_gastos_de_outros', 'mudar_configuracoes', 'convidar_membros', 'remover_membros')
          and valor in ('membro', 'admin', 'dono')), true)
         from jsonb_each_text(p) as x(chave, valor))
$$;

alter table public.grupos add constraint grupos_permissoes_validas check (public.permissoes_validas(permissoes));

create or replace function public.meu_papel(g uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.papel from public.membros m
  where m.grupo_id = g and m.usuario_id = auth.uid() and m.ativo
$$;

create or replace function public.pode(g uuid, acao text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.nivel_do_papel(public.meu_papel(g))
      >= public.nivel_do_papel(coalesce((select gr.permissoes ->> acao from public.grupos gr where gr.id = g), 'dono')),
    false)
$$;

-- o dono que sai passa o papel primeiro para um admin, depois para o membro mais antigo
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
      order by (papel = 'admin') desc, entrou_em, usuario_id
      limit 1
    );
end;
$$;

-- configurações do grupo passam a ser mudadas só por esta função, que confere a permissão
drop policy "membros editam o grupo" on public.grupos;
revoke update on public.grupos from authenticated, anon;

create or replace function public.atualizar_grupo(
  p_grupo uuid,
  p_nome text,
  p_cor text,
  p_abatimento boolean,
  p_divisoes text[],
  p_lembrete_dias int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_membro(p_grupo) then
    raise exception 'Você não participa deste grupo';
  end if;
  if not public.pode(p_grupo, 'mudar_configuracoes') then
    raise exception 'Você não tem permissão para mudar as configurações deste grupo';
  end if;
  update public.grupos
  set nome = trim(p_nome),
      cor = p_cor,
      abatimento = p_abatimento,
      divisoes_permitidas = p_divisoes,
      lembrete_dias = p_lembrete_dias
  where id = p_grupo;
end;
$$;

create or replace function public.definir_permissoes(p_grupo uuid, p_permissoes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_dono(p_grupo) then
    raise exception 'Só o dono do grupo muda as permissões';
  end if;
  if not public.permissoes_validas(p_permissoes) then
    raise exception 'Permissões inválidas';
  end if;
  update public.grupos set permissoes = permissoes || p_permissoes where id = p_grupo;
end;
$$;

create or replace function public.definir_papel(p_grupo uuid, p_usuario uuid, p_papel text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_dono(p_grupo) then
    raise exception 'Só o dono do grupo escolhe quem é admin';
  end if;
  if p_papel not in ('admin', 'membro') then
    raise exception 'Papel inválido';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'Para deixar de ser dono, passe o papel para outra pessoa';
  end if;
  update public.membros set papel = p_papel
  where grupo_id = p_grupo and usuario_id = p_usuario and ativo;
  if not found then
    raise exception 'Essa pessoa não está no grupo';
  end if;
end;
$$;

create or replace function public.passar_dono(p_grupo uuid, p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_dono(p_grupo) then
    raise exception 'Só o dono do grupo pode passar o papel de dono';
  end if;
  if p_usuario = auth.uid() then
    return;
  end if;
  if not exists (select 1 from public.membros where grupo_id = p_grupo and usuario_id = p_usuario and ativo) then
    raise exception 'Essa pessoa não está no grupo';
  end if;
  update public.membros set papel = 'admin' where grupo_id = p_grupo and usuario_id = auth.uid();
  update public.membros set papel = 'dono' where grupo_id = p_grupo and usuario_id = p_usuario;
end;
$$;

create or replace function public.remover_membro(p_grupo uuid, p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_papel text;
  v_nome text;
begin
  if not public.pode(p_grupo, 'remover_membros') then
    raise exception 'Você não tem permissão para remover pessoas deste grupo';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'Para sair, use "Sair do grupo"';
  end if;
  select papel into v_papel from public.membros where grupo_id = p_grupo and usuario_id = p_usuario and ativo;
  if v_papel is null then
    raise exception 'Essa pessoa não está no grupo';
  end if;
  if v_papel = 'dono' then
    raise exception 'O dono não pode ser removido';
  end if;
  if v_papel = 'admin' and not public.eh_dono(p_grupo) then
    raise exception 'Só o dono remove um admin';
  end if;

  update public.membros set ativo = false, papel = 'membro'
  where grupo_id = p_grupo and usuario_id = p_usuario;

  select nome into v_nome from public.grupos where id = p_grupo;
  insert into public.avisos (usuario_id, grupo_id, tipo, titulo, corpo, dados)
  values (
    p_usuario, p_grupo, 'membro', v_nome,
    'Você foi removido do grupo. O que estiver em aberto continua aparecendo para você na tela inicial.',
    jsonb_build_object('removido', true)
  );
end;
$$;

-- registrar gastos e mexer nos gastos dos outros seguem as permissões do grupo
create or replace function public.salvar_gasto(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grupo uuid := (p ->> 'grupo_id')::uuid;
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_autor uuid;
begin
  if not public.eh_membro(v_grupo) then
    raise exception 'Você não participa deste grupo';
  end if;
  if v_id is null then
    if not public.pode(v_grupo, 'registrar_gastos') then
      raise exception 'Você não tem permissão para registrar gastos neste grupo';
    end if;
  else
    select criado_por into v_autor from public.gastos where id = v_id and grupo_id = v_grupo;
    if v_autor is distinct from auth.uid() and not public.pode(v_grupo, 'editar_gastos_de_outros') then
      raise exception 'Você não tem permissão para editar gastos de outras pessoas neste grupo';
    end if;
  end if;
  return public.gravar_gasto(p - 'recorrente_id', auth.uid());
end;
$$;

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
  if v_gasto.criado_por <> auth.uid() and not public.pode(v_gasto.grupo_id, 'editar_gastos_de_outros') then
    raise exception 'Você não tem permissão para excluir gastos de outras pessoas neste grupo';
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
  if not public.pode(v_grupo, 'registrar_gastos') then
    raise exception 'Você não tem permissão para registrar gastos neste grupo';
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

-- ---------------------------------------------------------------
-- Código de convite: só quem pode convidar vê e troca
-- ---------------------------------------------------------------

revoke select on public.grupos from authenticated, anon;
grant select (id, nome, cor, abatimento, divisoes_permitidas, lembrete_dias, criado_por, criado_em, permissoes)
  on public.grupos to authenticated;

create or replace function public.codigo_do_grupo(p_grupo uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.pode(p_grupo, 'convidar_membros') then
    raise exception 'Você não tem permissão para convidar pessoas para este grupo';
  end if;
  return (select codigo_convite from public.grupos where id = p_grupo);
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
  if not public.pode(p_grupo, 'convidar_membros') then
    raise exception 'Você não tem permissão para convidar pessoas para este grupo';
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

-- o histórico do grupo deixa de guardar o código; fica só a marca de que ele foi trocado
create or replace function public.registrar_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grupo uuid;
  v_registro uuid;
  v_antes jsonb;
  v_depois jsonb;
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

  v_antes := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_depois := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  if tg_table_name = 'grupos' then
    v_depois := (v_depois - 'codigo_convite')
      || jsonb_build_object('codigo_trocado', (v_antes ->> 'codigo_convite') is distinct from (v_depois ->> 'codigo_convite'));
    v_antes := v_antes - 'codigo_convite';
  end if;

  insert into public.historico (grupo_id, usuario_id, entidade, acao, registro_id, antes, depois)
  values (v_grupo, auth.uid(), tg_table_name, lower(tg_op), v_registro, v_antes, v_depois);
  return null;
end;
$$;

update public.historico
set depois = (depois - 'codigo_convite')
      || jsonb_build_object('codigo_trocado', (antes ->> 'codigo_convite') is distinct from (depois ->> 'codigo_convite')),
    antes = antes - 'codigo_convite'
where entidade = 'grupos' and (antes ? 'codigo_convite' or depois ? 'codigo_convite');

-- ---------------------------------------------------------------
-- 2. Centavos exatos
-- ---------------------------------------------------------------

-- Reparte as partes em centavos: cada um fica com o piso da sua parte exata, e os centavos que
-- sobram vão primeiro para quem pagou (quem pagou mais vem antes) e depois para a maior fração.
-- Assim as partes somam o total exato e ninguém além de quem pagou paga o centavo a mais.
create or replace function public.partes_em_centavos(p_total numeric, p_partes jsonb, p_pagadores jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with partes as (
    select (x ->> 'usuario_id')::uuid as u,
           x -> 'parametro' as parametro,
           (x ->> 'valor')::numeric as exato,
           n as ordem
    from jsonb_array_elements(p_partes) with ordinality as t(x, n)
    where (x ->> 'valor')::numeric > 0
  ),
  pagos as (
    select (y ->> 'usuario_id')::uuid as u, sum((y ->> 'valor')::numeric) as pago
    from jsonb_array_elements(coalesce(p_pagadores, '[]')) y
    group by 1
  ),
  pisos as (
    select p.*, round(floor(p.exato * 100) / 100, 2) as piso, coalesce(g.pago, 0) as pago
    from partes p
    left join pagos g on g.u = p.u
  ),
  resto as (
    select greatest(round((round(p_total, 2) - sum(piso)) * 100), 0)::int as centavos from pisos
  ),
  fila as (
    select s.*, row_number() over (order by s.pago desc, (s.exato - s.piso) desc, s.ordem) as posicao
    from pisos s
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'usuario_id', f.u,
             'parametro', f.parametro,
             'valor', f.piso + case when f.posicao <= r.centavos then 0.01 else 0 end
           ) order by f.ordem),
         '[]')
  from fila f, resto r
$$;

-- Quem deve a quem num gasto, em centavos. Com mais de um pagador, a dívida de cada pessoa é
-- dividida na proporção do que cada pagador adiantou; os centavos são distribuídos de forma
-- que cada devedor pague exatamente a sua parte e cada pagador receba exatamente o que adiantou.
create or replace function public.calcular_dividas(p_gasto uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grupo uuid;
  r record;
  v_falta_linha numeric;
  v_falta_coluna numeric;
  v_rodada int := 0;
begin
  select grupo_id into v_grupo from public.gastos where id = p_gasto;
  delete from public.dividas where gasto_id = p_gasto;
  if v_grupo is null then
    return;
  end if;

  create temporary table if not exists pg_temp.calculo_dividas (
    devedor uuid, credor uuid, exato numeric, valor numeric, alvo_linha numeric, alvo_coluna numeric
  ) on commit drop;
  truncate pg_temp.calculo_dividas;

  with movimentos as (
    select usuario_id as u, valor as pago, 0::numeric as parte from public.gasto_pagadores where gasto_id = p_gasto
    union all
    select usuario_id, 0, valor from public.gasto_divisoes where gasto_id = p_gasto
  ),
  posicoes as (
    select u, sum(pago) - sum(parte) as saldo from movimentos group by u
  ),
  credito as (
    select sum(saldo) as soma from posicoes where saldo > 0
  )
  insert into pg_temp.calculo_dividas
  select d.u, c.u,
         (-d.saldo) * c.saldo / t.soma,
         round(floor((-d.saldo) * c.saldo / t.soma * 100) / 100, 2),
         -d.saldo,
         c.saldo
  from posicoes d, posicoes c, credito t
  where d.saldo < 0 and c.saldo > 0;

  -- distribui os centavos que faltam, primeiro nas maiores frações
  loop
    v_rodada := v_rodada + 1;
    exit when v_rodada > 50;
    exit when not exists (
      select 1 from pg_temp.calculo_dividas x
      group by x.devedor having max(x.alvo_linha) - sum(x.valor) >= 0.01
    );
    for r in
      select devedor, credor from pg_temp.calculo_dividas order by exato - valor desc, devedor, credor
    loop
      select max(alvo_linha) - sum(valor) into v_falta_linha from pg_temp.calculo_dividas where devedor = r.devedor;
      select max(alvo_coluna) - sum(valor) into v_falta_coluna from pg_temp.calculo_dividas where credor = r.credor;
      if v_falta_linha >= 0.01 and v_falta_coluna >= 0.01 then
        update pg_temp.calculo_dividas set valor = valor + 0.01 where devedor = r.devedor and credor = r.credor;
      end if;
    end loop;
  end loop;

  insert into public.dividas (grupo_id, gasto_id, devedor, credor, valor)
  select v_grupo, p_gasto, devedor, credor, valor
  from pg_temp.calculo_dividas
  where valor > 0;
end;
$$;

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
  v_partes jsonb;
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

  if exists (
    select 1 from jsonb_array_elements(p -> 'pagadores') x
    where (x ->> 'valor')::numeric <> round((x ->> 'valor')::numeric, 2)
  ) then
    raise exception 'Os valores pagos precisam estar em reais e centavos';
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

  -- o app já manda em centavos; recorrentes antigos e chamadas diretas são acertados aqui
  v_partes := public.partes_em_centavos(v_total, p -> 'divisoes', p -> 'pagadores');

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
  from jsonb_array_elements(v_partes) x
  where (x ->> 'valor')::numeric > 0;

  perform public.calcular_dividas(v_id);

  select (p - 'id' - 'divisoes') || jsonb_build_object('id', v_id, 'divisoes', v_partes) into v_depois;

  insert into public.historico (grupo_id, usuario_id, entidade, acao, registro_id, antes, depois)
  values (
    v_grupo, p_autor, 'gastos',
    case when v_antes is null then 'insert' else 'update' end,
    v_id, v_antes, v_depois
  );

  return v_id;
end;
$$;

-- pagamentos em centavos
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
  v_valor numeric := round(p_valor, 2);
begin
  -- quem saiu do grupo continua podendo marcar o que pagou ou recebeu
  if not exists (select 1 from public.membros where grupo_id = p_grupo and usuario_id = auth.uid()) then
    raise exception 'Você não participa deste grupo';
  end if;

  if auth.uid() not in (p_de, p_para) then
    raise exception 'Só quem paga ou quem recebe pode marcar o pagamento';
  end if;

  if v_valor is null or v_valor <= 0 then
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

  if v_aberto <= 0 then
    raise exception 'Essa dívida já está paga. Puxe a tela para atualizar.';
  end if;

  if v_valor > v_aberto then
    raise exception 'O valor passa do que está em aberto (%).', public.reais(v_aberto);
  end if;

  insert into public.pagamentos (grupo_id, de, para, valor, valor_cobrado, gasto_id, marcado_por)
  values (p_grupo, p_de, p_para, v_valor, v_valor, p_gasto, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- gastos e pagamentos que já existiam passam para centavos exatos
do $$
declare
  g record;
  v_partes jsonb;
begin
  for g in select id, valor_total from public.gastos loop
    select public.partes_em_centavos(
      g.valor_total,
      (select jsonb_agg(jsonb_build_object('usuario_id', d.usuario_id, 'parametro', d.parametro, 'valor', d.valor)
                        order by d.usuario_id)
       from public.gasto_divisoes d where d.gasto_id = g.id),
      (select jsonb_agg(jsonb_build_object('usuario_id', p.usuario_id, 'valor', p.valor))
       from public.gasto_pagadores p where p.gasto_id = g.id)
    ) into v_partes;

    update public.gasto_divisoes d
    set valor = (x ->> 'valor')::numeric
    from jsonb_array_elements(v_partes) x
    where d.gasto_id = g.id and d.usuario_id = (x ->> 'usuario_id')::uuid
      and d.valor <> (x ->> 'valor')::numeric;

    perform public.calcular_dividas(g.id);
  end loop;
end $$;

update public.pagamentos
set valor = greatest(round(valor, 2), 0.01), valor_cobrado = greatest(round(valor, 2), 0.01)
where valor <> round(valor, 2) or valor_cobrado <> round(valor, 2);

-- ---------------------------------------------------------------
-- 1. Quem saiu do grupo
-- ---------------------------------------------------------------

-- o que está em aberto nos grupos que a pessoa deixou (ou de que foi removida)
create or replace function public.pendencias_de_grupos_que_sai()
returns table (
  grupo_id uuid,
  grupo_nome text,
  grupo_cor text,
  devedor uuid,
  credor uuid,
  outra_pessoa text,
  gasto_id uuid,
  descricao text,
  data date,
  valor text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  g record;
begin
  for g in
    select gr.id, gr.nome, gr.cor
    from public.membros m
    join public.grupos gr on gr.id = m.grupo_id
    where m.usuario_id = auth.uid() and not m.ativo
    order by gr.nome
  loop
    return query
    select g.id, g.nome, g.cor, x.devedor, x.credor,
           coalesce(pf.nome, 'Alguém'),
           x.gasto_id, gs.descricao, gs.data, x.valor::text
    from public.pendencias_internas(g.id) x
    left join public.gastos gs on gs.id = x.gasto_id
    left join public.perfis pf on pf.id = case when x.devedor = auth.uid() then x.credor else x.devedor end
    where auth.uid() in (x.devedor, x.credor)
    order by gs.data desc nulls last, x.valor desc;
  end loop;
end;
$$;

-- ---------------------------------------------------------------
-- Permissões das funções novas ou recriadas
-- ---------------------------------------------------------------

grant execute on function public.atualizar_grupo(uuid, text, text, boolean, text[], int) to authenticated;
grant execute on function public.definir_permissoes(uuid, jsonb) to authenticated;
grant execute on function public.definir_papel(uuid, uuid, text) to authenticated;
grant execute on function public.passar_dono(uuid, uuid) to authenticated;
grant execute on function public.remover_membro(uuid, uuid) to authenticated;
grant execute on function public.codigo_do_grupo(uuid) to authenticated;
grant execute on function public.pendencias_de_grupos_que_sai() to authenticated;
