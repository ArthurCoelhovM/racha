import { expect, type Page } from '@playwright/test';

export const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://localhost:54321';
export const CHAVE = process.env.E2E_SUPABASE_KEY ?? '';

// chamadas diretas à API, para criar a "outra pessoa" do grupo sem abrir outro navegador
export async function api<T = unknown>(caminho: string, corpo: unknown, token?: string): Promise<T> {
  const resposta = await fetch(SUPABASE_URL + caminho, {
    method: 'POST',
    headers: { apikey: CHAVE, Authorization: `Bearer ${token ?? CHAVE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const texto = await resposta.text();
  if (!resposta.ok) throw new Error(`${caminho}: ${resposta.status} ${texto}`);
  return (texto ? JSON.parse(texto) : null) as T;
}

export async function criarPessoa(nome: string, email: string) {
  const r = await api<{ access_token: string; user: { id: string } }>('/auth/v1/signup', {
    email,
    password: 'senha123',
    data: { nome },
  });
  return { token: r.access_token, id: r.user.id };
}

export const campo = (p: Page, nome: string) => p.locator(`[aria-label="${nome}"] >> visible=true`).first();
export const texto = (p: Page, t: string | RegExp, exato = false) =>
  p.getByText(t, { exact: exato }).locator('visible=true').first();
export const botao = (p: Page, nome: string) => p.getByRole('button', { name: nome }).locator('visible=true').first();
export const aba = (p: Page, nome: string | RegExp) =>
  p.getByRole('tab', { name: nome }).locator('visible=true').first();

export async function criarConta(p: Page, nome: string, email: string) {
  await p.goto('/');
  await expect(texto(p, 'Esqueci minha senha')).toBeVisible();
  await texto(p, 'Criar conta', true).click();
  await campo(p, 'Seu nome').fill(nome);
  await campo(p, 'E-mail').fill(email);
  await campo(p, 'Senha').fill('senha123');
  await botao(p, 'Criar conta').click();
}

export async function entrar(p: Page, email: string) {
  await p.goto('/');
  await campo(p, 'E-mail').fill(email);
  await campo(p, 'Senha').fill('senha123');
  await botao(p, 'Entrar').click();
}

export function gasto(grupo: string, descricao: string, total: number, pagou: string, partes: [string, number][]) {
  return {
    p: {
      grupo_id: grupo,
      descricao,
      valor_total: total,
      tipo_divisao: 'igual',
      pagadores: [{ usuario_id: pagou, valor: total }],
      divisoes: partes.map(([u, v]) => ({ usuario_id: u, valor: v })),
    },
  };
}
