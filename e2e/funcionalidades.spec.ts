import { expect, test } from '@playwright/test';

import { aba, api, botao, campo, criarPessoa, entrar, texto } from './apoio';

const sufixo = `${Date.now()}`;

function hojeMenos(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

test('categorias, busca, resumo com gráficos, comentários, apelido e arquivar', async ({ page }) => {
  const ana = await criarPessoa('Ana', `ana-f${sufixo}@teste.com`);
  const bia = await criarPessoa('Bia', `bia-f${sufixo}@teste.com`);
  const grupo = await api<string>('/rest/v1/rpc/criar_grupo', { p_nome: 'Casa' }, ana.token);
  const codigo = await api<string>('/rest/v1/rpc/codigo_do_grupo', { p_grupo: grupo }, ana.token);
  await api('/rest/v1/rpc/entrar_no_grupo', { p_codigo: codigo }, bia.token);
  const partes = (v: number) => [
    { usuario_id: ana.id, valor: v / 2 },
    { usuario_id: bia.id, valor: v / 2 },
  ];
  const itens = (preco: string) => [
    { descricao: 'Café (2 un)', valor: preco, participantes: [ana.id, bia.id] },
    { descricao: 'Pão', valor: '10.00', participantes: [ana.id, bia.id] },
  ];
  for (const [data, preco] of [
    [hojeMenos(40), '28.00'],
    [hojeMenos(1), '32.00'],
  ] as const) {
    const total = Number(preco) + 10;
    await api(
      '/rest/v1/rpc/salvar_gasto',
      {
        p: {
          grupo_id: grupo,
          descricao: 'Feira',
          categoria: 'mercado',
          data,
          valor_total: total,
          tipo_divisao: 'itens',
          itens: itens(preco),
          pagadores: [{ usuario_id: ana.id, valor: total }],
          divisoes: partes(total),
        },
      },
      ana.token,
    );
  }
  await api(
    '/rest/v1/rpc/salvar_gasto',
    {
      p: {
        grupo_id: grupo,
        descricao: 'Luz',
        categoria: 'contas',
        data: hojeMenos(2),
        valor_total: 150,
        tipo_divisao: 'igual',
        pagadores: [{ usuario_id: bia.id, valor: 150 }],
        divisoes: partes(150),
      },
    },
    bia.token,
  );

  await entrar(page, `ana-f${sufixo}@teste.com`);
  await texto(page, 'Casa', true).click();

  // busca pelo item do cupom
  await aba(page, /^Gastos \(/).click();
  await page.getByLabel('Buscar gastos').fill('café');
  await expect(texto(page, 'Luz', true)).toBeHidden();
  await expect(texto(page, 'Feira', true)).toBeVisible();
  await page.getByLabel('Buscar gastos').fill('');
  await expect(texto(page, 'Luz', true)).toBeVisible();

  // resumo com os gráficos
  await aba(page, 'Resumo').click();
  await expect(texto(page, 'Em que o grupo gastou')).toBeVisible();
  await expect(texto(page, 'Quem pagou o quê')).toBeVisible();
  await expect(texto(page, 'Contas fixas no ano')).toBeVisible();
  await expect(texto(page, 'Itens mais comprados')).toBeVisible();
  await expect(texto(page, '2 compras · média R$ 30,00')).toBeVisible();

  // comentário no gasto
  await aba(page, /^Gastos \(/).click();
  await texto(page, 'Luz', true).click();
  await campo(page, 'Comentário').fill('Veio mais alta este mês?');
  await botao(page, 'Comentar').click();
  await expect(texto(page, 'Veio mais alta este mês?')).toBeVisible();
  await page.goBack();

  // apelido e arquivar
  await page.getByLabel('Ajustes').locator('visible=true').first().click();
  await campo(page, 'Seu apelido neste grupo').fill('Aninha');
  await botao(page, 'Salvar apelido').click();
  await expect(texto(page, 'Apelido salvo.')).toBeVisible();
  await texto(page, 'Arquivar grupo', true).click();
  await expect(texto(page, /Grupo arquivado/)).toBeVisible();
  await page.goto('/');
  await expect(botao(page, 'Arquivados (1)')).toBeVisible();
});
