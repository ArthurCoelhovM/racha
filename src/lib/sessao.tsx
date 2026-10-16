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

// código de convite aberto antes do login, para entrar no grupo logo depois
let codigoPendente: string | null = null;

export function guardarCodigoPendente(codigo: string | null) {
  codigoPendente = codigo;
}

export function pegarCodigoPendente() {
  const codigo = codigoPendente;
  codigoPendente = null;
  return codigo;
}
