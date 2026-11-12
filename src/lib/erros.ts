import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from './supabase';

let telaAtual = '';
const recentes = new Map<string, number>();

export function definirTelaAtual(caminho: string) {
  telaAtual = caminho;
}

// guarda o erro na tabela "erros" do Supabase; nunca derruba o app se falhar
export async function registrarErro(erro: unknown, onde?: string) {
  try {
    const e = erro instanceof Error ? erro : new Error(String(erro));
    const mensagem = e.message || String(erro);
    // o mesmo erro em menos de um minuto conta uma vez só
    const agora = Date.now();
    if ((recentes.get(mensagem) ?? 0) > agora - 60_000) return;
    recentes.set(mensagem, agora);

    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    await supabase.rpc('registrar_erro', {
      p_mensagem: mensagem,
      p_pilha: e.stack?.slice(0, 8000),
      p_tela: (onde ?? telaAtual).slice(0, 300),
      p_plataforma: Platform.OS,
      p_versao: Constants.expoConfig?.version ?? '',
    });
  } catch {
    // sem conexão ou sem sessão: deixa para lá
  }
}

let instalado = false;

// erros fora da tela (promessas esquecidas, eventos) também vão para a tabela
export function instalarCapturaDeErros() {
  if (instalado) return;
  instalado = true;

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (evento) => registrarErro(evento.error ?? evento.message));
    window.addEventListener('unhandledrejection', (evento) => registrarErro(evento.reason));
    return;
  }

  const global = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler: () => (erro: unknown, fatal?: boolean) => void;
      setGlobalHandler: (f: (erro: unknown, fatal?: boolean) => void) => void;
    };
  };
  const utils = global.ErrorUtils;
  if (!utils) return;
  const anterior = utils.getGlobalHandler();
  utils.setGlobalHandler((erro, fatal) => {
    registrarErro(erro, fatal ? `${telaAtual} (fatal)` : telaAtual);
    anterior(erro, fatal);
  });
}
