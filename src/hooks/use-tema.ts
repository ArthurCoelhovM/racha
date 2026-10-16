import { useColorScheme } from 'react-native';

import { paleta } from '@/constants/tema';

export function useTema() {
  const esquema = useColorScheme();
  return esquema === 'dark' ? paleta.escuro : paleta.claro;
}

export function useEscuro() {
  return useColorScheme() === 'dark';
}
