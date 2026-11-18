import { expect, test } from '@playwright/test';

import { aba, api, botao, CHAVE, criarPessoa, entrar, SUPABASE_URL, texto } from './apoio';

const sufixo = `${Date.now()}`;

// a data no fuso de São Paulo, o mesmo do navegador do teste (em UTC, depois das 21h já seria amanhã)
function hojeMenos(dias: number) {
  const d = new Date(Date.now() - dias * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

test('conferir as contas, Pix, barra de baixo, pagamento parcial, sugestões e primeiros passos', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));

  const ana = await criarPessoa('Ana', `ana-i${sufixo}@teste.com`);
  const bia = await criarPessoa('Bia', `bia-i${sufixo}@teste.com`);
  const grupo = await api<string>('/rest/v1/rpc/criar_grupo', { p_nome: 'Apê', p_abatimento: true }, ana.token);
  const codigo = await api<string>('/rest/v1/rpc/codigo_do_grupo', { p_grupo: grupo }, ana.token);
  await api('/rest/v1/rpc/entrar_no_grupo', { p_codigo: codigo }, bia.token);

  // Bia pagou a luz (150, metade de cada); Ana pagou o mercado (100, 40 da Bia)
  const salvar = (token: string, p: object) => api('/rest/v1/rpc/salvar_gasto', { p }, token);
  await salvar(bia.token, {
    grupo_id: grupo,
    descricao: 'Luz',
    categoria: 'contas',
    data: hojeMenos(3),
    valor_total: 150,
    tipo_divisao: 'igual',
    pagadores: [{ usuario_id: bia.id, valor: 150 }],
    divisoes: [
      { usuario_id: ana.id, valor: 75 },
      { usuario_id: bia.id, valor: 75 },
    ],
  });
  await salvar(ana.token, {
    grupo_id: grupo,
    descricao: 'Mercado',
    categoria: 'mercado',
    data: hojeMenos(1),
    valor_total: 100,
    tipo_divisao: 'exato',
    pagadores: [{ usuario_id: ana.id, valor: 100 }],
    divisoes: [
      { usuario_id: ana.id, valor: 60 },
      { usuario_id: bia.id, valor: 40 },
    ],
  });

  // Bia cadastra a chave Pix
  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/perfis?id=eq.${bia.id}`, {
    method: 'PATCH',
    headers: { apikey: CHAVE, Authorization: `Bearer ${bia.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ chave_pix: '+5551999998888' }),
  });
  expect(resposta.ok).toBeTruthy();

  await entrar(page, `ana-i${sufixo}@teste.com`);

  // primeiros passos: a Ana já tem grupo, convidou e registrou gasto; falta o pagamento
  await expect(texto(page, 'Primeiros passos')).toBeVisible();
  await expect(texto(page, /3 de [45] feitos/)).toBeVisible();

  // barra de baixo: gastos de todos os grupos, agrupados por data
  await aba(page, 'Gastos').click();
  await expect(texto(page, 'Ontem', true)).toBeVisible();
  await expect(texto(page, 'Mercado', true)).toBeVisible();
  await expect(texto(page, 'Apê', true)).toBeVisible();
  await aba(page, 'Início').click();

  // dívida abatida: 75 - 40 = 35
  await texto(page, 'Apê', true).click();
  await expect(texto(page, 'Abatimento direto')).toBeVisible();
  await texto(page, 'Entendi').click();
  await expect(texto(page, 'Abatimento direto')).toBeHidden();
  await expect(texto(page, 'R$ 35,00', true)).toBeVisible();

  // Pix com a chave da Bia e o valor certo
  await botao(page, 'Pagar com Pix a Bia').click();
  await expect(texto(page, '(51) 99999-8888')).toBeVisible();
  await expect(botao(page, 'Copiar Pix copia e cola')).toBeVisible();
  await expect(page.getByLabel('QR code do Pix').locator('visible=true').first()).toBeVisible();
  await page.getByLabel('Fechar').locator('visible=true').last().click();

  // tocar na linha abre o extrato com a Bia
  await page
    .getByLabel(/^Extrato com Bia/)
    .locator('visible=true')
    .first()
    .click();
  await expect(texto(page, 'As contas fecham')).toBeVisible();
  await expect(texto(page, 'Luz, R$ 150,00')).toBeVisible();
  await expect(texto(page, 'Mercado, R$ 100,00')).toBeVisible();
  await expect(texto(page, 'R$ 75,00', true)).toBeVisible();
  await expect(texto(page, 'Abatido: você paga R$ 35,00 a Bia.')).toBeVisible();

  // pagamento parcial pelo + da barra
  await page.goto('/');
  await botao(page, 'Adicionar: gasto, pagamento, cupom ou grupo').click();
  await texto(page, 'Pagamento', true).click();
  await expect(texto(page, 'Em aberto: R$ 35,00', false)).toBeVisible();
  await page.locator('[aria-label="Quanto"] >> visible=true').first().fill('1500');
  await botao(page, 'Registrar pagamento').click();
  await expect(texto(page, 'Primeiros passos')).toBeHidden();
  await texto(page, 'Apê', true).click();
  await expect(texto(page, 'R$ 20,00', true)).toBeVisible();

  // gasto novo: "Lu" sugere a luz e já escolhe a categoria e quem pagou
  await texto(page, '+ Gasto').click();
  await page.locator('[aria-label="Descrição"] >> visible=true').first().fill('Lu');
  await botao(page, 'Usar Luz').click();
  await expect(page.locator('[aria-label="Descrição"] >> visible=true').first()).toHaveValue('Luz');
  await expect(texto(page, 'Bia pagou · igual entre todos (2)')).toBeVisible();

  expect(erros).toEqual([]);
});
