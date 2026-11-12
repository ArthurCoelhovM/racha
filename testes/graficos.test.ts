/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  categoriasDoMes,
  comparacao,
  contasFixas,
  itensMaisComprados,
  mesesAte,
  precoDoItem,
  quemPagou,
  totaisPorMes,
} from '../src/lib/graficos';
import type { Categoria, Gasto, Item } from '../src/lib/tipos';

function gasto(data: string, valor: string, categoria: Categoria, extra: Partial<Gasto> = {}): Gasto {
  return {
    id: `${data}-${valor}`,
    grupo_id: 'g',
    descricao: extra.descricao ?? categoria,
    valor_total: valor,
    data,
    tipo_divisao: 'igual',
    itens: null,
    criado_por: 'a',
    criado_em: data,
    recorrente_id: null,
    categoria,
    comprovante: null,
    pagadores: [{ usuario_id: 'a', valor }],
    divisoes: [
      { usuario_id: 'a', parametro: null, valor: String(Number(valor) / 2) },
      { usuario_id: 'b', parametro: null, valor: String(Number(valor) / 2) },
    ],
    dividas: [],
    ...extra,
  };
}

const item = (descricao: string, valor: string): Item => ({ descricao, valor, participantes: ['a', 'b'] });

const gastos = [
  gasto('2026-08-10', '300', 'mercado'),
  gasto('2026-09-10', '200', 'mercado'),
  gasto('2026-10-10', '100', 'mercado'),
  gasto('2026-11-02', '150', 'contas', { descricao: 'Luz' }),
  gasto('2026-10-02', '120', 'contas', { descricao: 'luz ' }),
  gasto('2026-11-05', '450', 'mercado', {
    itens: [item('Café (2 un)', '30.00'), item('Pão', '12.50')],
  }),
  gasto('2026-10-20', '60', 'mercado', { itens: [item('CAFÉ', '28.00')] }),
];

test('meses até um mês, do mais antigo ao mais novo', () => {
  assert.deepEqual(mesesAte('2026-02', 3), ['2025-12', '2026-01', '2026-02']);
});

test('total por mês separado por categoria', () => {
  const [out, nov] = totaisPorMes(gastos, ['2026-10', '2026-11']);
  assert.equal(out.total.toString(), '280');
  assert.deepEqual(
    nov.porCategoria.map((c) => [c.categoria, c.total.toString()]),
    [
      ['mercado', '450'],
      ['contas', '150'],
    ],
  );
});

test('contas fixas juntam a mesma conta escrita de jeitos diferentes', () => {
  const [luz] = contasFixas(gastos, ['2026-09', '2026-10', '2026-11']);
  assert.equal(luz.nome, 'Luz');
  assert.deepEqual(
    luz.valores.map((v) => v?.toString() ?? null),
    [null, '120', '150'],
  );
});

test('quem pagou e qual era a parte', () => {
  const [a, b] = quemPagou(gastos.filter((g) => g.data.startsWith('2026-11')));
  assert.equal(a.usuario_id, 'a');
  assert.equal(a.pago.toString(), '600');
  assert.equal(b.parte.toString(), '300');
});

test('categorias com porcentagem', () => {
  const lista = categoriasDoMes(gastos.filter((g) => g.data.startsWith('2026-11')));
  assert.deepEqual(
    lista.map((c) => [c.categoria, c.porcento]),
    [
      ['mercado', 75],
      ['contas', 25],
    ],
  );
});

test('este mês contra a média dos três anteriores', () => {
  const r = comparacao(gastos, '2026-11');
  assert.equal(r.atual.toString(), '600');
  assert.equal(r.media!.toFixed(2), '260.00');
  assert.equal(r.variacao, 131);
  assert.equal(r.mesesNaMedia, 3);
});

test('itens mais comprados e preço ao longo do tempo', () => {
  const [cafe] = itensMaisComprados(gastos);
  assert.equal(cafe.chave, 'cafe');
  assert.equal(cafe.vezes, 2);
  assert.equal(cafe.medio.toString(), '29');
  assert.deepEqual(
    precoDoItem(gastos, 'cafe').map((p) => [p.data, p.valor.toString()]),
    [
      ['2026-10-20', '28'],
      ['2026-11-05', '30'],
    ],
  );
});
