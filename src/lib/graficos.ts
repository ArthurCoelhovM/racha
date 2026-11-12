import { dec, Decimal } from './dinheiro';
import { CATEGORIAS, type Categoria, type Gasto } from './tipos';

// "2026-11" de uma data "2026-11-12"
export const mesDe = (data: string) => data.slice(0, 7);

// os últimos `quantos` meses terminando em `ate` ("2026-11"), do mais antigo para o mais novo
export function mesesAte(ate: string, quantos: number): string[] {
  const [ano, mes] = ate.split('-').map(Number);
  return Array.from({ length: quantos }, (_, i) => {
    const d = new Date(Date.UTC(ano, mes - 1 - (quantos - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const nomeDoMes = (mes: string) => NOMES[Number(mes.slice(5, 7)) - 1];

function somar(gastos: Gasto[]): Decimal {
  return gastos.reduce((s, g) => s.plus(dec(g.valor_total)), new Decimal(0));
}

// 1. gasto por mês, separado por categoria (barras empilhadas)
export function totaisPorMes(gastos: Gasto[], meses: string[]) {
  return meses.map((mes) => {
    const doMes = gastos.filter((g) => mesDe(g.data) === mes);
    const porCategoria = CATEGORIAS.map((c) => ({
      categoria: c.categoria,
      total: somar(doMes.filter((g) => g.categoria === c.categoria)),
    })).filter((x) => x.total.gt(0));
    return { mes, total: somar(doMes), porCategoria };
  });
}

// 2. contas fixas ao longo do ano: cada conta (luz, água...) é uma linha
export function normalizar(texto: string): string {
  return texto
    .replace(/\(.*?\)/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function contasFixas(gastos: Gasto[], meses: string[], maximo = 4) {
  const fixas = gastos.filter((g) => g.categoria === 'contas' || g.recorrente_id);
  const grupos = new Map<string, { nome: string; gastos: Gasto[] }>();
  for (const g of fixas) {
    const chave = normalizar(g.descricao);
    const atual = grupos.get(chave) ?? { nome: g.descricao.trim(), gastos: [] };
    atual.gastos.push(g);
    grupos.set(chave, atual);
  }
  return [...grupos.values()]
    .sort((a, b) => b.gastos.length - a.gastos.length)
    .slice(0, maximo)
    .map((c) => ({
      nome: c.nome,
      valores: meses.map((mes) => {
        const doMes = c.gastos.filter((g) => mesDe(g.data) === mes);
        return doMes.length ? somar(doMes) : null;
      }),
    }));
}

// 3. quem pagou o quê no mês: quanto cada um adiantou e qual era a parte dele
export function quemPagou(gastos: Gasto[]) {
  const pessoas = new Map<string, { pago: Decimal; parte: Decimal }>();
  const de = (u: string) => {
    const atual = pessoas.get(u) ?? { pago: new Decimal(0), parte: new Decimal(0) };
    pessoas.set(u, atual);
    return atual;
  };
  for (const g of gastos) {
    for (const p of g.pagadores) de(p.usuario_id).pago = de(p.usuario_id).pago.plus(dec(p.valor));
    for (const d of g.divisoes) de(d.usuario_id).parte = de(d.usuario_id).parte.plus(dec(d.valor));
  }
  return [...pessoas].map(([usuario_id, v]) => ({ usuario_id, ...v })).sort((a, b) => b.pago.comparedTo(a.pago));
}

// 4. categorias do mês, com a porcentagem do total
export function categoriasDoMes(gastos: Gasto[]) {
  const total = somar(gastos);
  return CATEGORIAS.map((c) => {
    const valor = somar(gastos.filter((g) => g.categoria === c.categoria));
    return {
      categoria: c.categoria as Categoria,
      total: valor,
      porcento: total.isZero() ? 0 : Number(valor.div(total).times(100).toFixed(1)),
    };
  })
    .filter((x) => x.total.gt(0))
    .sort((a, b) => b.total.comparedTo(a.total));
}

// 7. este mês contra a média dos três anteriores
export function comparacao(gastos: Gasto[], mes: string) {
  const [, ...anteriores] = mesesAte(mes, 4).reverse();
  const atual = somar(gastos.filter((g) => mesDe(g.data) === mes));
  const comDados = anteriores.filter((m) => gastos.some((g) => mesDe(g.data) === m));
  const media = comDados.length
    ? comDados
        .reduce((s, m) => s.plus(somar(gastos.filter((g) => mesDe(g.data) === m))), new Decimal(0))
        .div(comDados.length)
    : null;
  const variacao = media && media.gt(0) ? Number(atual.minus(media).div(media).times(100).toFixed(0)) : null;
  return { atual, media, variacao, mesesNaMedia: comDados.length };
}

// itens dos cupons e da divisão por item, cada um com a data do gasto
function itensComData(gastos: Gasto[]) {
  return gastos.flatMap((g) =>
    (g.itens ?? [])
      .filter((i) => i.descricao?.trim() && dec(i.valor).gt(0))
      .map((i) => ({
        chave: normalizar(i.descricao),
        nome: i.descricao.replace(/\(.*?\)/g, '').trim(),
        valor: dec(i.valor),
        data: g.data,
      })),
  );
}

// 5. itens mais comprados: quantas vezes, quanto somam e o preço médio
export function itensMaisComprados(gastos: Gasto[], maximo = 10) {
  const mapa = new Map<string, { nome: string; vezes: number; total: Decimal }>();
  for (const i of itensComData(gastos)) {
    const atual = mapa.get(i.chave) ?? { nome: i.nome, vezes: 0, total: new Decimal(0) };
    atual.vezes += 1;
    atual.total = atual.total.plus(i.valor);
    mapa.set(i.chave, atual);
  }
  return [...mapa]
    .map(([chave, v]) => ({ chave, ...v, medio: v.total.div(v.vezes).toDecimalPlaces(2) }))
    .sort((a, b) => b.total.comparedTo(a.total) || b.vezes - a.vezes)
    .slice(0, maximo);
}

// 6. preço de um item em cada compra
export function precoDoItem(gastos: Gasto[], chave: string) {
  return itensComData(gastos)
    .filter((i) => i.chave === chave)
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((i) => ({ data: i.data, valor: i.valor }));
}
