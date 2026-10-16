import { router } from 'expo-router';
import { useEffect } from 'react';

// No navegador quem abre a tela certa é o service worker (public/sw.js).
// Quando a janela não é controlada por ele, o service worker manda uma mensagem e a navegação acontece aqui.
export function useToqueNotificacao(logado: boolean) {
  useEffect(() => {
    if (!logado || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const aoReceber = (evento: MessageEvent) => {
      const dados = evento.data as { tipo?: string; caminho?: string } | null;
      if (dados?.tipo === 'abrir' && typeof dados.caminho === 'string' && dados.caminho.startsWith('/')) {
        router.push(dados.caminho as never);
      }
    };
    navigator.serviceWorker.addEventListener('message', aoReceber);
    return () => navigator.serviceWorker.removeEventListener('message', aoReceber);
  }, [logado]);
}
