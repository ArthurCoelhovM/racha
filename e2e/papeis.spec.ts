import { expect, test } from '@playwright/test';

import { api, botao, criarPessoa, entrar, gasto, texto } from './apoio';

const sufixo = `${Date.now()}`;

test('papéis, permissões e o que fica para quem foi removido', async ({ browser }) => {
  const ana = await criarPessoa('Ana', `ana-p${sufixo}@teste.com`);
  const bia = await criarPessoa('Bia', `bia-p${sufixo}@teste.com`);
  const grupo = await api<string>('/rest/v1/rpc/criar_grupo', { p_nome: 'Casa' }, ana.token);
  const codigo = await api<string>('/rest/v1/rpc/codigo_do_grupo', { p_grupo: grupo }, ana.token);
  await api('/rest/v1/rpc/entrar_no_grupo', { p_codigo: codigo }, bia.token);
  // R$ 100 entre 3 não fecha: Ana pagou e fica com o centavo que sobra
  await api(
    '/rest/v1/rpc/salvar_gasto',
    gasto(grupo, 'Mercado', 100, ana.id, [
      [ana.id, 50],
      [bia.id, 50],
    ]),
    ana.token,
  );
  await api(
    '/rest/v1/rpc/salvar_gasto',
    gasto(grupo, 'Pizza', 0.05, ana.id, [
      [ana.id, 0.025],
      [bia.id, 0.025],
    ]),
    ana.token,
  );

  // Ana, a dona: só ela registra gastos neste grupo
  const paginaAna = await (await browser.newContext()).newPage();
  await entrar(paginaAna, `ana-p${sufixo}@teste.com`);
  await texto(paginaAna, 'Casa', true).click();
  await expect(texto(paginaAna, 'Bia deve a você')).toBeVisible();
  // com abatimento: 50,00 + 0,02 (a Ana ficou com 0,03 da pizza de 0,05)
  await expect(texto(paginaAna, 'R$ 50,02')).toBeVisible();
  await paginaAna.getByLabel('Ajustes').locator('visible=true').first().click();
  await expect(texto(paginaAna, 'Pessoas do grupo')).toBeVisible();
  const linhaRegistrar = paginaAna.getByText('Registrar gastos', { exact: true }).locator('..');
  await linhaRegistrar.getByText('Só o dono', { exact: true }).click();

  // Bia não vê o botão de gasto nem as configurações
  const paginaBia = await (await browser.newContext()).newPage();
  await entrar(paginaBia, `bia-p${sufixo}@teste.com`);
  await texto(paginaBia, 'Casa', true).click();
  await expect(texto(paginaBia, 'Você deve a Ana')).toBeVisible();
  await expect(texto(paginaBia, '+ Gasto')).toBeHidden();
  await paginaBia.getByLabel('Ajustes').locator('visible=true').first().click();
  await expect(texto(paginaBia, 'mudar as configurações é com admins e o dono')).toBeVisible();

  // Ana remove a Bia
  await botao(paginaAna, 'Remover').click();
  await expect(texto(paginaAna, 'Bia saiu do grupo.')).toBeVisible();

  // a Bia continua vendo e paga o que deve
  await paginaBia.goto('/');
  await expect(texto(paginaBia, 'Grupos que você deixou')).toBeVisible();
  await expect(texto(paginaBia, 'R$ 50,02')).toBeVisible();
  await botao(paginaBia, 'Marcar que paguei').click();
  await expect(texto(paginaBia, /Pagamento de R\$ .* marcado/)).toBeVisible();
});
