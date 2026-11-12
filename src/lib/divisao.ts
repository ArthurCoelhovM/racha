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

function resultado(partes: Parte[], erro: string | null = null): ResultadoDivisao {
  return { partes, erro };
}

function temMaisDeDuasCasas(valor: Decimal) {
  return valor.decimalPlaces() > 2;
}

// Reparte em centavos: cada um fica com o piso da parte exata, e os centavos que sobram vão
// primeiro para quem pagou (na ordem de `preferidos`) e depois para a maior fração.
// É a mesma regra do banco (partes_em_centavos): as partes somam o total exato.
export function emCentavos(partes: Parte[], total: Decimal, preferidos: string[] = []): Parte[] {
  const pisos = partes.map((p, ordem) => {
    const piso = p.valor.toDecimalPlaces(2, Decimal.ROUND_DOWN);
    const preferencia = preferidos.indexOf(p.usuario_id);
    return { p, piso, fracao: p.valor.minus(piso), ordem, preferencia: preferencia < 0 ? Infinity : preferencia };
  });
  const soma = pisos.reduce((s, x) => s.plus(x.piso), new Decimal(0));
  let centavos = Math.max(0, total.toDecimalPlaces(2).minus(soma).times(100).round().toNumber());
  const fila = [...pisos].sort(
    (x, y) => x.preferencia - y.preferencia || y.fracao.comparedTo(x.fracao) || x.ordem - y.ordem,
  );
  const extra = new Set<number>();
  for (const x of fila) {
    if (centavos <= 0) break;
    extra.add(x.ordem);
    centavos--;
  }
  return pisos.map((x) => ({ ...x.p, valor: extra.has(x.ordem) ? x.piso.plus('0.01') : x.piso }));
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

// preferidos: quem pagou, de quem pagou mais para quem pagou menos (fica com os centavos que sobram)
export function calcularDivisao(
  tipo: TipoDivisao,
  total: Decimal,
  membros: string[],
  entrada: EntradaDivisao,
  preferidos: string[] = [],
): ResultadoDivisao {
  const fechar = (partes: Parte[], valor: Decimal) => emCentavos(partes, valor, preferidos);
  if (total.lte(0)) return resultado([], 'Informe o valor do gasto');

  if (tipo === 'igual') {
    const escolhidos = membros.filter((u) => entrada.selecionados.includes(u));
    if (escolhidos.length === 0) return resultado([], 'Escolha quem divide o gasto');
    const cada = total.div(escolhidos.length);
    return resultado(
      fechar(
        escolhidos.map((u) => ({ usuario_id: u, parametro: null, valor: cada })),
        total,
      ),
    );
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
      const texto = falta.gt(0)
        ? `Faltam ${falta.toString().replace('.', ',')}%`
        : `Passou ${falta.abs().toString().replace('.', ',')}%`;
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

  // por item: cada item é dividido igualmente entre quem participa dele, já em centavos
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
    // a ordem gira a cada item, para o centavo que sobra não cair sempre na mesma pessoa
    const girados = quem.map((_, k) => quem[(k + i) % quem.length]);
    const doItem = fechar(
      girados.map((u) => ({ usuario_id: u, parametro: null, valor: cada })),
      v,
    );
    for (const parte of doItem) {
      acumulado.set(parte.usuario_id, (acumulado.get(parte.usuario_id) ?? new Decimal(0)).plus(parte.valor));
    }
  }
  const somaItens = totalDosItens(entrada.itens);
  if (!somaItens.eq(total)) {
    return resultado([], `Os itens somam ${reais(somaItens)}, mas o total é ${reais(total)}`);
  }
  const partes = membros
    .filter((u) => acumulado.has(u))
    .map((u) => ({ usuario_id: u, parametro: null, valor: acumulado.get(u)! }));
  return resultado(partes);
}

// quem pagou, do maior valor para o menor: é quem fica com o centavo que sobra
export function ordemDosPagadores(pagadores: Pagador[]): string[] {
  return [...pagadores].sort((a, b) => b.valor.comparedTo(a.valor)).map((p) => p.usuario_id);
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
