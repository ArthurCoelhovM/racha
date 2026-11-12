import { Platform, Share } from 'react-native';

import { dec } from './dinheiro';
import { isoParaBr } from './formatos';
import { infoCategoria, TIPOS_DIVISAO, type Gasto } from './tipos';

function celula(valor: string): string {
  return /[";\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

function numero(valor: string): string {
  return dec(valor).toDecimalPlaces(2).toFixed(2).replace('.', ',');
}

// separador ";" e vírgula decimal, para abrir direto no Excel em português
export function gastosEmCsv(gastos: Gasto[], nomes: Map<string, string>): string {
  const nome = (id: string) => nomes.get(id) ?? 'Alguém';
  const linhas = [['Data', 'Descrição', 'Categoria', 'Total', 'Divisão', 'Pagou', 'Parte de cada um'].join(';')];
  for (const g of gastos) {
    const pagou = g.pagadores.map((p) => `${nome(p.usuario_id)} ${numero(p.valor)}`).join(' / ');
    const partes = g.divisoes.map((d) => `${nome(d.usuario_id)} ${numero(d.valor)}`).join(' / ');
    const tipo = TIPOS_DIVISAO.find((t) => t.tipo === g.tipo_divisao)?.nome ?? g.tipo_divisao;
    const categoria = infoCategoria(g.categoria).nome;
    linhas.push(
      [isoParaBr(g.data), g.descricao, categoria, numero(g.valor_total), tipo, pagou, partes].map(celula).join(';'),
    );
  }
  return '﻿' + linhas.join('\n');
}

export async function exportarCsv(nomeArquivo: string, conteudo: string, tipo = 'text/csv;charset=utf-8') {
  if (Platform.OS === 'web') {
    const blob = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  await Share.share({ title: nomeArquivo, message: conteudo });
}
