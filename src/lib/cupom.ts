import type { ItemNota, Nota } from '../../supabase/functions/_shared/nfce';
import { Decimal, paraCampo } from './dinheiro';
import type { Item } from './tipos';

export type { Nota };
export { validarUrlNfce } from '../../supabase/functions/_shared/nfce';

// a tela do leitor entrega a nota ao formulário de gasto que está aberto por baixo dela
let notaLida: Nota | null = null;
let ouvinte: ((nota: Nota) => void) | null = null;

export function guardarNota(nota: Nota) {
  if (ouvinte) ouvinte(nota);
  else notaLida = nota;
}

export function ouvirNota(aoReceber: (nota: Nota) => void): () => void {
  ouvinte = aoReceber;
  if (notaLida) {
    const pendente = notaLida;
    notaLida = null;
    aoReceber(pendente);
  }
  return () => {
    if (ouvinte === aoReceber) ouvinte = null;
  };
}

function quantidadeLegivel(i: ItemNota): string | null {
  if (i.quantidade === null || i.quantidade === 1) return null;
  const numero = String(i.quantidade).replace('.', ',');
  const unidade = (i.unidade ?? '').toLowerCase();
  return unidade && unidade !== 'un' ? `${numero} ${unidade}` : `${numero}x`;
}

export function nomeDoItem(i: ItemNota): string {
  const quantidade = quantidadeLegivel(i);
  return quantidade ? `${i.descricao} (${quantidade})` : i.descricao;
}

// Transforma a nota em itens para a divisão "Por item".
// Desconto (ou acréscimo) da nota é distribuído entre os itens na proporção do valor de cada um,
// para a soma bater exatamente com o valor pago.
export function itensDaNota(nota: Nota, membros: string[]): { itens: Item[]; total: Decimal } {
  const pago = new Decimal(nota.valorPago);
  const originais = nota.itens.map((i) => new Decimal(i.valor));
  const soma = originais.reduce((s, v) => s.plus(v), new Decimal(0));

  let valores = originais;
  if (!soma.isZero() && !soma.eq(pago)) {
    valores = originais.map((v) => v.times(pago).div(soma).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
    const resto = pago.minus(valores.reduce((s, v) => s.plus(v), new Decimal(0)));
    let maior = 0;
    valores.forEach((v, k) => {
      if (v.gt(valores[maior])) maior = k;
    });
    valores[maior] = valores[maior].plus(resto);
  }

  const itens = nota.itens
    .map((i, k) => ({ descricao: nomeDoItem(i), valor: valores[k], participantes: membros }))
    .filter((i) => i.valor.gt(0))
    .map((i) => ({ ...i, valor: paraCampo(i.valor) }));

  return { itens, total: valores.filter((v) => v.gt(0)).reduce((s, v) => s.plus(v), new Decimal(0)) };
}
