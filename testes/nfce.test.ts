/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { lerNfce, numeroBr, validarUrlNfce } from '../supabase/functions/_shared/nfce';
import { itensDaNota, nomeDoItem } from '../src/lib/cupom';
import { lerValor } from '../src/lib/dinheiro';

const pasta = join(__dirname, 'fixtures');
const rs = new TextDecoder('latin1').decode(readFileSync(join(pasta, 'nfce-rs.html')));
const es = readFileSync(join(pasta, 'nfce-es.html'), 'utf8');

test('lê números no formato brasileiro', () => {
  assert.equal(numeroBr('1.234,56'), 1234.56);
  assert.equal(numeroBr('0,345'), 0.345);
  assert.equal(numeroBr('NaN'), null);
  assert.equal(numeroBr(''), null);
});

test('lê a nota do RS com desconto, itens por quilo e acentos em ISO-8859-1', () => {
  const nota = lerNfce(rs);
  assert.equal(nota.estabelecimento, 'SUPERMERCADO BOM PREÇO LTDA');
  assert.equal(nota.cnpj, '12.345.678/0001-90');
  assert.equal(nota.data, '2026-10-16');
  assert.equal(nota.chave, '43261012345678000190650010000123451000123456');
  assert.equal(nota.itens.length, 4);
  assert.deepEqual(nota.itens[1], {
    descricao: 'BANANA PRATA',
    codigo: '2001',
    quantidade: 1.235,
    unidade: 'KG',
    valorUnitario: 6.99,
    valor: 8.63,
  });
  assert.equal(nota.itens[3].descricao, 'PÃO FRANCÊS');
  assert.equal(nota.totalItens, 92.62);
  assert.equal(nota.desconto, 2.62);
  assert.equal(nota.valorPago, 90);
});

test('lê a nota do ES sem linha de desconto e com pagamento NaN', () => {
  const nota = lerNfce(es);
  assert.equal(nota.estabelecimento, 'PADARIA PÃO QUENTE');
  assert.equal(nota.data, '2026-10-02');
  assert.equal(nota.itens.length, 2);
  assert.equal(nota.totalItens, 18.9);
  assert.equal(nota.desconto, 0);
  assert.equal(nota.valorPago, 18.9);
});

test('página em outro formato não inventa itens', () => {
  const nota = lerNfce(readFileSync(join(pasta, 'nfce-outro-formato.html'), 'utf8'));
  assert.equal(nota.itens.length, 0);
});

test('só aceita links de NFC-e em sites do governo', () => {
  const ok = 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=43261012345678000190650010000123451000123456|2|1|1|ABC';
  assert.ok(validarUrlNfce(ok));
  assert.ok(validarUrlNfce(`  ${ok}\n`), 'aceita espaços em volta');
  assert.ok(validarUrlNfce('http://nfce.fazenda.sp.gov.br/qrcode?chNFe=3526&nVersao=100'));
  assert.equal(validarUrlNfce('https://golpe.com/NFCE?p=123'), null);
  assert.equal(validarUrlNfce('https://www.sefaz.rs.gov.br.golpe.com/?p=1'), null);
  assert.equal(validarUrlNfce('https://www.sefaz.rs.gov.br/'), null, 'precisa dos parâmetros da nota');
  assert.equal(validarUrlNfce('javascript:alert(1)'), null);
  assert.equal(validarUrlNfce('texto qualquer'), null);
  assert.ok(validarUrlNfce('http://localhost:8099/nfce?p=1', ['localhost']), 'hosts extras para testes');
});

test('itens da nota distribuem o desconto e fecham o valor pago', () => {
  const nota = lerNfce(rs);
  const { itens, total } = itensDaNota(nota, ['a', 'b']);
  assert.equal(total.toString(), '90');
  const soma = itens.reduce((s, i) => s.plus(lerValor(i.valor)!), lerValor('0')!);
  assert.equal(soma.toString(), '90');
  assert.equal(itens[0].descricao, 'ARROZ TIPO 1 5KG (2x)');
  assert.equal(itens[1].descricao, 'BANANA PRATA (1,235 kg)');
  assert.deepEqual(itens[0].participantes, ['a', 'b']);
  assert.equal(itens[0].valor, '54,22');
});

test('nota sem desconto mantém os valores', () => {
  const { itens, total } = itensDaNota(lerNfce(es), ['a']);
  assert.equal(total.toString(), '18.9');
  assert.deepEqual(
    itens.map((i) => i.valor),
    ['9,00', '9,90'],
  );
  assert.equal(
    nomeDoItem({ descricao: 'X', codigo: null, quantidade: 1, unidade: 'UN', valorUnitario: 1, valor: 1 }),
    'X',
  );
});
