import './armazenamento';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const chave = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const supabaseConfigurado = url.length > 0 && chave.length > 0;

export const supabase = createClient(url || 'http://localhost:54321', chave || 'chave-ausente', {
  auth: {
    storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export function urlDoSite(caminho: string): string | undefined {
  const base = process.env.EXPO_PUBLIC_SITE_URL;
  if (base) return base.replace(/\/$/, '') + caminho;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin + caminho;
  return undefined;
}
