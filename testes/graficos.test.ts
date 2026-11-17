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

test('previsão do mês soma o que vem dos recorrentes e das contas sem valor', async () => {
  const { previsaoDoMes } = await import('../src/lib/graficos');
  const recorrentes = [
    {
      id: 'r1',
      descricao: 'Internet',
      valor_total: '100.00',
      frequencia: 'mensal',
      proxima_data: '2026-11-20',
      ativo: true,
      valor_variavel: false,
    },
    {
      id: 'r2',
      descricao: 'Faxina',
      valor_total: '50.00',
      frequencia: 'semanal',
      proxima_data: '2026-11-10',
      ativo: true,
      valor_variavel: false,
    },
    {
      id: 'r3',
      descricao: 'Parado',
      valor_total: '999.00',
      frequencia: 'mensal',
      proxima_data: '2026-11-25',
      ativo: false,
      valor_variavel: false,
    },
    {
      id: 'r4',
      descricao: 'Aluguel',
      valor_total: '1500.00',
      frequencia: 'mensal',
      proxima_data: '2026-12-05',
      ativo: true,
      valor_variavel: false,
    },
  ] as const;
  const pendentes = [
    {
      id: 'p',
      recorrente_id: 'r9',
      data: '2026-11-03',
      responsavel: 'a',
      recorrente: { descricao: 'Luz', valor_total: '180.00', modelo: {} },
    },
  ];
  const p = previsaoDoMes([gasto('2026-11-02', '30', 'mercado')], [...recorrentes], pendentes, '2026-11');
  assert.equal(p.gasto.toString(), '30');
  // internet 100 + faxina 10/11, 17/11, 24/11 (150) + luz 180
  assert.equal(p.previsto.toString(), '430');
  assert.equal(p.total.toString(), '460');
  assert.deepEqual(
    p.porVir.map((x) => x.descricao),
    ['Luz', 'Faxina', 'Faxina', 'Internet', 'Faxina'],
  );
});

test('metas, custo por pessoa, calendário e preço por loja', async () => {
  const { metasDoMes, custoPorPessoa, gastoPorDia, precoPorLoja } = await import('../src/lib/graficos');
  const doMes = [
    gasto('2026-11-02', '480', 'mercado'),
    gasto('2026-11-02', '20', 'mercado'),
    gasto('2026-11-30', '90', 'contas'),
  ];
  const metas = metasDoMes(doMes, { mercado: 600, lazer: 100 });
  assert.deepEqual(
    metas.map((m) => [m.categoria, m.gasto.toString(), m.porcento]),
    [
      ['mercado', '500', 83],
      ['lazer', '0', 0],
    ],
  );

  const comPartes = (data: string, partes: [string, string][]) =>
    gasto(data, '0', 'casa', { divisoes: partes.map(([u, v]) => ({ usuario_id: u, parametro: null, valor: v })) });
  const custo = custoPorPessoa(
    [
      comPartes('2026-10-05', [
        ['ana', '30'],
        ['bia', '10'],
      ]),
      comPartes('2026-11-05', [['ana', '5']]),
    ],
    ['2026-10', '2026-11'],
  );
  assert.deepEqual(
    custo.map((c) => [c.usuario_id, c.valores.map(String)]),
    [
      ['ana', ['30', '5']],
      ['bia', ['10', '0']],
    ],
  );

  const cal = gastoPorDia(doMes, '2026-11');
  assert.equal(cal.valores.length, 30);
  assert.equal(cal.valores[1].toString(), '500');
  assert.equal(cal.valores[29].toString(), '90');
  assert.equal(cal.primeiro, 6, '1º de novembro de 2026 é domingo');

  const compra = (data: string, loja: string, preco: string) =>
    gasto(data, preco, 'mercado', {
      descricao: loja,
      itens: [{ descricao: 'Café (500g)', valor: preco, participantes: [] }],
    });
  const lojas = precoPorLoja(
    [
      compra('2026-10-01', 'Zaffari', '30.00'),
      compra('2026-11-01', 'Zaffari', '32.00'),
      compra('2026-11-08', 'Asun', '27.90'),
    ],
    'cafe',
  );
  assert.deepEqual(
    lojas.map((l) => [l.loja, l.medio.toString(), l.vezes]),
    [
      ['Asun', '27.9', 1],
      ['Zaffari', '31', 2],
    ],
  );
});
