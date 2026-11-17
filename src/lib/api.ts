import type { Nota } from './cupom';
import type { Decimal } from './dinheiro';
import type { Parte, Pagador } from './divisao';
import { lerPendencias, type Pendencia, type PendenciaBanco } from './saldos';
import type { Json } from './banco';
import { supabase } from './supabase';
import type {
  Aviso,
  Categoria,
  Comentario,
  Frequencia,
  Gasto,
  Grupo,
  Item,
  LancamentoPendente,
  Membro,
  Papel,
  PendenciaFora,
  Permissoes,
  Recorrente,
  RegistroHistorico,
  ResumoGrupo,
  TipoDivisao,
} from './tipos';

export function mensagemDeErro(erro: unknown): string {
  const texto =
    erro && typeof erro === 'object' && 'message' in erro
      ? String((erro as { message: unknown }).message)
      : String(erro);
  if (/Failed to fetch|Network request failed|NetworkError/i.test(texto)) {
    return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  }
  if (/permission denied|row-level security/i.test(texto)) return 'Você não tem permissão para fazer isso.';
  if (/JWT expired/i.test(texto)) return 'Sua sessão expirou. Entre de novo.';
  if (/multiple \(or no\) rows returned|0 rows/i.test(texto)) return 'Não encontrei isso. Talvez tenha sido excluído.';
  return texto;
}

function checar<T>(resposta: { data: T; error: unknown }): NonNullable<T> {
  if (resposta.error) throw new Error(mensagemDeErro(resposta.error));
  if (resposta.data === null || resposta.data === undefined) throw new Error('O servidor não devolveu nada.');
  return resposta.data;
}

// para funções que não devolvem nada (ou podem devolver vazio)
function semErro<T>(resposta: { data: T; error: unknown }): T {
  if (resposta.error) throw new Error(mensagemDeErro(resposta.error));
  return resposta.data;
}

// valores em numeric vão como texto para o banco, sem passar por float e sem perder casas
function numerico(valor: Decimal): number {
  return valor.toString() as unknown as number;
}

// o banco guarda tipo, papel e frequência como texto com check; aqui eles voltam a ser os tipos do app
type LinhaGrupo = Omit<Grupo, 'divisoes_permitidas' | 'permissoes'> & {
  divisoes_permitidas: string[];
  permissoes: Json;
};
function paraGrupo(g: LinhaGrupo): Grupo {
  return {
    ...g,
    divisoes_permitidas: g.divisoes_permitidas as TipoDivisao[],
    permissoes: g.permissoes as Permissoes,
  };
}

// prettier-ignore
const CAMPOS_GASTO = 'id, grupo_id, descricao, valor_total::text, data, tipo_divisao, itens, criado_por, criado_em, recorrente_id, categoria, comprovante, pagadores:gasto_pagadores(usuario_id, valor::text), divisoes:gasto_divisoes(usuario_id, parametro::text, valor::text), dividas(devedor, credor)';

type LinhaGasto = Omit<Gasto, 'tipo_divisao' | 'itens' | 'categoria'> & {
  tipo_divisao: string;
  itens: Json | null;
  categoria: string;
};
function paraGasto(g: LinhaGasto): Gasto {
  return {
    ...g,
    tipo_divisao: g.tipo_divisao as TipoDivisao,
    itens: g.itens as Item[] | null,
    categoria: g.categoria as Categoria,
  };
}

export async function listarMeusGrupos(): Promise<ResumoGrupo[]> {
  return checar(await supabase.rpc('resumo_meus_grupos'));
}

export const NAO_PARTICIPA = 'Você não participa mais deste grupo, ou ele não existe.';

// o banco e a busca do grupo dizem "não participa" de jeitos um pouco diferentes
export function ehForaDoGrupo(erro: string | null): boolean {
  return !!erro && /não participa/i.test(erro);
}

export async function buscarGrupo(id: string): Promise<Grupo> {
  const grupo = semErro(
    await supabase
      .from('grupos')
      .select('id, nome, cor, abatimento, divisoes_permitidas, lembrete_dias, criado_por, permissoes')
      .eq('id', id)
      .maybeSingle(),
  );
  if (!grupo) throw new Error(NAO_PARTICIPA);
  return paraGrupo(grupo);
}

export async function listarMembros(grupoId: string): Promise<Membro[]> {
  const dados = checar(
    await supabase
      .from('membros')
      .select('usuario_id, papel, ativo, apelido, perfil:perfis(id, nome)')
      .eq('grupo_id', grupoId)
      .order('entrou_em'),
  );
  // o apelido do grupo vale no lugar do nome em todas as telas do grupo
  return dados.map((m) => ({
    usuario_id: m.usuario_id,
    papel: m.papel as Papel,
    ativo: m.ativo,
    apelido: m.apelido,
    perfil: { id: m.usuario_id, nome: m.apelido || m.perfil?.nome || 'Alguém' },
  }));
}

// sem limite traz todos (para o CSV); a tela do grupo pede de 30 em 30
export async function listarGastos(grupoId: string, limite?: number): Promise<Gasto[]> {
  let consulta = supabase
    .from('gastos')
    .select(CAMPOS_GASTO)
    .eq('grupo_id', grupoId)
    .order('data', { ascending: false })
    .order('criado_em', { ascending: false });
  if (limite) consulta = consulta.limit(limite);
  return checar(await consulta).map((g) => paraGasto(g as LinhaGasto));
}

// uma página de gastos, a partir de uma posição (a tela do grupo pede de 30 em 30)
export async function paginaDeGastos(grupoId: string, inicio: number, quantos: number): Promise<Gasto[]> {
  const linhas = checar(
    await supabase
      .from('gastos')
      .select(CAMPOS_GASTO)
      .eq('grupo_id', grupoId)
      .order('data', { ascending: false })
      .order('criado_em', { ascending: false })
      .order('id')
      .range(inicio, inicio + quantos - 1),
  );
  return linhas.map((g) => paraGasto(g as LinhaGasto));
}

export async function contarGastos(grupoId: string): Promise<number> {
  const { count, error } = await supabase
    .from('gastos')
    .select('id', { count: 'exact', head: true })
    .eq('grupo_id', grupoId);
  if (error) throw new Error(mensagemDeErro(error));
  return count ?? 0;
}

// p_abatimento serve para simular o grupo com o abatimento trocado, sem mudar nada
export async function listarPendencias(grupoId: string, abatimento?: boolean): Promise<Pendencia[]> {
  const linhas = checar(
    await supabase.rpc('pendencias_do_grupo', {
      p_grupo: grupoId,
      ...(abatimento === undefined ? {} : { p_abatimento: abatimento }),
    }),
  );
  return lerPendencias(linhas as PendenciaBanco[]);
}

export async function buscarGasto(id: string): Promise<Gasto> {
  const linha = checar(await supabase.from('gastos').select(CAMPOS_GASTO).eq('id', id).single());
  return paraGasto(linha as LinhaGasto);
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
  );
}

export async function atualizarGrupo(id: string, g: NovoGrupo): Promise<void> {
  semErro(
    await supabase.rpc('atualizar_grupo', {
      p_grupo: id,
      p_nome: g.nome,
      p_cor: g.cor,
      p_abatimento: g.abatimento,
      p_divisoes: g.divisoes,
      p_lembrete_dias: g.lembreteDias,
    }),
  );
}

export async function definirPermissoes(grupoId: string, permissoes: Partial<Permissoes>): Promise<void> {
  semErro(await supabase.rpc('definir_permissoes', { p_grupo: grupoId, p_permissoes: permissoes as Json }));
}

export async function definirPapel(grupoId: string, usuarioId: string, papel: 'admin' | 'membro'): Promise<void> {
  semErro(await supabase.rpc('definir_papel', { p_grupo: grupoId, p_usuario: usuarioId, p_papel: papel }));
}

export async function passarDono(grupoId: string, usuarioId: string): Promise<void> {
  semErro(await supabase.rpc('passar_dono', { p_grupo: grupoId, p_usuario: usuarioId }));
}

export async function removerMembro(grupoId: string, usuarioId: string): Promise<void> {
  semErro(await supabase.rpc('remover_membro', { p_grupo: grupoId, p_usuario: usuarioId }));
}

export async function cobrar(grupoId: string, devedor: string): Promise<string> {
  return checar(await supabase.rpc('cobrar', { p_grupo: grupoId, p_devedor: devedor }));
}

export async function codigoDoGrupo(grupoId: string): Promise<string> {
  return checar(await supabase.rpc('codigo_do_grupo', { p_grupo: grupoId }));
}

export async function pendenciasDeGruposQueSai(): Promise<PendenciaFora[]> {
  return checar(await supabase.rpc('pendencias_de_grupos_que_sai')) as PendenciaFora[];
}

// tudo o que aconteceu com um gasto: criação, edições, exclusão e pagamentos ligados a ele
export async function historicoDoGasto(grupoId: string, gastoId: string): Promise<RegistroHistorico[]> {
  return checar(
    await supabase
      .from('historico')
      .select('id, usuario_id, entidade, acao, registro_id, antes, depois, criado_em')
      .eq('grupo_id', grupoId)
      .or(`registro_id.eq.${gastoId},depois->>gasto_id.eq.${gastoId},antes->>gasto_id.eq.${gastoId}`)
      .order('criado_em', { ascending: true })
      .limit(100),
  ) as RegistroHistorico[];
}

export async function entrarNoGrupo(codigo: string): Promise<string> {
  const grupo = semErro(await supabase.rpc('entrar_no_grupo', { p_codigo: codigo }));
  if (!grupo) throw new Error('Código de convite não encontrado. Confira as letras e os números.');
  return grupo;
}

export async function registrarDispositivo(
  plataforma: 'expo' | 'web',
  identificador: string,
  assinatura: unknown = null,
): Promise<void> {
  semErro(
    await supabase.rpc('registrar_dispositivo', {
      p_plataforma: plataforma,
      p_identificador: identificador,
      p_assinatura: assinatura as Json,
    }),
  );
}

export async function removerDispositivo(identificador: string): Promise<void> {
  semErro(await supabase.rpc('remover_dispositivo', { p_identificador: identificador }));
}

export async function excluirMinhaConta(): Promise<void> {
  const { error } = await supabase.functions.invoke('excluir-conta', { body: {} });
  if (error) throw new Error('Não deu para excluir a conta agora. Tente de novo em alguns minutos.');
  await supabase.auth.signOut();
}

export async function sairDoGrupo(grupoId: string): Promise<void> {
  semErro(await supabase.rpc('sair_do_grupo', { p_grupo: grupoId }));
}

export async function novoCodigoConvite(grupoId: string): Promise<string> {
  return checar(await supabase.rpc('novo_codigo_convite', { p_grupo: grupoId }));
}

export type GastoParaSalvar = {
  id?: string;
  grupoId: string;
  descricao: string;
  categoria: Categoria;
  comprovante: string | null;
  total: Decimal;
  data: string;
  tipo: TipoDivisao;
  itens: Item[] | null;
  pagadores: Pagador[];
  partes: Parte[];
};

function montarPayload(g: GastoParaSalvar): Json {
  return {
    id: g.id ?? null,
    grupo_id: g.grupoId,
    descricao: g.descricao,
    categoria: g.categoria,
    comprovante: g.comprovante,
    valor_total: g.total.toFixed(2),
    data: g.data,
    tipo_divisao: g.tipo,
    itens: g.itens as Json,
    pagadores: g.pagadores.map((p) => ({ usuario_id: p.usuario_id, valor: p.valor.toFixed(2) })),
    divisoes: g.partes.map((p) => ({ usuario_id: p.usuario_id, parametro: p.parametro, valor: p.valor.toString() })),
  };
}

export async function salvarGasto(g: GastoParaSalvar): Promise<string> {
  return checar(await supabase.rpc('salvar_gasto', { p: montarPayload(g) }));
}

export async function criarRecorrente(
  g: GastoParaSalvar,
  frequencia: Frequencia,
  primeiroGastoId: string,
  valorVariavel: boolean,
): Promise<string> {
  return checar(
    await supabase.rpc('criar_recorrente', {
      p: montarPayload({ ...g, id: undefined }),
      p_frequencia: frequencia,
      p_gasto: primeiroGastoId,
      p_valor_variavel: valorVariavel,
    }),
  );
}

export async function listarPendentes(grupoId: string): Promise<LancamentoPendente[]> {
  return checar(
    await supabase
      .from('lancamentos_pendentes')
      .select('id, recorrente_id, data, responsavel, recorrente:recorrentes(descricao, valor_total::text, modelo)')
      .eq('grupo_id', grupoId)
      .is('gasto_id', null)
      .order('data'),
  ) as LancamentoPendente[];
}

export async function preencherLancamento(pendenteId: string, g: GastoParaSalvar): Promise<string> {
  return checar(await supabase.rpc('preencher_lancamento', { p_pendente: pendenteId, p: montarPayload(g) }));
}

export type Filtros = { texto: string; pessoa: string | null; mes: string | null; categoria: Categoria | null };

export function temFiltro(f: Filtros) {
  return !!(f.texto.trim() || f.pessoa || f.mes || f.categoria);
}

export async function buscarGastos(grupoId: string, f: Filtros): Promise<Gasto[]> {
  const ids = checar(
    await supabase.rpc('buscar_gastos', {
      p_grupo: grupoId,
      p_texto: f.texto.trim() || undefined,
      p_pessoa: f.pessoa ?? undefined,
      p_mes: f.mes ?? undefined,
      p_categoria: f.categoria ?? undefined,
    }),
  );
  if (ids.length === 0) return [];
  const linhas = checar(
    await supabase
      .from('gastos')
      .select(CAMPOS_GASTO)
      .in('id', ids)
      .order('data', { ascending: false })
      .order('criado_em', { ascending: false }),
  );
  return linhas.map((g) => paraGasto(g as LinhaGasto));
}

export async function arquivarGrupo(grupoId: string, arquivar: boolean): Promise<void> {
  semErro(await supabase.rpc('arquivar_grupo', { p_grupo: grupoId, p_arquivar: arquivar }));
}

export async function definirApelido(grupoId: string, apelido: string): Promise<void> {
  semErro(await supabase.rpc('definir_apelido', { p_grupo: grupoId, p_apelido: apelido }));
}

export async function listarComentarios(gastoId: string): Promise<Comentario[]> {
  return checar(
    await supabase
      .from('comentarios')
      .select('id, usuario_id, texto, criado_em')
      .eq('gasto_id', gastoId)
      .order('criado_em'),
  );
}

export async function comentar(gastoId: string, texto: string): Promise<void> {
  semErro(await supabase.rpc('comentar', { p_gasto: gastoId, p_texto: texto }));
}

export async function apagarComentario(id: number): Promise<void> {
  semErro(await supabase.from('comentarios').delete().eq('id', id));
}

export async function meusDados(): Promise<unknown> {
  return checar(await supabase.rpc('meus_dados'));
}

// foto do comprovante: grupo/gasto-ou-novo/arquivo; o banco confere que o grupo é o mesmo
export async function enviarComprovante(grupoId: string, uri: string, tipo: string): Promise<string> {
  const extensao = tipo.includes('png') ? 'png' : tipo.includes('webp') ? 'webp' : 'jpg';
  const caminho = `${grupoId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensao}`;
  const corpo = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from('comprovantes').upload(caminho, corpo, { contentType: tipo });
  if (error) throw new Error('Não deu para enviar a foto. Tente de novo.');
  return caminho;
}

export async function urlDoComprovante(caminho: string): Promise<string> {
  const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(caminho, 60 * 60);
  if (error || !data) throw new Error('Não deu para abrir a foto do comprovante.');
  return data.signedUrl;
}

export async function pararRecorrente(id: string): Promise<void> {
  semErro(await supabase.rpc('parar_recorrente', { p_id: id }));
}

export async function lancarMeusRecorrentes(): Promise<number> {
  try {
    return semErro(await supabase.rpc('lancar_meus_recorrentes')) ?? 0;
  } catch {
    return 0;
  }
}

export async function listarRecorrentes(grupoId: string): Promise<Recorrente[]> {
  return checar(
    await supabase
      .from('recorrentes')
      .select('id, descricao, valor_total::text, frequencia, proxima_data, ativo, valor_variavel')
      .eq('grupo_id', grupoId)
      .eq('ativo', true)
      .order('proxima_data'),
  ) as (Omit<Recorrente, 'frequencia'> & { frequencia: string })[] as Recorrente[];
}

export async function listarAvisos(): Promise<Aviso[]> {
  return checar(
    await supabase
      .from('avisos')
      .select('id, grupo_id, tipo, titulo, corpo, dados, lido, criado_em')
      .order('criado_em', { ascending: false })
      .limit(60),
  ) as (Omit<Aviso, 'tipo' | 'dados'> & { tipo: string; dados: Json | null })[] as Aviso[];
}

export async function contarAvisosNaoLidos(): Promise<number> {
  const { count, error } = await supabase.from('avisos').select('id', { count: 'exact', head: true }).eq('lido', false);
  if (error) throw new Error(mensagemDeErro(error));
  return count ?? 0;
}

export async function marcarAvisosLidos(): Promise<void> {
  semErro(await supabase.from('avisos').update({ lido: true }).eq('lido', false));
}

export async function excluirGasto(id: string): Promise<void> {
  semErro(await supabase.rpc('excluir_gasto', { p_id: id }));
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
      p_valor: numerico(valor),
      p_gasto: gastoId ?? undefined,
    }),
  );
}

export async function desfazerPagamento(id: string): Promise<void> {
  semErro(await supabase.from('pagamentos').delete().eq('id', id));
}

export async function atualizarMeuNome(id: string, nome: string): Promise<void> {
  semErro(await supabase.from('perfis').update({ nome }).eq('id', id));
}

// o e-mail vem da sessão; no banco cada pessoa só lê id e nome
export async function buscarMeuPerfil(id: string) {
  return checar(await supabase.from('perfis').select('id, nome').eq('id', id).single());
}

export async function lerNotaFiscal(url: string): Promise<Nota> {
  const { data, error } = await supabase.functions.invoke('ler-nfce', { body: { url } });
  if (!error) return data as Nota;

  let mensagem = 'Não deu para consultar a nota agora. Tente de novo.';
  const resposta = (error as { context?: unknown }).context;
  if (resposta instanceof Response) {
    try {
      const corpo = await resposta.json();
      if (corpo && typeof corpo.erro === 'string') mensagem = corpo.erro;
    } catch {
      // resposta sem JSON: fica a mensagem padrão
    }
  } else if (/fetch|network/i.test(error.message)) {
    mensagem = 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  }
  throw new Error(mensagem);
}

// ---------------------------------------------------------------
// Conferir as contas
// ---------------------------------------------------------------

export type LinhaExtrato = {
  tipo: 'gasto' | 'pagamento';
  data: string;
  criado_em: string;
  gasto_id: string | null;
  descricao: string | null;
  valor_total: string;
  efeito: string;
};

// cada movimento entre você e outra pessoa; efeito > 0 quer dizer que você passou a dever mais
export async function extratoCom(grupoId: string, outro: string): Promise<LinhaExtrato[]> {
  const linhas = checar(await supabase.rpc('extrato_com', { p_grupo: grupoId, p_outro: outro }));
  return linhas.map((l) => ({
    ...l,
    tipo: l.tipo as LinhaExtrato['tipo'],
    valor_total: String(l.valor_total),
    efeito: String(l.efeito),
  }));
}

export type PontoParaOlhar = {
  tipo: 'nao_fecha' | 'duplicado' | 'futuro' | 'sem_valor' | 'pagamento_maior';
  gasto_id: string | null;
  descricao: string;
  data: string;
  detalhe: string;
};

export async function conferirGrupo(grupoId: string): Promise<PontoParaOlhar[]> {
  const linhas = checar(await supabase.rpc('conferir_grupo', { p_grupo: grupoId }));
  return linhas.map((l) => ({ ...l, tipo: l.tipo as PontoParaOlhar['tipo'] }));
}

// ---------------------------------------------------------------
// Pix e primeiros passos
// ---------------------------------------------------------------

export async function salvarChavePix(id: string, chave: string | null): Promise<void> {
  semErro(await supabase.from('perfis').update({ chave_pix: chave }).eq('id', id));
}

export async function minhaChavePix(id: string): Promise<string | null> {
  const linha = checar(await supabase.from('perfis').select('chave_pix').eq('id', id).single());
  return linha.chave_pix;
}

// a chave de quem vai receber; null se a pessoa ainda não cadastrou
export async function chavePixDe(usuarioId: string): Promise<{ nome: string; chave: string | null }> {
  const linha = checar(await supabase.from('perfis').select('nome, chave_pix').eq('id', usuarioId).maybeSingle());
  return { nome: linha.nome, chave: linha.chave_pix };
}

export type PrimeirosPassos = {
  tem_grupo: boolean;
  convidou: boolean;
  registrou_gasto: boolean;
  marcou_pagamento: boolean;
};

export async function primeirosPassos(): Promise<PrimeirosPassos> {
  return checar(await supabase.rpc('primeiros_passos')) as unknown as PrimeirosPassos;
}

// ---------------------------------------------------------------
// Gastos de todos os grupos (aba Gastos)
// ---------------------------------------------------------------

export type GastoComGrupo = Gasto & { grupo: { nome: string; cor: string } };

export async function paginaDeMeusGastos(inicio: number, quantos: number): Promise<GastoComGrupo[]> {
  const linhas = checar(
    await supabase
      .from('gastos')
      .select(`${CAMPOS_GASTO}, grupo:grupos(nome, cor)`)
      .order('data', { ascending: false })
      .order('criado_em', { ascending: false })
      .order('id')
      .range(inicio, inicio + quantos - 1),
  );
  return linhas.map((g) => ({
    ...paraGasto(g as unknown as LinhaGasto),
    grupo: (g as unknown as { grupo: { nome: string; cor: string } | null }).grupo ?? { nome: 'Grupo', cor: '#6B6E85' },
  }));
}

// nomes de todo mundo que divide algum grupo com você
export async function nomesConhecidos(): Promise<Map<string, string>> {
  const linhas = checar(await supabase.from('perfis').select('id, nome'));
  return new Map(linhas.map((p) => [p.id, p.nome || 'Alguém']));
}
