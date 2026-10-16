import { Decimal, lerValor, reais } from './dinheiro';
import type { Item, TipoDivisao } from './tipos';

export type Parte = { usuario_id: string; parametro: string | null; valor: Decimal };

export type EntradaDivisao = {
  selecionados: string[];
  valores: Record<string, string>;
  porcentagens: Record<string, string>;
  cotas: Record<string, string>;
  itens: Item[];
};

export type ResultadoDivisao = { partes: Parte[]; erro: string | null };

export type Pagador = { usuario_id: string; valor: Decimal };

const CASAS = 18;

function resultado(partes: Parte[], erro: string | null = null): ResultadoDivisao {
  return { partes, erro };
}

function temMaisDeDuasCasas(valor: Decimal) {
  return valor.decimalPlaces() > 2;
}

// trunca em 18 casas e soma o resíduo na primeira parte, para o total bater exatamente
function fechar(partes: Parte[], total: Decimal): Parte[] {
  const truncadas = partes.map((p) => ({ ...p, valor: p.valor.toDecimalPlaces(CASAS, Decimal.ROUND_DOWN) }));
  const soma = truncadas.reduce((s, p) => s.plus(p.valor), new Decimal(0));
  const resto = total.minus(soma);
  if (truncadas.length > 0 && !resto.isZero()) {
    truncadas[0] = { ...truncadas[0], valor: truncadas[0].valor.plus(resto) };
  }
  return truncadas;
}

export function totalDosItens(itens: Item[]): Decimal {
  return itens.reduce((soma, item) => soma.plus(lerValor(item.valor) ?? 0), new Decimal(0));
}

function porPeso(
  membros: string[],
  textos: Record<string, string>,
  total: Decimal,
  nome: string,
): { partes: Parte[]; soma: Decimal; erro: string | null } {
  const pesos: { u: string; p: Decimal }[] = [];
  for (const u of membros) {
    const texto = textos[u];
    if (!texto || !texto.trim()) continue;
    const p = lerValor(texto);
    if (p === null || p.lt(0)) return { partes: [], soma: new Decimal(0), erro: `${nome} inválida` };
    if (p.gt(0)) pesos.push({ u, p });
  }
  const soma = pesos.reduce((s, x) => s.plus(x.p), new Decimal(0));
  if (soma.isZero()) return { partes: [], soma, erro: null };
  const partes = pesos.map((x) => ({
    usuario_id: x.u,
    parametro: x.p.toString(),
    valor: total.times(x.p).div(soma),
  }));
  return { partes, soma, erro: null };
}

export function calcularDivisao(
  tipo: TipoDivisao,
  total: Decimal,
  membros: string[],
  entrada: EntradaDivisao,
): ResultadoDivisao {
  if (total.lte(0)) return resultado([], 'Informe o valor do gasto');

  if (tipo === 'igual') {
    const escolhidos = membros.filter((u) => entrada.selecionados.includes(u));
    if (escolhidos.length === 0) return resultado([], 'Escolha quem divide o gasto');
    const cada = total.div(escolhidos.length);
    return resultado(fechar(escolhidos.map((u) => ({ usuario_id: u, parametro: null, valor: cada })), total));
  }

  if (tipo === 'exato') {
    const partes: Parte[] = [];
    let soma = new Decimal(0);
    for (const u of membros) {
      const texto = entrada.valores[u];
      if (!texto || !texto.trim()) continue;
      const v = lerValor(texto);
      if (v === null || v.lt(0)) return resultado([], 'Tem um valor inválido');
      if (temMaisDeDuasCasas(v)) return resultado([], 'Use no máximo 2 casas decimais');
      if (v.gt(0)) partes.push({ usuario_id: u, parametro: v.toString(), valor: v });
      soma = soma.plus(v);
    }
    if (partes.length === 0) return resultado([], 'Informe quanto cada pessoa paga');
    const diferenca = total.minus(soma);
    if (diferenca.gt(0)) return resultado(partes, `Faltam ${reais(diferenca)} para fechar o total`);
    if (diferenca.lt(0)) return resultado(partes, `Passou ${reais(diferenca.abs())} do total`);
    return resultado(partes);
  }

  if (tipo === 'porcentagem') {
    const { partes, soma, erro } = porPeso(membros, entrada.porcentagens, total, 'Porcentagem');
    if (erro) return resultado([], erro);
    if (partes.length === 0) return resultado([], 'Informe a porcentagem de cada pessoa');
    if (!soma.eq(100)) {
      const falta = new Decimal(100).minus(soma);
      const texto = falta.gt(0) ? `Faltam ${falta.toString().replace('.', ',')}%` : `Passou ${falta.abs().toString().replace('.', ',')}%`;
      return resultado(partes, `${texto} para fechar 100%`);
    }
    return resultado(fechar(partes, total));
  }

  if (tipo === 'cotas') {
    const { partes, erro } = porPeso(membros, entrada.cotas, total, 'Cota');
    if (erro) return resultado([], erro);
    if (partes.length === 0) return resultado([], 'Dê pelo menos uma cota para alguém');
    return resultado(fechar(partes, total));
  }

  // por item: cada item é dividido igualmente entre quem participa dele
  if (entrada.itens.length === 0) return resultado([], 'Adicione os itens da compra');
  const acumulado = new Map<string, Decimal>();
  for (let i = 0; i < entrada.itens.length; i++) {
    const item = entrada.itens[i];
    const nome = item.descricao.trim() || `item ${i + 1}`;
    const v = lerValor(item.valor);
    if (v === null || v.lte(0)) return resultado([], `Informe o valor de ${nome}`);
    if (temMaisDeDuasCasas(v)) return resultado([], 'Use no máximo 2 casas decimais');
    const quem = item.participantes.filter((u) => membros.includes(u));
    if (quem.length === 0) return resultado([], `Escolha quem participa de ${nome}`);
    const cada = v.div(quem.length);
    for (const u of quem) acumulado.set(u, (acumulado.get(u) ?? new Decimal(0)).plus(cada));
  }
  const somaItens = totalDosItens(entrada.itens);
  if (!somaItens.eq(total)) {
    return resultado([], `Os itens somam ${reais(somaItens)}, mas o total é ${reais(total)}`);
  }
  const partes = membros
    .filter((u) => acumulado.has(u))
    .map((u) => ({ usuario_id: u, parametro: null, valor: acumulado.get(u)! }));
  return resultado(fechar(partes, total));
}

export function calcularPagadores(
  total: Decimal,
  pagadorUnico: string | null,
  valores: Record<string, string> | null,
): { pagadores: Pagador[]; erro: string | null } {
  if (total.lte(0)) return { pagadores: [], erro: 'Informe o valor do gasto' };

  if (valores === null) {
    if (!pagadorUnico) return { pagadores: [], erro: 'Escolha quem pagou' };
    return { pagadores: [{ usuario_id: pagadorUnico, valor: total }], erro: null };
  }

  const pagadores: Pagador[] = [];
  let soma = new Decimal(0);
  for (const [u, texto] of Object.entries(valores)) {
    if (!texto || !texto.trim()) continue;
    const v = lerValor(texto);
    if (v === null || v.lt(0)) return { pagadores: [], erro: 'Tem um valor pago inválido' };
    if (temMaisDeDuasCasas(v)) return { pagadores: [], erro: 'Use no máximo 2 casas decimais' };
    if (v.gt(0)) pagadores.push({ usuario_id: u, valor: v });
    soma = soma.plus(v);
  }
  if (pagadores.length === 0) return { pagadores, erro: 'Informe quanto cada pessoa pagou' };
  const diferenca = total.minus(soma);
  if (diferenca.gt(0)) return { pagadores, erro: `Os pagamentos ainda não cobrem ${reais(diferenca)}` };
  if (diferenca.lt(0)) return { pagadores, erro: `Os pagamentos passam ${reais(diferenca.abs())} do total` };
  return { pagadores, erro: null };
}
