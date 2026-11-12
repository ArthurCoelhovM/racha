-- Botão "Cobrar": quem tem a receber manda um aviso na hora para quem deve

alter table public.avisos drop constraint if exists avisos_tipo_check;
alter table public.avisos add constraint avisos_tipo_check check (
  tipo in ('gasto_novo', 'gasto_editado', 'gasto_excluido', 'pagamento', 'membro', 'grupo', 'lembrete',
           'recorrente_parado', 'cobranca')
);

create or replace function public.cobrar(p_grupo uuid, p_devedor uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric;
  v_grupo text;
  v_nome text;
begin
  if not public.eh_membro(p_grupo) then
    raise exception 'Você não participa deste grupo';
  end if;

  select coalesce(sum(x.valor), 0) into v_total
  from public.pendencias_internas(p_grupo) x
  where x.devedor = p_devedor and x.credor = auth.uid();

  if v_total <= 0 then
    raise exception 'Essa pessoa não te deve nada neste grupo';
  end if;

  -- uma cobrança por pessoa a cada 12 horas, para não virar spam
  if exists (
    select 1 from public.avisos
    where usuario_id = p_devedor and grupo_id = p_grupo and tipo = 'cobranca'
      and dados ->> 'de' = auth.uid()::text and criado_em > now() - interval '12 hours'
  ) then
    raise exception 'Você já cobrou essa pessoa há pouco. Dá para cobrar de novo daqui a 12 horas.';
  end if;

  select nome into v_grupo from public.grupos where id = p_grupo;
  select nome into v_nome from public.perfis where id = auth.uid();

  insert into public.avisos (usuario_id, grupo_id, tipo, titulo, corpo, dados)
  values (
    p_devedor, p_grupo, 'cobranca', v_grupo,
    coalesce(v_nome, 'Alguém') || ' pediu para você acertar ' || public.reais(v_total) || '.',
    jsonb_build_object('de', auth.uid(), 'valor', v_total)
  );

  return public.reais(v_total);
end;
$$;

grant execute on function public.cobrar(uuid, uuid) to authenticated;
