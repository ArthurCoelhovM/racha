import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase, supabaseConfigurado } from './supabase';

type ValorSessao = {
  sessao: Session | null;
  carregando: boolean;
  usuarioId: string | null;
};

const ContextoSessao = createContext<ValorSessao>({ sessao: null, carregando: true, usuarioId: null });

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(supabaseConfigurado);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    supabase.auth
      .getSession()
      .then(({ data }) => setSessao(data.session))
      .finally(() => setCarregando(false));

    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => setSessao(novaSessao));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <ContextoSessao.Provider value={{ sessao, carregando, usuarioId: sessao?.user.id ?? null }}>
      {children}
    </ContextoSessao.Provider>
  );
}

export function useSessao() {
  return useContext(ContextoSessao);
}

// Código de convite aberto antes do login, para entrar no grupo logo depois.
// Fica guardado no aparelho por um dia: sobrevive a sair do app para confirmar o e-mail.
const CHAVE_CONVITE = 'so3021-convite-pendente';
const VALIDADE_CONVITE = 24 * 60 * 60 * 1000;
let codigoNaMemoria: string | null = null;

export function guardarCodigoPendente(codigo: string | null) {
  codigoNaMemoria = codigo;
  try {
    if (codigo) localStorage.setItem(CHAVE_CONVITE, JSON.stringify({ codigo, em: Date.now() }));
    else localStorage.removeItem(CHAVE_CONVITE);
  } catch {
    // sem armazenamento, fica só na memória
  }
}

export function pegarCodigoPendente(): string | null {
  let codigo = codigoNaMemoria;
  codigoNaMemoria = null;
  try {
    const guardado = localStorage.getItem(CHAVE_CONVITE);
    localStorage.removeItem(CHAVE_CONVITE);
    if (guardado) {
      const { codigo: salvo, em } = JSON.parse(guardado) as { codigo?: unknown; em?: unknown };
      if (typeof salvo === 'string' && typeof em === 'number' && Date.now() - em < VALIDADE_CONVITE) {
        codigo ??= salvo;
      }
    }
  } catch {
    // sem armazenamento: vale o que estava na memória
  }
  return codigo;
}
