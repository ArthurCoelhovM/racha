// Service worker do Super Organizador 3021: só cuida das notificações push.
// Não guarda nada em cache, para as atualizações do app chegarem sempre.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener('push', (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = { corpo: evento.data ? evento.data.text() : '' };
  }
  const titulo = dados.titulo || 'Super Organizador 3021';
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.corpo || '',
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: dados.url || 'aviso',
      data: { url: dados.url || '/avisos' },
    }),
  );
});

// Abre a tela do aviso numa janela do app que já esteja aberta; se não houver, abre uma nova.
// navigate() só funciona em janelas controladas por este service worker; nas outras,
// a página recebe uma mensagem e navega sozinha (src/hooks/use-toque-notificacao.web.ts).
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = new URL((evento.notification.data && evento.notification.data.url) || '/', self.location.origin);
  const destino = url.href;
  const caminho = url.pathname + url.search;

  async function abrir() {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const janela = janelas.find((j) => j.url.startsWith(self.location.origin));
    if (!janela) return self.clients.openWindow(destino);

    try {
      await janela.focus();
    } catch {
      // sem foco, segue mesmo assim
    }
    try {
      const navegou = await janela.navigate(destino);
      if (navegou) return navegou;
    } catch {
      // janela não controlada: a página navega ao receber a mensagem
    }
    janela.postMessage({ tipo: 'abrir', caminho });
    return janela;
  }

  evento.waitUntil(abrir().catch(() => self.clients.openWindow(destino)));
});
