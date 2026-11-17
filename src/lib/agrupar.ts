import { dec, Decimal } from './dinheiro';
import { normalizar } from './graficos';
import type { Gasto } from './tipos';

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function diaUtc(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(a, m - 1, d) / 86_400_000;
}

// "Hoje", "Ontem", "Esta semana" (segunda a domingo), depois o mês
export function tituloDaData(data: string, hoje: string): string {
  const dias = diaUtc(hoje) - diaUtc(data);
  if (dias < 0) return 'Datas futuras';
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Ontem';
  const diaDaSemana = (new Date(diaUtc(hoje) * 86_400_000).getUTCDay() + 6) % 7; // segunda = 0
  if (dias <= diaDaSemana) return 'Esta semana';
  const mes = MESES[Number(data.slice(5, 7)) - 1];
  return data.slice(0, 4) === hoje.slice(0, 4) ? mes : `${mes} de ${data.slice(0, 4)}`;
}

export type GrupoDeDatas<T> = { titulo: string; total: Decimal; itens: T[] };

// junta gastos já ordenados por data (do mais novo ao mais velho) em blocos com subtotal
export function agruparPorData<T extends Pick<Gasto, 'data' | 'valor_total'>>(
  gastos: T[],
  hoje: string,
): GrupoDeDatas<T>[] {
  const blocos: GrupoDeDatas<T>[] = [];
  for (const g of gastos) {
    const titulo = tituloDaData(g.data, hoje);
    let bloco = blocos.find((b) => b.titulo === titulo);
    if (!bloco) {
      bloco = { titulo, total: new Decimal(0), itens: [] };
      blocos.push(bloco);
    }
    bloco.itens.push(g);
    bloco.total = bloco.total.plus(dec(g.valor_total));
  }
  return blocos;
}

// descrições usadas antes no grupo que começam (ou têm uma palavra que começa) com o texto digitado;
// cada uma traz o gasto mais recente com aquele nome, para copiar categoria, quem pagou e a divisão
export function sugestoesDeDescricao(gastos: Gasto[], texto: string, maximo = 3): Gasto[] {
  const busca = normalizar(texto);
  if (busca.length < 2) return [];
  const vistos = new Map<string, { gasto: Gasto; vezes: number; comeca: boolean }>();
  for (const g of gastos) {
    const chave = normalizar(g.descricao);
    if (!chave || chave === busca) continue;
    const comeca = chave.startsWith(busca);
    if (!comeca && !chave.split(' ').some((p) => p.startsWith(busca))) continue;
    const atual = vistos.get(chave);
    if (!atual) vistos.set(chave, { gasto: g, vezes: 1, comeca });
    else {
      atual.vezes += 1;
      if (g.data > atual.gasto.data) atual.gasto = g;
    }
  }
  return [...vistos.values()]
    .sort(
      (a, b) => Number(b.comeca) - Number(a.comeca) || b.vezes - a.vezes || b.gasto.data.localeCompare(a.gasto.data),
    )
    .slice(0, maximo)
    .map((v) => v.gasto);
}
