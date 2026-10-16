// Navegador (iPhone com o app na Tela de Início, Android e computador): Web Push
import { registrarDispositivo, removerDispositivo } from './api';

export type SituacaoPush = { disponivel: boolean; ativo: boolean; motivo: string | null };

const chavePublica = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function ehIphone() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function instalado() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
}

function chaveEmBytes(base64: string): Uint8Array<ArrayBuffer> {
  const completo = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const texto = atob(completo);
  const bytes = new Uint8Array(new ArrayBuffer(texto.length));
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i);
  return bytes;
}

async function registroAtual() {
  if (!('serviceWorker' in navigator)) return undefined;
  return navigator.serviceWorker.getRegistration('/');
}

export async function situacaoPush(): Promise<SituacaoPush> {
  if (!chavePublica) {
    return {
      disponivel: false,
      ativo: false,
      motivo: 'As notificações ainda não foram configuradas no servidor do app.',
    };
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    if (ehIphone() && !instalado()) {
      return {
        disponivel: false,
        ativo: false,
        motivo:
          'No iPhone, primeiro instale o app: no Safari, Compartilhar e "Adicionar à Tela de Início". Depois abra por lá.',
      };
    }
    return { disponivel: false, ativo: false, motivo: 'Este navegador não recebe notificações.' };
  }
  if (Notification.permission === 'denied') {
    return {
      disponivel: false,
      ativo: false,
      motivo: 'As notificações deste site estão bloqueadas. Libere nas configurações do navegador.',
    };
  }
  const assinatura = await (await registroAtual())?.pushManager.getSubscription();
  return { disponivel: true, ativo: !!assinatura && Notification.permission === 'granted', motivo: null };
}

export async function ativarPush(): Promise<void> {
  // a permissão precisa ser pedida logo no toque, antes de qualquer outra espera (regra do Safari)
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') {
    throw new Error('Sem permissão o app não consegue avisar. Libere as notificações nas configurações do navegador.');
  }
  const registro = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  let assinatura = await registro.pushManager.getSubscription();
  try {
    assinatura ??= await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chaveEmBytes(chavePublica),
    });
  } catch {
    throw new Error('O navegador não deixou ativar as notificações agora. Tente de novo em instantes.');
  }
  await registrarDispositivo('web', assinatura.endpoint, assinatura.toJSON());
}

export async function desativarPush(): Promise<void> {
  const assinatura = await (await registroAtual())?.pushManager.getSubscription();
  if (!assinatura) return;
  await removerDispositivo(assinatura.endpoint).catch(() => {});
  await assinatura.unsubscribe().catch(() => false);
}
