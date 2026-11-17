-- Desfazer, metas por categoria, busca em todos os grupos e menos dados guardados

-- ---------------------------------------------------------------
-- Só e-mail (no login), senha (no login) e nome: a cópia do e-mail no perfil sai
-- ---------------------------------------------------------------

create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)));
  return new;
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
  set nome = 'Conta excluída', push_token = null, chave_pix = null
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

alter table public.perfis drop column email;

-- ---------------------------------------------------------------
-- Desfazer: quem removeu alguém pode trazer de volta logo depois
-- ---------------------------------------------------------------

alter table public.membros
  -- sem chave estrangeira: um segundo vínculo com perfis quebraria o "perfil:perfis(...)" dos apps já instalados
  add column removido_por uuid,
  add column removido_em timestamptz;

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

  update public.membros set ativo = false, papel = 'membro', removido_por = auth.uid(), removido_em = now()
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

create or replace function public.readmitir_membro(p_grupo uuid, p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pode(p_grupo, 'remover_membros') then
    raise exception 'Você não tem permissão para isso neste grupo';
  end if;
  update public.membros
  set ativo = true, removido_por = null, removido_em = null
  where grupo_id = p_grupo and usuario_id = p_usuario and not ativo
    and removido_em > now() - interval '10 minutes';
  if not found then
    raise exception 'Não dá mais para desfazer: convide a pessoa de novo';
  end if;
  delete from public.avisos
  where usuario_id = p_usuario and grupo_id = p_grupo and tipo = 'membro'
    and dados ->> 'removido' = 'true' and criado_em > now() - interval '10 minutes';
end;
$$;

-- desfazer o "parar" de um gasto que se repete
create or replace function public.retomar_recorrente(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.recorrentes r
  set ativo = true
  where r.id = p_id and public.eh_membro(r.grupo_id) and not r.ativo;
  if not found then
    raise exception 'Gasto recorrente não encontrado';
  end if;
end;
$$;

-- ---------------------------------------------------------------
-- Meta por categoria: quanto o grupo quer gastar por mês em cada uma
-- ---------------------------------------------------------------

alter table public.grupos add column metas jsonb not null default '{}'::jsonb;
grant select (metas) on public.grupos to authenticated;

create or replace function public.definir_metas(p_grupo uuid, p_metas jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chave text;
  v_valor jsonb;
begin
  if not public.pode(p_grupo, 'mudar_configuracoes') then
    raise exception 'Você não tem permissão para mudar as configurações deste grupo';
  end if;
  if jsonb_typeof(p_metas) <> 'object' then
    raise exception 'Metas inválidas';
  end if;
  for v_chave, v_valor in select * from jsonb_each(p_metas) loop
    if v_chave not in ('mercado', 'casa', 'contas', 'transporte', 'restaurante', 'lazer', 'saude', 'outros') then
      raise exception 'Categoria inválida: %', v_chave;
    end if;
    if jsonb_typeof(v_valor) <> 'number' or (v_valor #>> '{}')::numeric <= 0
       or (v_valor #>> '{}')::numeric > 10000000 then
      raise exception 'Meta inválida para %', v_chave;
    end if;
  end loop;
  update public.grupos set metas = p_metas where id = p_grupo;
end;
$$;

-- ---------------------------------------------------------------
-- Busca em todos os seus grupos (aba Gastos)
-- ---------------------------------------------------------------

create or replace function public.buscar_em_todos(p_texto text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.id
  from public.gastos g
  where public.eh_membro(g.grupo_id)
    and length(trim(coalesce(p_texto, ''))) >= 2
    and (g.descricao ilike '%' || p_texto || '%'
         or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(g.itens) = 'array' then g.itens else '[]' end) i
                    where i ->> 'descricao' ilike '%' || p_texto || '%'))
  order by g.data desc, g.criado_em desc
  limit 100
$$;

-- a busca do grupo também quebrava em gasto sem itens (itens = null em JSON) quando o nome não batia
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
         or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(g.itens) = 'array' then g.itens else '[]' end) i where i ->> 'descricao' ilike '%' || p_texto || '%'))
    and (p_pessoa is null
         or exists (select 1 from public.gasto_pagadores pp where pp.gasto_id = g.id and pp.usuario_id = p_pessoa)
         or exists (select 1 from public.gasto_divisoes dd where dd.gasto_id = g.id and dd.usuario_id = p_pessoa))
    and (p_mes is null or (g.data >= date_trunc('month', p_mes)::date
                           and g.data < (date_trunc('month', p_mes) + interval '1 month')::date))
    and (p_categoria is null or g.categoria = p_categoria)
  order by g.data desc, g.criado_em desc
  limit 300
$$;

grant execute on function public.readmitir_membro(uuid, uuid) to authenticated;
grant execute on function public.retomar_recorrente(uuid) to authenticated;
grant execute on function public.definir_metas(uuid, jsonb) to authenticated;
grant execute on function public.buscar_em_todos(text) to authenticated;
