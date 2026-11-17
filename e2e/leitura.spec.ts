import { expect, test } from '@playwright/test';

import { aba, api, botao, criarPessoa, entrar, texto } from './apoio';

const sufixo = `${Date.now()}`;

test('frase do grupo, mapa, gráficos, duplicar pelo toque longo, desfazer e busca geral', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));

  const ana = await criarPessoa('Ana', `ana-l${sufixo}@teste.com`);
  const bia = await criarPessoa('Bia', `bia-l${sufixo}@teste.com`);
  const grupo = await api<string>('/rest/v1/rpc/criar_grupo', { p_nome: 'República', p_abatimento: true }, ana.token);
  const codigo = await api<string>('/rest/v1/rpc/codigo_do_grupo', { p_grupo: grupo }, ana.token);
  await api('/rest/v1/rpc/entrar_no_grupo', { p_codigo: codigo }, bia.token);
  await api(
    '/rest/v1/rpc/salvar_gasto',
    {
      p: {
        grupo_id: grupo,
        descricao: 'Luz',
        categoria: 'contas',
        valor_total: 150,
        tipo_divisao: 'igual',
        pagadores: [{ usuario_id: bia.id, valor: 150 }],
        divisoes: [
          { usuario_id: ana.id, valor: 75 },
          { usuario_id: bia.id, valor: 75 },
        ],
      },
    },
    bia.token,
  );

  await entrar(page, `ana-l${sufixo}@teste.com`);
  await texto(page, 'República', true).click();

  // a frase do topo e a seta junto da cor
  await expect(texto(page, 'Você paga R$ 75,00 para Bia')).toBeVisible();
  await expect(texto(page, '↓ R$ 75,00')).toBeVisible();

  // mapa de quem deve a quem
  await aba(page, 'Gráfico').click();
  await expect(texto(page, 'Quem deve a quem')).toBeVisible();

  // toque longo no gasto: duplicar
  await aba(page, /^Gastos \(/).click();
  await texto(page, 'Luz', true).click({ delay: 700 });
  await page.waitForTimeout(500);
  await botao(page, 'Duplicar').click();
  await expect(page.locator('[aria-label="Descrição"] >> visible=true').first()).toHaveValue('Luz');
  await botao(page, 'Registrar gasto').click();
  await expect(aba(page, 'Gastos (2)')).toBeVisible();

  // excluir e desfazer
  await texto(page, 'Luz', true).click();
  await botao(page, 'Excluir gasto').click();
  await expect(texto(page, '"Luz" foi excluído.')).toBeVisible();
  await expect(aba(page, 'Gastos (1)')).toBeVisible();
  await botao(page, 'Desfazer').click();
  await expect(texto(page, 'Desfeito.')).toBeVisible();
  await expect(aba(page, 'Gastos (2)')).toBeVisible();

  // gráficos do resumo
  await aba(page, 'Resumo').click();
  await expect(texto(page, 'Em que dias o dinheiro saiu')).toBeVisible();
  await expect(texto(page, 'Quanto custa morar aqui')).toBeVisible();
  await botao(page, 'Definir metas').click();
  await page.locator('[aria-label="Meta de Contas"] >> visible=true').first().fill('40000');
  await botao(page, 'Salvar metas').click();
  await expect(texto(page, 'R$ 300 de R$ 400')).toBeVisible();

  // busca em todos os grupos
  await page.goto('/gastos');
  await page.locator('[aria-label="Buscar em todos os grupos"] >> visible=true').first().fill('lu');
  await expect(texto(page, 'República', true)).toBeVisible();
  await page.locator('[aria-label="Buscar em todos os grupos"] >> visible=true').first().fill('xyzw');
  await expect(texto(page, 'Nada encontrado')).toBeVisible();

  expect(erros).toEqual([]);
});
