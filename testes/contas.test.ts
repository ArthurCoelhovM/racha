/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Decimal, lerValor, reais, valorACobrar } from '../src/lib/dinheiro';
import { calcularDivisao, calcularPagadores, type EntradaDivisao } from '../src/lib/divisao';
import { calcularPendencias, resumoDoUsuario } from '../src/lib/saldos';
import type { Divida, Pagamento } from '../src/lib/tipos';

const vazio: EntradaDivisao = { selecionados: [], valores: {}, porcentagens: {}, cotas: {}, itens: [] };
const soma = (partes: { valor: Decimal }[]) => partes.reduce((s, p) => s.plus(p.valor), new Decimal(0));

test('lê valores no formato brasileiro', () => {
  assert.equal(lerValor('1.234,56')!.toString(), '1234.56');
  assert.equal(lerValor('R$ 12,5')!.toString(), '12.5');
  assert.equal(lerValor('99.90')!.toString(), '99.9');
  assert.equal(lerValor('abc'), null);
  assert.equal(lerValor(''), null);
});

test('cobrança arredonda para cima e ignora resíduos', () => {
  assert.equal(valorACobrar(new Decimal('33.333333333333333333')).toString(), '33.34');
  assert.equal(valorACobrar(new Decimal('20.000000000000000001')).toString(), '20');
  assert.equal(valorACobrar(new Decimal('0.0000000001')).toString(), '0');
  assert.equal(reais(new Decimal('1234.5')), 'R$ 1.234,50');
});

test('divisão igual com dízima fecha o total exato', () => {
  const r = calcularDivisao('igual', new Decimal(100), ['a', 'b', 'c'], { ...vazio, selecionados: ['a', 'b', 'c'] });
  assert.equal(r.erro, null);
  assert.equal(r.partes.length, 3);
  assert.ok(soma(r.partes).eq(100));
  assert.equal(r.partes[1].valor.toString(), '33.333333333333333333');
});

test('valor exato avisa quanto falta', () => {
  const r = calcularDivisao('exato', new Decimal(100), ['a', 'b'], { ...vazio, valores: { a: '60', b: '30' } });
  assert.equal(r.erro, 'Faltam R$ 10,00 para fechar o total');
  const ok = calcularDivisao('exato', new Decimal(100), ['a', 'b'], { ...vazio, valores: { a: '60', b: '40' } });
  assert.equal(ok.erro, null);
});

test('porcentagem precisa fechar 100%', () => {
  const r = calcularDivisao('porcentagem', new Decimal(200), ['a', 'b'], { ...vazio, porcentagens: { a: '70', b: '20' } });
  assert.match(r.erro!, /Faltam 10%/);
  const ok = calcularDivisao('porcentagem', new Decimal(200), ['a', 'b'], { ...vazio, porcentagens: { a: '70', b: '30' } });
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
  const r = calcularDivisao('itens', new Decimal(40), ['a', 'b', 'c'], { ...vazio, itens });
  assert.equal(r.erro, null);
  assert.deepEqual(
    r.partes.map((p) => [p.usuario_id, p.valor.toString()]),
    [['a', '15'], ['b', '15'], ['c', '10']],
  );
});

test('vários pagadores precisam somar o total', () => {
  assert.equal(calcularPagadores(new Decimal(90), null, { a: '60', b: '20' }).erro, 'Os pagamentos ainda não cobrem R$ 10,00');
  assert.equal(calcularPagadores(new Decimal(90), null, { a: '60', b: '30' }).erro, null);
  assert.equal(calcularPagadores(new Decimal(90), 'a', null).pagadores[0].valor.toString(), '90');
});

const divida = (id: string, gasto: string, devedor: string, credor: string, valor: string): Divida => ({
  id, gasto_id: gasto, devedor, credor, valor,
});
const pagamento = (de: string, para: string, valor: string, gasto: string | null = null): Pagamento => ({
  id: `${de}${para}${valor}`, de, para, valor, valor_cobrado: valor, gasto_id: gasto, marcado_por: de, criado_em: '',
});
const gastos = [
  { id: 'g1', descricao: 'Luz', data: '2026-10-01', criado_em: '1' },
  { id: 'g2', descricao: 'Aluguel', data: '2026-10-05', criado_em: '2' },
  { id: 'g3', descricao: 'Lanche', data: '2026-10-06', criado_em: '3' },
];

test('com abatimento: A deve 50 a B, B deve 30 a A, então A paga 20 a B', () => {
  const lista = calcularPendencias(true, [divida('1', 'g1', 'A', 'B', '50'), divida('2', 'g2', 'B', 'A', '30')], [], gastos);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].devedor, 'A');
  assert.equal(lista[0].credor, 'B');
  assert.equal(lista[0].valor.toString(), '20');
});

test('com abatimento: nunca passa por terceiro', () => {
  const lista = calcularPendencias(
    true,
    [divida('1', 'g1', 'A', 'B', '50'), divida('2', 'g2', 'B', 'C', '50')],
    [],
    gastos,
  );
  assert.equal(lista.length, 2);
  assert.ok(lista.every((p) => !(p.devedor === 'A' && p.credor === 'C')));
});

test('sem abatimento: cada gasto é uma dívida separada', () => {
  const lista = calcularPendencias(false, [divida('1', 'g1', 'A', 'B', '50'), divida('2', 'g2', 'B', 'A', '30')], [], gastos);
  assert.equal(lista.length, 2);
  const resumo = resumoDoUsuario(lista, 'A');
  assert.equal(resumo.voceDeve.toString(), '50');
  assert.equal(resumo.teDevem.toString(), '30');
});

test('sem abatimento: pagamento quita o gasto certo e a sobra quita o mais antigo', () => {
  const dividas = [divida('1', 'g1', 'A', 'B', '50'), divida('2', 'g3', 'A', 'B', '20')];
  const quitouLanche = calcularPendencias(false, dividas, [pagamento('A', 'B', '20', 'g3')], gastos);
  assert.deepEqual(quitouLanche.map((p) => p.descricao), ['Luz']);

  const semGasto = calcularPendencias(false, dividas, [pagamento('A', 'B', '60')], gastos);
  assert.equal(semGasto.length, 1);
  assert.equal(semGasto[0].descricao, 'Lanche');
  assert.equal(semGasto[0].valor.toString(), '10');
});

test('dízima na dívida vira cobrança arredondada para cima', () => {
  const lista = calcularPendencias(true, [divida('1', 'g1', 'B', 'A', '33.333333333333333333')], [], gastos);
  assert.equal(lista[0].cobrar.toString(), '33.34');
  const quitado = calcularPendencias(
    true,
    [divida('1', 'g1', 'B', 'A', '33.333333333333333333')],
    [pagamento('B', 'A', '33.333333333333333333')],
    gastos,
  );
  assert.equal(quitado.length, 0);
});

test('próxima data do recorrente segue a mesma regra do banco', async () => {
  const { proximaOcorrencia } = await import('../src/lib/formatos');
  assert.equal(proximaOcorrencia('2026-01-31', 'mensal', 31), '2026-02-28');
  assert.equal(proximaOcorrencia('2026-02-28', 'mensal', 31), '2026-03-31');
  assert.equal(proximaOcorrencia('2028-01-31', 'mensal', 31), '2028-02-29');
  assert.equal(proximaOcorrencia('2026-12-15', 'mensal', 15), '2027-01-15');
  assert.equal(proximaOcorrencia('2026-12-28', 'semanal', 28), '2027-01-04');
});
