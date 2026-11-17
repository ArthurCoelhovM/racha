import { expect, test } from '@playwright/test';

import { aba, api, botao, campo, criarConta, criarPessoa, texto } from './apoio';

const sufixo = `${Date.now()}`;

test('grupo, gastos, pagamento, histórico e saída de um membro', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));

  await criarConta(page, 'Ana', `ana${sufixo}@teste.com`);
  await expect(texto(page, 'Nenhum grupo ainda')).toBeVisible();

  // cria o grupo e pega o código
  await botao(page, 'Criar grupo').click();
  await campo(page, 'Nome do grupo').fill('Viagem Floripa');
  await botao(page, 'Criar grupo').click();
  await expect(texto(page, 'Código do grupo')).toBeVisible();
  const codigo = await page.locator('text=/^[A-Z2-9]{6}$/').first().innerText();

  // Bia entra pelo código, pela API
  const bia = await criarPessoa('Bia', `bia${sufixo}@teste.com`);
  await api('/rest/v1/rpc/entrar_no_grupo', { p_codigo: codigo }, bia.token);

  await texto(page, 'Ir para o grupo').click();
  await expect(texto(page, '+ Gasto')).toBeVisible();
  await page.reload();

  // gasto com máscara de moeda
  await texto(page, '+ Gasto').click();
  await campo(page, 'Descrição').fill('Jantar');
  await campo(page, 'Valor (R$)').fill('10000');
  await expect(campo(page, 'Valor (R$)')).toHaveValue('100,00');
  await botao(page, 'Registrar gasto').click();
  await expect(texto(page, 'Você recebe R$ 50,00 de Bia')).toBeVisible();
  await expect(texto(page, 'R$ 50,00')).toBeVisible();

  // marcar pago e desfazer
  await botao(page, 'Marcar que recebi').click();
  await expect(texto(page, 'Pagamento de R$ 50,00 marcado.')).toBeVisible();
  await expect(texto(page, 'Ninguém deve nada')).toBeVisible();
  await botao(page, 'Desfazer').click();
  await expect(texto(page, 'Desfeito.', true)).toBeVisible();
  await expect(texto(page, 'Bia deve a você')).toBeVisible();

  await aba(page, 'Histórico').click();
  await expect(texto(page, 'registrou "Jantar"')).toBeVisible();

  // divisão por item
  await aba(page, 'Dívidas').click();
  await texto(page, '+ Gasto').click();
  await campo(page, 'Descrição').fill('Mercado');
  await expect(texto(page, 'Você pagou · igual entre todos (2)')).toBeVisible();
  await texto(page, 'Mudar', true).click();
  await texto(page, 'Por item', true).click();
  await page.locator('input[placeholder="Item 1"] >> visible=true').first().fill('Cerveja');
  await page.locator('input[placeholder="0,00"] >> visible=true').last().fill('3000');
  await texto(page, '+ Adicionar item').click();
  await page.locator('input[placeholder="Item 2"] >> visible=true').first().fill('Pão');
  await page.locator('input[placeholder="0,00"] >> visible=true').last().fill('1250');
  await expect(texto(page, '42,50', true)).toBeVisible();
  await botao(page, 'Registrar gasto').click();
  await expect(aba(page, 'Gastos (2)')).toBeVisible();

  // aviso de quem entrou
  await page.goto('/');
  await expect(texto(page, 'Viagem Floripa')).toBeVisible();
  await expect(page.getByLabel('Avisos, 1 não lidos').locator('visible=true').first()).toBeVisible();
  await page.getByLabel('Avisos, 1 não lidos').locator('visible=true').first().click();
  await expect(texto(page, 'Bia entrou no grupo.')).toBeVisible();

  // Bia sai; a edição mantém a parte dela
  await page.goto('/');
  await texto(page, 'Viagem Floripa').click();
  await page.waitForURL(/\/grupo\/[0-9a-f-]{36}/);
  const grupoId = page.url().replace(/\/$/, '').split('/').pop()!;
  await api('/rest/v1/rpc/sair_do_grupo', { p_grupo: grupoId }, bia.token);
  await page.reload();
  await aba(page, /Gastos/).click();
  await texto(page, 'Jantar', true).click();
  await expect(texto(page, 'Bia (saiu)')).toBeVisible();
  await botao(page, 'Salvar alterações').click();
  await aba(page, 'Dívidas').click();
  await expect(texto(page, 'Bia (saiu) deve a você')).toBeVisible();

  // grupo de que a Ana não participa
  const outro = await api<string>('/rest/v1/rpc/criar_grupo', { p_nome: 'Só da Bia' }, bia.token);
  await page.goto(`/grupo/${outro}`);
  await expect(texto(page, 'Você não está mais neste grupo')).toBeVisible();

  expect(erros).toEqual([]);
});
