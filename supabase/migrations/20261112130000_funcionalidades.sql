-- Funcionalidades novas da revisão: categorias, recorrente com valor variável, busca, arquivar grupo,
-- comprovante, comentários, exportar meus dados e apelido por grupo

-- ---------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------

alter table public.gastos add column categoria text not null default 'outros'
  check (categoria in ('mercado', 'casa', 'contas', 'transporte', 'restaurante', 'lazer', 'saude', 'outros'));


-- ---------------------------------------------------------------
-- Comprovante (foto no Supabase Storage, caminho grupo/gasto/arquivo)
-- ---------------------------------------------------------------

alter table public.gastos add column comprovante text check (char_length(comprovante) <= 300);

-- gravar_gasto passa a guardar a categoria e o comprovante
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
  v_categoria text := coalesce(nullif(p ->> 'categoria', ''), 'outros');
  v_comprovante text := nullif(p ->> 'comprovante', '');
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

  if v_comprovante is not null and split_part(v_comprovante, '/', 1) <> v_grupo::text then
    raise exception 'Comprovante de outro grupo';
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

  v_partes := public.partes_em_centavos(v_total, p -> 'divisoes', p -> 'pagadores');

  if v_id is not null then
    update public.gastos
    set descricao = trim(p ->> 'descricao'),
        valor_total = v_total,
        data = coalesce((p ->> 'data')::date, public.hoje_sp()),
        tipo_divisao = v_tipo,
        itens = p -> 'itens',
        categoria = v_categoria,
        comprovante = v_comprovante,
        atualizado_em = now()
    where id = v_id;

    delete from public.gasto_pagadores where gasto_id = v_id;
    delete from public.gasto_divisoes where gasto_id = v_id;
  else
    insert into public.gastos (grupo_id, descricao, valor_total, data, tipo_divisao, itens, criado_por, recorrente_id,
                               categoria, comprovante)
    values (
      v_grupo,
      trim(p ->> 'descricao'),
      v_total,
      coalesce((p ->> 'data')::date, public.hoje_sp()),
      v_tipo,
      p -> 'itens',
      p_autor,
      nullif(p ->> 'recorrente_id', '')::uuid,
      v_categoria,
      v_comprovante
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

  select (p - 'id' - 'divisoes') || jsonb_build_object('id', v_id, 'divisoes', v_partes, 'categoria', v_categoria)
  into v_depois;

  insert into public.historico (grupo_id, usuario_id, entidade, acao, registro_id, antes, depois)
  values (
    v_grupo, p_autor, 'gastos',
    case when v_antes is null then 'insert' else 'update' end,
    v_id, v_antes, v_depois
  );

  return v_id;
end;
$$;

-- fotos no Storage: só quem é do grupo vê e envia (o primeiro pedaço do caminho é o grupo)
do $$
begin
  if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('comprovantes', 'comprovantes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    execute $p$
      create policy "membros veem comprovantes" on storage.objects for select to authenticated
      using (bucket_id = 'comprovantes' and public.eh_membro((storage.foldername(name))[1]::uuid))
    $p$;
    execute $p$
      create policy "membros enviam comprovantes" on storage.objects for insert to authenticated
      with check (bucket_id = 'comprovantes' and public.eh_membro((storage.foldername(name))[1]::uuid))
    $p$;
    execute $p$
      create policy "quem enviou apaga o comprovante" on storage.objects for delete to authenticated
      using (bucket_id = 'comprovantes' and owner = auth.uid())
    $p$;
  end if;
end $$;

-- ---------------------------------------------------------------
-- Recorrente com valor variável (luz, água): o app avisa para preencher o valor
-- ---------------------------------------------------------------

alter table public.recorrentes add column valor_variavel boolean not null default false;

create table public.lancamentos_pendentes (
  id uuid primary key default gen_random_uuid(),
  recorrente_id uuid not null references public.recorrentes(id) on delete cascade,
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  data date not null,
  responsavel uuid not null references public.perfis(id),
  gasto_id uuid references public.gastos(id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (recorrente_id, data)
);

alter table public.lancamentos_pendentes enable row level security;
create policy "membros veem lançamentos pendentes" on public.lancamentos_pendentes
  for select to authenticated using (public.eh_membro(grupo_id));
revoke insert, update, delete on public.lancamentos_pendentes from authenticated, anon;

alter table public.avisos drop constraint if exists avisos_tipo_check;
alter table public.avisos add constraint avisos_tipo_check check (
  tipo in ('gasto_novo', 'gasto_editado', 'gasto_excluido', 'pagamento', 'membro', 'grupo', 'lembrete',
           'recorrente_parado', 'cobranca', 'falta_valor', 'comentario')
);

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
  v_responsavel uuid;
  v_grupo text;
begin
  for r in
    select * from public.recorrentes
    where ativo and proxima_data <= v_hoje and (p_grupos is null or grupo_id = any (p_grupos))
    for update skip locked
  loop
    while r.ativo and r.proxima_data <= v_hoje loop
      begin
        if r.valor_variavel then
          -- quem pagou da última vez preenche o valor
          v_responsavel := coalesce(
            (select (x ->> 'usuario_id')::uuid from jsonb_array_elements(r.modelo -> 'pagadores') x
             order by (x ->> 'valor')::numeric desc limit 1),
            r.criado_por);
          insert into public.lancamentos_pendentes (recorrente_id, grupo_id, data, responsavel)
          values (r.id, r.grupo_id, r.proxima_data, v_responsavel)
          on conflict (recorrente_id, data) do nothing;
          if found then
            select nome into v_grupo from public.grupos where id = r.grupo_id;
            insert into public.avisos (usuario_id, grupo_id, tipo, titulo, corpo, dados)
            values (
              v_responsavel, r.grupo_id, 'falta_valor', v_grupo,
              'Chegou a vez de "' || r.descricao || '". Preencha o valor desta conta.',
              jsonb_build_object('recorrente_id', r.id, 'data', r.proxima_data)
            );
          end if;
        else
          perform public.gravar_gasto(
            r.modelo || jsonb_build_object('data', r.proxima_data, 'recorrente_id', r.id),
            r.criado_por
          );
        end if;
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

create or replace function public.criar_recorrente(
  p jsonb,
  p_frequencia text,
  p_gasto uuid default null,
  p_valor_variavel boolean default false
)
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

  insert into public.recorrentes (grupo_id, descricao, valor_total, frequencia, dia, modelo, proxima_data, criado_por,
                                  valor_variavel)
  values (
    v_grupo,
    trim(p ->> 'descricao'),
    round((p ->> 'valor_total')::numeric, 2),
    p_frequencia,
    v_dia,
    p - 'id' - 'data' - 'recorrente_id' - 'comprovante',
    public.proxima_ocorrencia(v_base, p_frequencia, v_dia),
    auth.uid(),
    coalesce(p_valor_variavel, false)
  )
  returning id into v_id;

  if p_gasto is not null then
    update public.gastos set recorrente_id = v_id where id = p_gasto and grupo_id = v_grupo;
  end if;

  return v_id;
end;
$$;

drop function public.criar_recorrente(jsonb, text, uuid);

-- preencher o valor de um lançamento pendente vira um gasto normal ligado ao recorrente
create or replace function public.preencher_lancamento(p_pendente uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pendente public.lancamentos_pendentes%rowtype;
  v_id uuid;
begin
  select * into v_pendente from public.lancamentos_pendentes where id = p_pendente for update;
  if v_pendente.id is null or not public.eh_membro(v_pendente.grupo_id) then
    raise exception 'Lançamento não encontrado';
  end if;
  if v_pendente.gasto_id is not null then
    raise exception 'Esse valor já foi preenchido';
  end if;
  if (p ->> 'grupo_id')::uuid <> v_pendente.grupo_id then
    raise exception 'Lançamento de outro grupo';
  end if;

  v_id := public.gravar_gasto(
    (p - 'id') || jsonb_build_object('recorrente_id', v_pendente.recorrente_id),
    auth.uid()
  );
  update public.lancamentos_pendentes set gasto_id = v_id where id = p_pendente;
  -- o próximo mês já parte destes valores
  update public.recorrentes
  set modelo = (p - 'id' - 'data' - 'recorrente_id' - 'comprovante'),
      valor_total = round((p ->> 'valor_total')::numeric, 2)
  where id = v_pendente.recorrente_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------
-- Busca e filtro de gastos
-- ---------------------------------------------------------------

create or replace function public.buscar_gastos(
  p_grupo uuid,
  p_texto text default null,
  p_pessoa uuid default null,
  p_mes date default null,
  p_categoria text default null
)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.id
  from public.gastos g
  where g.grupo_id = p_grupo
    and public.eh_membro(p_grupo)
    and (coalesce(p_texto, '') = '' or g.descricao ilike '%' || p_texto || '%'
         or exists (select 1 from jsonb_array_elements(coalesce(g.itens, '[]')) i where i ->> 'descricao' ilike '%' || p_texto || '%'))
    and (p_pessoa is null
         or exists (select 1 from public.gasto_pagadores pp where pp.gasto_id = g.id and pp.usuario_id = p_pessoa)
         or exists (select 1 from public.gasto_divisoes dd where dd.gasto_id = g.id and dd.usuario_id = p_pessoa))
    and (p_mes is null or (g.data >= date_trunc('month', p_mes)::date
                           and g.data < (date_trunc('month', p_mes) + interval '1 month')::date))
    and (p_categoria is null or g.categoria = p_categoria)
  order by g.data desc, g.criado_em desc
  limit 300
$$;

-- ---------------------------------------------------------------
-- Arquivar grupo (cada pessoa arquiva para si) e apelido por grupo
-- ---------------------------------------------------------------

alter table public.membros add column arquivado boolean not null default false;
alter table public.membros add column apelido text check (char_length(apelido) between 1 and 40);

create or replace function public.arquivar_grupo(p_grupo uuid, p_arquivar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.membros set arquivado = p_arquivar
  where grupo_id = p_grupo and usuario_id = auth.uid() and ativo;
  if not found then
    raise exception 'Você não participa deste grupo';
  end if;
end;
$$;

create or replace function public.definir_apelido(p_grupo uuid, p_apelido text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.membros set apelido = nullif(trim(p_apelido), '')
  where grupo_id = p_grupo and usuario_id = auth.uid() and ativo;
  if not found then
    raise exception 'Você não participa deste grupo';
  end if;
end;
$$;

drop function public.resumo_meus_grupos();
create function public.resumo_meus_grupos()
returns table (
  grupo_id uuid,
  nome text,
  cor text,
  abatimento boolean,
  total_membros int,
  voce_deve numeric,
  te_devem numeric,
  arquivado boolean
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
    s.devem,
    m.arquivado
  from public.grupos g
  join public.membros m on m.grupo_id = g.id and m.usuario_id = auth.uid() and m.ativo
  cross join lateral (
    select
      coalesce(sum(public.valor_a_cobrar(p.valor)) filter (where p.devedor = auth.uid()), 0) as deve,
      coalesce(sum(public.valor_a_cobrar(p.valor)) filter (where p.credor = auth.uid()), 0) as devem
    from public.pendencias_internas(g.id) p
  ) s
  order by m.arquivado, g.criado_em desc
$$;

-- ---------------------------------------------------------------
-- Comentários no gasto
-- ---------------------------------------------------------------

create table public.comentarios (
  id bigint generated always as identity primary key,
  gasto_id uuid not null references public.gastos(id) on delete cascade,
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  usuario_id uuid references public.perfis(id) on delete set null,
  texto text not null check (char_length(texto) between 1 and 500),
  criado_em timestamptz not null default now()
);

create index comentarios_gasto on public.comentarios (gasto_id, criado_em);

alter table public.comentarios enable row level security;
create policy "membros veem comentários" on public.comentarios
  for select to authenticated using (public.eh_membro(grupo_id));
create policy "cada um apaga o seu comentário" on public.comentarios
  for delete to authenticated using (usuario_id = auth.uid());
revoke insert, update on public.comentarios from authenticated, anon;

create or replace function public.comentar(p_gasto uuid, p_texto text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gasto public.gastos%rowtype;
  v_id bigint;
  v_nome text;
  v_grupo text;
begin
  select * into v_gasto from public.gastos where id = p_gasto;
  if v_gasto.id is null or not public.eh_membro(v_gasto.grupo_id) then
    raise exception 'Gasto não encontrado';
  end if;
  if char_length(trim(coalesce(p_texto, ''))) = 0 then
    raise exception 'Escreva alguma coisa';
  end if;
  if (select count(*) from public.comentarios where usuario_id = auth.uid() and criado_em > now() - interval '1 minute') >= 10 then
    raise exception 'Muitos comentários seguidos. Espere um pouco.';
  end if;

  insert into public.comentarios (gasto_id, grupo_id, usuario_id, texto)
  values (p_gasto, v_gasto.grupo_id, auth.uid(), left(trim(p_texto), 500))
  returning id into v_id;

  -- avisa quem está no gasto (pagou ou divide), menos quem comentou
  select nome into v_nome from public.perfis where id = auth.uid();
  select nome into v_grupo from public.grupos where id = v_gasto.grupo_id;
  insert into public.avisos (usuario_id, grupo_id, tipo, titulo, corpo, dados)
  select distinct pessoas.u, v_gasto.grupo_id, 'comentario', v_grupo,
         coalesce(v_nome, 'Alguém') || ' comentou em "' || v_gasto.descricao || '": ' || left(trim(p_texto), 120),
         jsonb_build_object('gasto_id', p_gasto)
  from (
    select usuario_id as u from public.gasto_pagadores where gasto_id = p_gasto
    union select usuario_id from public.gasto_divisoes where gasto_id = p_gasto
    union select criado_por from public.gastos where id = p_gasto
  ) pessoas
  join public.membros m on m.grupo_id = v_gasto.grupo_id and m.usuario_id = pessoas.u and m.ativo
  where pessoas.u <> auth.uid();

  return v_id;
end;
$$;

-- ---------------------------------------------------------------
-- Exportar todos os meus dados (complementa a exclusão de conta, LGPD)
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
    'perfil', (select jsonb_build_object('id', p.id, 'nome', p.nome, 'criado_em', p.criado_em)
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

-- ---------------------------------------------------------------
-- Excluir a conta também apaga comentários e apelidos
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
  set nome = 'Conta excluída', email = null, push_token = null
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
-- Permissões das funções novas ou recriadas
-- ---------------------------------------------------------------

grant execute on function public.criar_recorrente(jsonb, text, uuid, boolean) to authenticated;
grant execute on function public.preencher_lancamento(uuid, jsonb) to authenticated;
grant execute on function public.buscar_gastos(uuid, text, uuid, date, text) to authenticated;
grant execute on function public.arquivar_grupo(uuid, boolean) to authenticated;
grant execute on function public.definir_apelido(uuid, text) to authenticated;
grant execute on function public.resumo_meus_grupos() to authenticated;
grant execute on function public.comentar(uuid, text) to authenticated;
grant execute on function public.meus_dados() to authenticated;
