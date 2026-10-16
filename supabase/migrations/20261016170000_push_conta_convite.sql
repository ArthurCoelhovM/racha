-- Notificações push, exclusão de conta e limite de tentativas no convite

-- ---------------------------------------------------------------
-- Aparelhos que recebem push
-- ---------------------------------------------------------------

-- plataforma "expo": token do Expo (Android). "web": assinatura Web Push (iPhone e navegadores)
create table public.dispositivos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis (id) on delete cascade,
  plataforma text not null check (plataforma in ('expo', 'web')),
  identificador text not null,
  assinatura jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (plataforma, identificador)
);
create index dispositivos_usuario on public.dispositivos (usuario_id);

-- se outra pessoa entrar no mesmo aparelho, o aparelho passa a ser dela
create or replace function public.registrar_dispositivo(p_plataforma text, p_identificador text, p_assinatura jsonb default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Faça login para ativar as notificações';
  end if;
  if p_plataforma not in ('expo', 'web') or coalesce(length(p_identificador), 0) not between 10 and 2000 then
    raise exception 'Aparelho inválido';
  end if;
  if p_plataforma = 'web' and (p_assinatura -> 'keys' ->> 'p256dh' is null or p_assinatura -> 'keys' ->> 'auth' is null) then
    raise exception 'Assinatura de notificação incompleta';
  end if;

  insert into public.dispositivos (usuario_id, plataforma, identificador, assinatura)
  values (auth.uid(), p_plataforma, p_identificador, p_assinatura)
  on conflict (plataforma, identificador) do update
    set usuario_id = excluded.usuario_id, assinatura = excluded.assinatura, atualizado_em = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.remover_dispositivo(p_identificador text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.dispositivos where identificador = p_identificador and usuario_id = auth.uid()
$$;

alter table public.dispositivos enable row level security;

create policy "cada um vê os seus aparelhos" on public.dispositivos
  for select to authenticated
  using (usuario_id = auth.uid());

revoke all on public.dispositivos from anon, authenticated;
grant select on public.dispositivos to authenticated;

-- ---------------------------------------------------------------
-- Exclusão de conta: o histórico do grupo continua, mas sem os dados da pessoa
-- ---------------------------------------------------------------

create or replace function public.anonimizar_conta(p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.perfis
  set nome = 'Conta excluída', email = null, push_token = null
  where id = p_usuario;

  delete from public.dispositivos where usuario_id = p_usuario;
  delete from public.avisos where usuario_id = p_usuario;
  update public.membros set ativo = false where usuario_id = p_usuario;
  update public.recorrentes set ativo = false where criado_por = p_usuario;
end;
$$;

-- ---------------------------------------------------------------
-- Limite de tentativas de código de convite
-- ---------------------------------------------------------------

create table public.tentativas_convite (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfis (id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index tentativas_convite_usuario on public.tentativas_convite (usuario_id, criado_em desc);
alter table public.tentativas_convite enable row level security;
revoke all on public.tentativas_convite from anon, authenticated;

-- devolve null quando o código não existe (sem erro, para a tentativa ficar registrada)
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

  if (
    select count(*) from public.tentativas_convite
    where usuario_id = auth.uid() and criado_em > now() - interval '15 minutes'
  ) >= 8 then
    raise exception 'Muitas tentativas com código errado. Espere 15 minutos e tente de novo.';
  end if;

  select id into v_grupo
  from public.grupos
  where codigo_convite = upper(regexp_replace(p_codigo, '[^A-Za-z0-9]', '', 'g'));

  if v_grupo is null then
    insert into public.tentativas_convite (usuario_id) values (auth.uid());
    return null;
  end if;

  insert into public.membros (grupo_id, usuario_id)
  values (v_grupo, auth.uid())
  on conflict (grupo_id, usuario_id) do update set ativo = true
  where not public.membros.ativo;

  return v_grupo;
end;
$$;

-- ---------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------

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
grant execute on function public.registrar_dispositivo(text, text, jsonb) to authenticated;
grant execute on function public.remover_dispositivo(text) to authenticated;

-- usada só pela Edge Function de exclusão de conta
grant execute on function public.anonimizar_conta(uuid) to service_role;
