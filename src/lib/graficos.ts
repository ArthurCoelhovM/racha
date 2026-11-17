import { dec, Decimal } from './dinheiro';
import { CATEGORIAS, type Categoria, type Gasto, type LancamentoPendente, type Recorrente } from './tipos';

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
        loja: g.descricao.trim(),
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

// 8. mercado: preço médio do item em cada loja (a loja é o nome do gasto, que vem do cupom), do mais barato ao mais caro
export function precoPorLoja(gastos: Gasto[], chave: string) {
  const lojas = new Map<string, { loja: string; total: Decimal; vezes: number; ultima: string }>();
  for (const i of itensComData(gastos)) {
    if (i.chave !== chave) continue;
    const k = normalizar(i.loja);
    const atual = lojas.get(k) ?? { loja: i.loja, total: new Decimal(0), vezes: 0, ultima: i.data };
    atual.total = atual.total.plus(i.valor);
    atual.vezes += 1;
    if (i.data > atual.ultima) atual.ultima = i.data;
    lojas.set(k, atual);
  }
  return [...lojas.values()]
    .map((l) => ({ loja: l.loja, vezes: l.vezes, ultima: l.ultima, medio: l.total.div(l.vezes).toDecimalPlaces(2) }))
    .sort((a, b) => a.medio.comparedTo(b.medio) || b.vezes - a.vezes);
}

function proximaData(data: string, frequencia: Recorrente['frequencia']): string {
  const [a, m, d] = data.split('-').map(Number);
  if (frequencia === 'semanal') return new Date(Date.UTC(a, m - 1, d + 7)).toISOString().slice(0, 10);
  const ultimoDia = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m, Math.min(d, ultimoDia))).toISOString().slice(0, 10);
}

// 9. previsão do mês: o que já foi gasto mais o que ainda vem dos gastos que se repetem
export function previsaoDoMes(
  gastos: Gasto[],
  recorrentes: Recorrente[],
  pendentes: LancamentoPendente[],
  mes: string,
) {
  const gasto = somar(gastos.filter((g) => mesDe(g.data) === mes));
  const porVir: { descricao: string; data: string; valor: Decimal }[] = [];
  for (const r of recorrentes) {
    if (!r.ativo) continue;
    let data = r.proxima_data;
    for (let i = 0; i < 6 && mesDe(data) <= mes; i++) {
      if (mesDe(data) === mes) porVir.push({ descricao: r.descricao, data, valor: dec(r.valor_total) });
      data = proximaData(data, r.frequencia);
    }
  }
  // contas de valor variável esperando o valor: entra o valor da última vez
  for (const p of pendentes) {
    if (mesDe(p.data) === mes && p.recorrente)
      porVir.push({ descricao: p.recorrente.descricao, data: p.data, valor: dec(p.recorrente.valor_total) });
  }
  porVir.sort((a, b) => a.data.localeCompare(b.data));
  const previsto = porVir.reduce((s, p) => s.plus(p.valor), new Decimal(0));
  return { gasto, previsto, total: gasto.plus(previsto), porVir };
}

// 10. meta por categoria: quanto já foi do que o grupo quer gastar no mês
export function metasDoMes(gastos: Gasto[], metas: Partial<Record<Categoria, number>>) {
  return CATEGORIAS.filter((c) => (metas[c.categoria] ?? 0) > 0).map((c) => {
    const meta = new Decimal(metas[c.categoria]!);
    const gasto = somar(gastos.filter((g) => g.categoria === c.categoria));
    return { categoria: c.categoria, meta, gasto, porcento: Number(gasto.div(meta).times(100).toFixed(0)) };
  });
}

// 11. quanto custa morar na casa: a parte de cada pessoa, mês a mês
export function custoPorPessoa(gastos: Gasto[], meses: string[]) {
  const pessoas = new Map<string, Decimal[]>();
  for (const g of gastos) {
    const i = meses.indexOf(mesDe(g.data));
    if (i < 0) continue;
    for (const d of g.divisoes) {
      const lista = pessoas.get(d.usuario_id) ?? meses.map(() => new Decimal(0));
      lista[i] = lista[i].plus(dec(d.valor));
      pessoas.set(d.usuario_id, lista);
    }
  }
  return [...pessoas]
    .map(([usuario_id, valores]) => ({
      usuario_id,
      valores,
      total: valores.reduce((s, v) => s.plus(v), new Decimal(0)),
    }))
    .sort((a, b) => b.total.comparedTo(a.total));
}

// 12. calendário: quanto saiu em cada dia do mês
export function gastoPorDia(gastos: Gasto[], mes: string) {
  const [a, m] = mes.split('-').map(Number);
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const valores = Array.from({ length: dias }, () => new Decimal(0));
  for (const g of gastos) {
    if (mesDe(g.data) !== mes) continue;
    const d = Number(g.data.slice(8, 10)) - 1;
    valores[d] = valores[d].plus(dec(g.valor_total));
  }
  // dia da semana do dia 1, com segunda = 0
  const primeiro = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7;
  return { valores, primeiro };
}
