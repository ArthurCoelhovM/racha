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

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = new URL((evento.notification.data && evento.notification.data.url) || '/', self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if (janela.url.startsWith(self.location.origin) && 'focus' in janela) {
          return janela.navigate(destino).then((j) => (j || janela).focus());
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
