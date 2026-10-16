// Android: notificações pelo serviço de push do Expo
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { registrarDispositivo, removerDispositivo } from './api';

export type SituacaoPush = { disponivel: boolean; ativo: boolean; motivo: string | null };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const CHAVE = 'so3021-token-push';

function tokenSalvo(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

function idDoProjeto(): string | null {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

export async function situacaoPush(): Promise<SituacaoPush> {
  if (!Device.isDevice)
    return { disponivel: false, ativo: false, motivo: 'As notificações só funcionam num celular de verdade.' };
  if (!idDoProjeto()) {
    return {
      disponivel: false,
      ativo: false,
      motivo: 'Falta ligar o app a um projeto no expo.dev (EAS) para receber notificações.',
    };
  }
  const { status } = await Notifications.getPermissionsAsync();
  return { disponivel: true, ativo: status === 'granted' && !!tokenSalvo(), motivo: null };
}

export async function ativarPush(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('avisos', {
      name: 'Avisos do grupo',
      importance: AndroidImportance.HIGH,
      lightColor: '#5B4CF0',
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') {
    throw new Error('Sem permissão o app não consegue avisar. Libere as notificações nas configurações do celular.');
  }

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId: idDoProjeto()! })).data;
  } catch {
    throw new Error('Não deu para ativar aqui. No Expo Go as notificações não funcionam; use o APK do app.');
  }
  await registrarDispositivo('expo', token);
  try {
    localStorage.setItem(CHAVE, token);
  } catch {
    // sem armazenamento local, o aparelho continua registrado no servidor
  }
}

export async function desativarPush(): Promise<void> {
  const token = tokenSalvo();
  if (!token) return;
  await removerDispositivo(token).catch(() => {});
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // nada a fazer
  }
}
