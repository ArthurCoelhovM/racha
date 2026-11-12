/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Decimal, lerValor, mascaraDinheiro, paraCampo, reais, valorACobrar } from '../src/lib/dinheiro';
import { calcularDivisao, calcularPagadores, type EntradaDivisao } from '../src/lib/divisao';
import { lerPendencias, resumoDoUsuario, saldoDaPessoa } from '../src/lib/saldos';

const vazio: EntradaDivisao = { selecionados: [], valores: {}, porcentagens: {}, cotas: {}, itens: [] };
const soma = (partes: { valor: Decimal }[]) => partes.reduce((s, p) => s.plus(p.valor), new Decimal(0));

test('lê valores no formato brasileiro', () => {
  assert.equal(lerValor('1.234,56')!.toString(), '1234.56');
  assert.equal(lerValor('R$ 12,5')!.toString(), '12.5');
  assert.equal(lerValor('99.90')!.toString(), '99.9');
  assert.equal(lerValor('abc'), null);
  assert.equal(lerValor(''), null);
});

test('"1.500" é mil e quinhentos, não um e cinquenta', () => {
  assert.equal(lerValor('1.500')!.toString(), '1500');
  assert.equal(lerValor('12.500')!.toString(), '12500');
  assert.equal(lerValor('1.234.567')!.toString(), '1234567');
  assert.equal(lerValor('0.500')!.toString(), '0.5');
  assert.equal(lerValor('12.5')!.toString(), '12.5');
  assert.equal(lerValor('1.50')!.toString(), '1.5');
});

test('máscara de moeda: só dígitos, com os centavos à direita', () => {
  assert.equal(mascaraDinheiro('150000'), '1.500,00');
  assert.equal(mascaraDinheiro('1'), '0,01');
  assert.equal(mascaraDinheiro('R$ 1.500,00'), '1.500,00');
  assert.equal(mascaraDinheiro('1.500,0'), '150,00');
  assert.equal(mascaraDinheiro('000'), '');
  assert.equal(mascaraDinheiro(''), '');
  assert.equal(mascaraDinheiro('99999999999999'), '9.999.999.999,99');
  assert.equal(lerValor(mascaraDinheiro('150000'))!.toString(), '1500');
  assert.equal(paraCampo('1500'), '1.500,00');
  assert.equal(lerValor(paraCampo('33.3'))!.toString(), '33.3');
});

test('cobrança arredonda para cima e ignora resíduos', () => {
  assert.equal(valorACobrar(new Decimal('33.333333333333333333')).toString(), '33.34');
  assert.equal(valorACobrar(new Decimal('20.000000000000000001')).toString(), '20');
  assert.equal(valorACobrar(new Decimal('0.0000000001')).toString(), '0');
  assert.equal(reais(new Decimal('1234.5')), 'R$ 1.234,50');
});

test('divisão igual em centavos: o centavo que sobra fica com quem pagou', () => {
  const r = calcularDivisao('igual', new Decimal(100), ['a', 'b', 'c'], { ...vazio, selecionados: ['a', 'b', 'c'] }, [
    'b',
  ]);
  assert.equal(r.erro, null);
  assert.deepEqual(
    r.partes.map((p) => p.valor.toString()),
    ['33.33', '33.34', '33.33'],
  );
  assert.ok(soma(r.partes).eq(100));
});

test('sem pagador entre os que dividem, os centavos vão na ordem', () => {
  const r = calcularDivisao('igual', new Decimal('0.05'), ['a', 'b', 'c'], { ...vazio, selecionados: ['a', 'b', 'c'] });
  assert.deepEqual(
    r.partes.map((p) => p.valor.toString()),
    ['0.02', '0.02', '0.01'],
  );
});

test('cotas e porcentagens também fecham em centavos', () => {
  const r = calcularDivisao(
    'cotas',
    new Decimal('100.01'),
    ['a', 'b', 'c'],
    { ...vazio, cotas: { a: '1', b: '1', c: '2' } },
    ['c'],
  );
  assert.deepEqual(
    r.partes.map((p) => p.valor.toString()),
    ['25', '25', '50.01'],
  );
  const p = calcularDivisao('porcentagem', new Decimal(10), ['a', 'b', 'c'], {
    ...vazio,
    porcentagens: { a: '33,33', b: '33,33', c: '33,34' },
  });
  assert.ok(soma(p.partes).eq(10));
  assert.ok(p.partes.every((x) => x.valor.decimalPlaces() <= 2));
});

test('valor exato avisa quanto falta', () => {
  const r = calcularDivisao('exato', new Decimal(100), ['a', 'b'], { ...vazio, valores: { a: '60', b: '30' } });
  assert.equal(r.erro, 'Faltam R$ 10,00 para fechar o total');
  const ok = calcularDivisao('exato', new Decimal(100), ['a', 'b'], { ...vazio, valores: { a: '60', b: '40' } });
  assert.equal(ok.erro, null);
});

test('porcentagem precisa fechar 100%', () => {
  const r = calcularDivisao('porcentagem', new Decimal(200), ['a', 'b'], {
    ...vazio,
    porcentagens: { a: '70', b: '20' },
  });
  assert.match(r.erro!, /Faltam 10%/);
  const ok = calcularDivisao('porcentagem', new Decimal(200), ['a', 'b'], {
    ...vazio,
    porcentagens: { a: '70', b: '30' },
  });
  assert.equal(ok.erro, null);
  assert.equal(ok.partes[0].valor.toString(), '140');
});

test('cotas dividem proporcionalmente', () => {
  const r = calcularDivisao('cotas', new Decimal(90), ['a', 'b', 'c'], { ...vazio, cotas: { a: '2', b: '1', c: '0' } });
  assert.equal(r.erro, null);
  assert.equal(r.partes.length, 2);
  assert.equal(r.partes[0].valor.toString(), '60');
  assert.equal(r.partes[1].valor.toString(), '30');
});

test('por item soma o que cada um consumiu', () => {
  const itens = [
    { descricao: 'Cerveja', valor: '30', participantes: ['a', 'b'] },
    { descricao: 'Refri', valor: '10', participantes: ['c'] },
  ];
  const quebrado = calcularDivisao(
    'itens',
    new Decimal(10),
    ['a', 'b', 'c'],
    { ...vazio, itens: [{ descricao: 'Pão', valor: '10', participantes: ['a', 'b', 'c'] }] },
    ['c'],
  );
  assert.deepEqual(
    quebrado.partes.map((p) => p.valor.toString()),
    ['3.33', '3.33', '3.34'],
  );
  const r = calcularDivisao('itens', new Decimal(40), ['a', 'b', 'c'], { ...vazio, itens });
  assert.equal(r.erro, null);
  assert.deepEqual(
    r.partes.map((p) => [p.usuario_id, p.valor.toString()]),
    [
      ['a', '15'],
      ['b', '15'],
      ['c', '10'],
    ],
  );
});

test('vários pagadores precisam somar o total', () => {
  assert.equal(
    calcularPagadores(new Decimal(90), null, { a: '60', b: '20' }).erro,
    'Os pagamentos ainda não cobrem R$ 10,00',
  );
  assert.equal(calcularPagadores(new Decimal(90), null, { a: '60', b: '30' }).erro, null);
  assert.equal(calcularPagadores(new Decimal(90), 'a', null).pagadores[0].valor.toString(), '90');
});

// as pendências são calculadas no banco (testes em supabase/testes); aqui só a leitura e os totais
test('pendências do banco viram valores exatos e de cobrança', () => {
  const lista = lerPendencias([
    {
      devedor: 'B',
      credor: 'A',
      gasto_id: null,
      descricao: null,
      data: null,
      valor: '33.333333333333333333',
      cobrar: '33.34',
    },
    { devedor: 'A', credor: 'C', gasto_id: 'g1', descricao: 'Luz', data: '2026-10-01', valor: '10', cobrar: '10.00' },
  ]);
  assert.equal(lista[0].valor.toString(), '33.333333333333333333');
  assert.equal(lista[0].chave, 'B|A');
  assert.equal(lista[1].chave, 'g1|A|C');
  const { voceDeve, teDevem } = resumoDoUsuario(lista, 'A');
  assert.equal(voceDeve.toString(), '10');
  assert.equal(teDevem.toString(), '33.34');
  assert.equal(saldoDaPessoa(lista, 'A').toString(), '23.34');
  assert.equal(saldoDaPessoa(lista, 'B').toString(), '-33.34');
});

test('próxima data do recorrente segue a mesma regra do banco', async () => {
  const { proximaOcorrencia } = await import('../src/lib/formatos');
  assert.equal(proximaOcorrencia('2026-01-31', 'mensal', 31), '2026-02-28');
  assert.equal(proximaOcorrencia('2026-02-28', 'mensal', 31), '2026-03-31');
  assert.equal(proximaOcorrencia('2028-01-31', 'mensal', 31), '2028-02-29');
  assert.equal(proximaOcorrencia('2026-12-15', 'mensal', 15), '2027-01-15');
  assert.equal(proximaOcorrencia('2026-12-28', 'semanal', 28), '2027-01-04');
});
