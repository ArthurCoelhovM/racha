import type { Decimal } from './dinheiro';
import type { Parte, Pagador } from './divisao';
import { supabase } from './supabase';
import type {
  Divida,
  Gasto,
  Grupo,
  Item,
  Membro,
  Pagamento,
  RegistroHistorico,
  ResumoGrupo,
  TipoDivisao,
} from './tipos';

export function mensagemDeErro(erro: unknown): string {
  const texto =
    erro && typeof erro === 'object' && 'message' in erro ? String((erro as { message: unknown }).message) : String(erro);
  if (/Failed to fetch|Network request failed|NetworkError/i.test(texto)) {
    return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  }
  if (/permission denied|row-level security/i.test(texto)) return 'Você não tem permissão para fazer isso.';
  if (/JWT expired/i.test(texto)) return 'Sua sessão expirou. Entre de novo.';
  return texto;
}

function checar<T>(resposta: { data: T; error: unknown }): T {
  if (resposta.error) throw new Error(mensagemDeErro(resposta.error));
  return resposta.data;
}

export async function listarMeusGrupos(): Promise<ResumoGrupo[]> {
  return checar(await supabase.rpc('resumo_meus_grupos')) as ResumoGrupo[];
}

export async function buscarGrupo(id: string): Promise<Grupo> {
  return checar(await supabase.from('grupos').select('*').eq('id', id).single()) as Grupo;
}

export async function listarMembros(grupoId: string): Promise<Membro[]> {
  const dados = checar(
    await supabase
      .from('membros')
      .select('usuario_id, papel, ativo, perfil:perfis(id, nome, email)')
      .eq('grupo_id', grupoId)
      .order('entrou_em'),
  ) as unknown as Membro[];
  return dados.map((m) => ({ ...m, perfil: m.perfil ?? { id: m.usuario_id, nome: 'Alguém', email: null } }));
}

export async function listarGastos(grupoId: string): Promise<Gasto[]> {
  return checar(
    await supabase
      .from('gastos')
      .select(
        'id, grupo_id, descricao, valor_total::text, data, tipo_divisao, itens, criado_por, criado_em, ' +
          'pagadores:gasto_pagadores(usuario_id, valor::text), ' +
          'divisoes:gasto_divisoes(usuario_id, parametro::text, valor::text)',
      )
      .eq('grupo_id', grupoId)
      .order('data', { ascending: false })
      .order('criado_em', { ascending: false }),
  ) as unknown as Gasto[];
}

export async function buscarGasto(id: string): Promise<Gasto> {
  return checar(
    await supabase
      .from('gastos')
      .select(
        'id, grupo_id, descricao, valor_total::text, data, tipo_divisao, itens, criado_por, criado_em, ' +
          'pagadores:gasto_pagadores(usuario_id, valor::text), ' +
          'divisoes:gasto_divisoes(usuario_id, parametro::text, valor::text)',
      )
      .eq('id', id)
      .single(),
  ) as unknown as Gasto;
}

export async function listarDividas(grupoId: string): Promise<Divida[]> {
  return checar(
    await supabase.from('dividas').select('id, gasto_id, devedor, credor, valor::text').eq('grupo_id', grupoId),
  ) as unknown as Divida[];
}

export async function listarPagamentos(grupoId: string): Promise<Pagamento[]> {
  return checar(
    await supabase
      .from('pagamentos')
      .select('id, de, para, valor::text, valor_cobrado::text, gasto_id, marcado_por, criado_em')
      .eq('grupo_id', grupoId)
      .order('criado_em', { ascending: false }),
  ) as unknown as Pagamento[];
}

export async function listarHistorico(grupoId: string): Promise<RegistroHistorico[]> {
  return checar(
    await supabase
      .from('historico')
      .select('id, usuario_id, entidade, acao, registro_id, antes, depois, criado_em')
      .eq('grupo_id', grupoId)
      .order('criado_em', { ascending: false })
      .limit(80),
  ) as RegistroHistorico[];
}

export type NovoGrupo = {
  nome: string;
  cor: string;
  abatimento: boolean;
  divisoes: TipoDivisao[];
  lembreteDias: number;
};

export async function criarGrupo(g: NovoGrupo): Promise<string> {
  return checar(
    await supabase.rpc('criar_grupo', {
      p_nome: g.nome,
      p_cor: g.cor,
      p_abatimento: g.abatimento,
      p_divisoes: g.divisoes,
      p_lembrete_dias: g.lembreteDias,
    }),
  ) as string;
}

export async function atualizarGrupo(id: string, g: NovoGrupo): Promise<void> {
  checar(
    await supabase
      .from('grupos')
      .update({
        nome: g.nome,
        cor: g.cor,
        abatimento: g.abatimento,
        divisoes_permitidas: g.divisoes,
        lembrete_dias: g.lembreteDias,
      })
      .eq('id', id),
  );
}

export async function entrarNoGrupo(codigo: string): Promise<string> {
  return checar(await supabase.rpc('entrar_no_grupo', { p_codigo: codigo })) as string;
}

export async function sairDoGrupo(grupoId: string): Promise<void> {
  checar(await supabase.rpc('sair_do_grupo', { p_grupo: grupoId }));
}

export async function novoCodigoConvite(grupoId: string): Promise<string> {
  return checar(await supabase.rpc('novo_codigo_convite', { p_grupo: grupoId })) as string;
}

export type GastoParaSalvar = {
  id?: string;
  grupoId: string;
  descricao: string;
  total: Decimal;
  data: string;
  tipo: TipoDivisao;
  itens: Item[] | null;
  pagadores: Pagador[];
  partes: Parte[];
};

export async function salvarGasto(g: GastoParaSalvar): Promise<string> {
  const payload = {
    id: g.id ?? null,
    grupo_id: g.grupoId,
    descricao: g.descricao,
    valor_total: g.total.toFixed(2),
    data: g.data,
    tipo_divisao: g.tipo,
    itens: g.itens,
    pagadores: g.pagadores.map((p) => ({ usuario_id: p.usuario_id, valor: p.valor.toFixed(2) })),
    divisoes: g.partes.map((p) => ({ usuario_id: p.usuario_id, parametro: p.parametro, valor: p.valor.toString() })),
  };
  return checar(await supabase.rpc('salvar_gasto', { p: payload })) as string;
}

export async function excluirGasto(id: string): Promise<void> {
  checar(await supabase.from('gastos').delete().eq('id', id));
}

export async function marcarPago(
  grupoId: string,
  de: string,
  para: string,
  valor: Decimal,
  gastoId: string | null,
): Promise<string> {
  return checar(
    await supabase.rpc('marcar_pago', {
      p_grupo: grupoId,
      p_de: de,
      p_para: para,
      p_valor: valor.toString(),
      p_gasto: gastoId,
    }),
  ) as string;
}

export async function desfazerPagamento(id: string): Promise<void> {
  checar(await supabase.from('pagamentos').delete().eq('id', id));
}

export async function atualizarMeuNome(id: string, nome: string): Promise<void> {
  checar(await supabase.from('perfis').update({ nome }).eq('id', id));
}

export async function buscarMeuPerfil(id: string) {
  return checar(await supabase.from('perfis').select('id, nome, email').eq('id', id).single()) as {
    id: string;
    nome: string;
    email: string | null;
  };
}
