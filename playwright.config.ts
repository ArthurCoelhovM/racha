import { defineConfig, devices } from '@playwright/test';

// Testes de ponta a ponta: o app web contra um Supabase de verdade (local).
// No GitHub: workflow Testes, job "Ponta a ponta" (supabase start + build web).
// No computador: supabase start, npm run e2e:web e npm run e2e.
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8081',
    ...devices['Pixel 7'],
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
