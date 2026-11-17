/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { agruparPorData, sugestoesDeDescricao, tituloDaData } from '../src/lib/agrupar';
import { Decimal } from '../src/lib/dinheiro';
import { chaveParaMostrar, codigoPix, crc16, normalizarChave, tipoDaChave } from '../src/lib/pix';
import type { Categoria, Gasto } from '../src/lib/tipos';

test('CRC do exemplo do manual do Banco Central', () => {
  const semCrc =
    '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
  assert.equal(crc16(semCrc), '1D3D');
});

test('código Pix com valor, nome sem acento e CRC no fim', () => {
  const codigo = codigoPix({ chave: '+5551999998888', nome: 'Bia Conceição', valor: new Decimal('41.67') });
  assert.ok(codigo.startsWith('000201'));
  assert.ok(codigo.includes('0014br.gov.bcb.pix0114+5551999998888'));
  assert.ok(codigo.includes('540541.67'));
  assert.ok(codigo.includes('5913BIA CONCEICAO'));
  assert.equal(codigo.slice(-4), crc16(codigo.slice(0, -4)));
});

test('nome comprido é cortado em 25 letras', () => {
  const codigo = codigoPix({ chave: 'a@b.co', nome: 'Maria Aparecida dos Santos Oliveira', valor: new Decimal(10) });
  assert.ok(codigo.includes('5925MARIA APARECIDA DOS SANTO'));
});

test('chaves Pix normalizadas', () => {
  assert.equal(normalizarChave('celular', '(51) 99999-8888'), '+5551999998888');
  assert.equal(normalizarChave('celular', '+55 51 99999-8888'), '+5551999998888');
  assert.equal(normalizarChave('celular', '9999-8888'), null);
  assert.equal(normalizarChave('cpf', '123.456.789-09'), '12345678909');
  assert.equal(normalizarChave('cpf', '12.345.678/0001-95'), '12345678000195');
  assert.equal(normalizarChave('email', ' Bia@Exemplo.com '), 'bia@exemplo.com');
  assert.equal(normalizarChave('email', 'bia@'), null);
  assert.equal(
    normalizarChave('aleatoria', '123E4567-E89B-12D3-A456-426614174000'),
    '123e4567-e89b-12d3-a456-426614174000',
  );
  assert.equal(tipoDaChave('+5551999998888'), 'celular');
  assert.equal(tipoDaChave('12345678909'), 'cpf');
  assert.equal(chaveParaMostrar('+5551999998888'), '(51) 99999-8888');
  assert.equal(chaveParaMostrar('12345678909'), '123.456.789-09');
});

function gasto(data: string, valor: string, descricao = 'x', categoria: Categoria = 'outros'): Gasto {
  return {
    id: `${data}-${valor}-${descricao}`,
    grupo_id: 'g',
    descricao,
    valor_total: valor,
    data,
    tipo_divisao: 'igual',
    itens: null,
    criado_por: 'a',
    criado_em: data,
    recorrente_id: null,
    categoria,
    comprovante: null,
    pagadores: [],
    divisoes: [],
    dividas: [],
  };
}

test('títulos das datas a partir de uma quarta-feira', () => {
  const hoje = '2026-11-18'; // quarta
  assert.equal(tituloDaData('2026-11-18', hoje), 'Hoje');
  assert.equal(tituloDaData('2026-11-17', hoje), 'Ontem');
  assert.equal(tituloDaData('2026-11-16', hoje), 'Esta semana'); // segunda
  assert.equal(tituloDaData('2026-11-15', hoje), 'Novembro'); // domingo passado
  assert.equal(tituloDaData('2026-10-30', hoje), 'Outubro');
  assert.equal(tituloDaData('2025-12-30', hoje), 'Dezembro de 2025');
  assert.equal(tituloDaData('2026-12-01', hoje), 'Datas futuras');
  // numa segunda, ontem já é a semana passada
  assert.equal(tituloDaData('2026-11-15', '2026-11-16'), 'Ontem');
  assert.equal(tituloDaData('2026-11-14', '2026-11-16'), 'Novembro');
});

test('gastos agrupados com subtotal', () => {
  const blocos = agruparPorData(
    [gasto('2026-11-18', '10.50'), gasto('2026-11-18', '4.50'), gasto('2026-11-17', '20'), gasto('2026-10-02', '7')],
    '2026-11-18',
  );
  assert.deepEqual(
    blocos.map((b) => [b.titulo, b.total.toString(), b.itens.length]),
    [
      ['Hoje', '15', 2],
      ['Ontem', '20', 1],
      ['Outubro', '7', 1],
    ],
  );
});

test('sugestões de descrição: começo da palavra, mais usadas primeiro, sem repetir', () => {
  const gastos = [
    gasto('2026-11-10', '90', 'Mercado', 'mercado'),
    gasto('2026-11-03', '80', 'mercado', 'mercado'),
    gasto('2026-11-01', '30', 'Mercearia do João', 'mercado'),
    gasto('2026-10-01', '50', 'Super mercado', 'mercado'),
    gasto('2026-10-01', '150', 'Luz', 'contas'),
  ];
  const s = sugestoesDeDescricao(gastos, 'mer');
  assert.deepEqual(
    s.map((g) => g.descricao),
    ['Mercado', 'Mercearia do João', 'Super mercado'],
  );
  assert.equal(s[0].data, '2026-11-10', 'traz o gasto mais recente com aquele nome');
  assert.deepEqual(sugestoesDeDescricao(gastos, 'm'), [], 'precisa de duas letras');
  assert.deepEqual(sugestoesDeDescricao(gastos, 'luz'), [], 'nome já completo não sugere ele mesmo');
});
