import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// vibração leve ao registrar um gasto ou marcar um pagamento (só no celular)
export function vibrarSucesso() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function vibrarToque() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
