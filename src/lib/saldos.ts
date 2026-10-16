import { Decimal, dec, EPS, valorACobrar } from './dinheiro';
import type { Divida, Gasto, Pagamento } from './tipos';

export type Pendencia = {
  chave: string;
  devedor: string;
  credor: string;
  valor: Decimal;
  cobrar: Decimal;
  gasto_id: string | null;
  descricao: string | null;
  data: string | null;
};

type InfoGasto = Pick<Gasto, 'id' | 'descricao' | 'data' | 'criado_em'>;

function pendencia(devedor: string, credor: string, valor: Decimal, gasto: InfoGasto | null): Pendencia {
  return {
    chave: gasto ? `${gasto.id}|${devedor}|${credor}` : `${devedor}|${credor}`,
    devedor,
    credor,
    valor,
    cobrar: valorACobrar(valor),
    gasto_id: gasto?.id ?? null,
    descricao: gasto?.descricao ?? null,
    data: gasto?.data ?? null,
  };
}

// Com abatimento: o que A deve a B e o que B deve a A se compensam, só entre os dois.
function comAbatimento(dividas: Divida[], pagamentos: Pagamento[]): Pendencia[] {
  const liquido = new Map<string, Decimal>();
  const somar = (de: string, para: string, valor: Decimal) => {
    const [a, b] = de < para ? [de, para] : [para, de];
    const chave = `${a}|${b}`;
    const sinal = de < para ? valor : valor.neg();
    liquido.set(chave, (liquido.get(chave) ?? new Decimal(0)).plus(sinal));
  };

  for (const d of dividas) somar(d.devedor, d.credor, dec(d.valor));
  for (const p of pagamentos) somar(p.de, p.para, dec(p.valor).neg());

  const lista: Pendencia[] = [];
  for (const [chave, valor] of liquido) {
    const [a, b] = chave.split('|');
    if (valor.gt(EPS)) lista.push(pendencia(a, b, valor, null));
    else if (valor.lt(EPS.neg())) lista.push(pendencia(b, a, valor.neg(), null));
  }
  return lista.sort((x, y) => y.valor.comparedTo(x.valor));
}

// Sem abatimento: cada gasto vira uma dívida separada, e nada se compensa.
function semAbatimento(dividas: Divida[], pagamentos: Pagamento[], gastos: InfoGasto[]): Pendencia[] {
  const infoGasto = new Map(gastos.map((g) => [g.id, g]));
  const porPar = new Map<string, { gasto: InfoGasto; restante: Decimal; devedor: string; credor: string }[]>();

  for (const d of dividas) {
    const gasto = infoGasto.get(d.gasto_id);
    if (!gasto) continue;
    const chave = `${d.devedor}|${d.credor}`;
    const lista = porPar.get(chave) ?? [];
    lista.push({ gasto, restante: dec(d.valor), devedor: d.devedor, credor: d.credor });
    porPar.set(chave, lista);
  }

  for (const lista of porPar.values()) {
    lista.sort((x, y) =>
      x.gasto.data === y.gasto.data
        ? x.gasto.criado_em.localeCompare(y.gasto.criado_em)
        : x.gasto.data.localeCompare(y.gasto.data),
    );
  }

  // pagamento ligado a um gasto quita aquele gasto; o que sobrar (ou pagamento sem gasto)
  // quita as dívidas mais antigas do mesmo par
  const sobra = new Map<string, Decimal>();
  for (const p of pagamentos) {
    const chave = `${p.de}|${p.para}`;
    let valor = dec(p.valor);
    const lista = porPar.get(chave);
    if (p.gasto_id && lista) {
      const alvo = lista.find((x) => x.gasto.id === p.gasto_id);
      if (alvo) {
        const usado = Decimal.min(alvo.restante, valor);
        alvo.restante = alvo.restante.minus(usado);
        valor = valor.minus(usado);
      }
    }
    if (valor.gt(EPS)) sobra.set(chave, (sobra.get(chave) ?? new Decimal(0)).plus(valor));
  }

  for (const [chave, valorSobra] of sobra) {
    let resto = valorSobra;
    for (const item of porPar.get(chave) ?? []) {
      if (resto.lte(EPS)) break;
      const usado = Decimal.min(item.restante, resto);
      item.restante = item.restante.minus(usado);
      resto = resto.minus(usado);
    }
  }

  const resultado: Pendencia[] = [];
  for (const lista of porPar.values()) {
    for (const item of lista) {
      if (item.restante.gt(EPS)) resultado.push(pendencia(item.devedor, item.credor, item.restante, item.gasto));
    }
  }
  return resultado.sort((x, y) => (y.data ?? '').localeCompare(x.data ?? ''));
}

export function calcularPendencias(
  abatimento: boolean,
  dividas: Divida[],
  pagamentos: Pagamento[],
  gastos: InfoGasto[],
): Pendencia[] {
  return abatimento ? comAbatimento(dividas, pagamentos) : semAbatimento(dividas, pagamentos, gastos);
}

export function resumoDoUsuario(pendencias: Pendencia[], eu: string) {
  let voceDeve = new Decimal(0);
  let teDevem = new Decimal(0);
  for (const p of pendencias) {
    if (p.devedor === eu) voceDeve = voceDeve.plus(p.cobrar);
    if (p.credor === eu) teDevem = teDevem.plus(p.cobrar);
  }
  return { voceDeve, teDevem };
}
