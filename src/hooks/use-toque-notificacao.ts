import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

// Android: ao tocar na notificação, abre o grupo (ou a tela de avisos)
export function useToqueNotificacao(logado: boolean) {
  const resposta = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!logado || !resposta) return;
    const url = resposta.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
  }, [logado, resposta]);
}
