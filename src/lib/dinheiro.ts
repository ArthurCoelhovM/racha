import { Decimal } from 'decimal.js';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

// resíduos abaixo disso são tratados como zero
export const EPS = new Decimal('0.000000001');

export function dec(valor: Decimal.Value | null | undefined): Decimal {
  if (valor === null || valor === undefined || valor === '') return new Decimal(0);
  try {
    return new Decimal(valor);
  } catch {
    return new Decimal(0);
  }
}

// aceita "1.234,56", "1234,56", "1234.56" e "R$ 12"
export function lerValor(texto: string): Decimal | null {
  let limpo = texto.replace(/[R$\s]/g, '');
  if (!limpo) return null;
  if (limpo.includes(',')) {
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  } else if ((limpo.match(/\./g) || []).length > 1) {
    limpo = limpo.replace(/\./g, '');
  }
  if (!/^-?\d*\.?\d*$/.test(limpo) || limpo === '.' || limpo === '-') return null;
  try {
    return new Decimal(limpo);
  } catch {
    return null;
  }
}

export function ehZero(valor: Decimal): boolean {
  return valor.abs().lte(EPS);
}

// arredonda para cima no centavo, como no banco (valor_a_cobrar)
export function valorACobrar(valor: Decimal): Decimal {
  if (valor.lte(EPS)) return new Decimal(0);
  return valor.minus(EPS).times(100).ceil().div(100);
}

const formatador = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function reais(valor: Decimal.Value): string {
  const d = dec(valor);
  const texto = formatador.format(Number(d.toDecimalPlaces(2).toString()));
  return `R$ ${texto}`;
}

// "R$ 33,34" para cobrança (sempre para cima)
export function reaisCobrar(valor: Decimal.Value): string {
  return reais(valorACobrar(dec(valor)));
}

export function ehExato(valor: Decimal.Value): boolean {
  const d = dec(valor);
  return d.toDecimalPlaces(2).minus(d).abs().lte(EPS);
}

// texto para colocar de volta num campo
export function paraCampo(valor: Decimal.Value): string {
  return dec(valor).toDecimalPlaces(2).toFixed(2).replace('.', ',');
}

const formatadorExato = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

// valor exato para mostrar ao lado da cobrança: até 4 casas, com "…" se tiver mais
export function reaisExato(valor: Decimal.Value): string {
  const d = dec(valor);
  const curto = d.toDecimalPlaces(4, Decimal.ROUND_DOWN);
  return `R$ ${formatadorExato.format(Number(curto.toString()))}${curto.eq(d) ? '' : '…'}`;
}
