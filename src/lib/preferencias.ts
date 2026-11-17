import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

// Preferências de leitura deste aparelho (modo compacto)
const CHAVE_COMPACTO = 'so3021-compacto';
const ouvintes = new Set<() => void>();

function lerCompacto(): boolean {
  try {
    return localStorage.getItem(CHAVE_COMPACTO) === '1';
  } catch {
    return false;
  }
}

let compacto = lerCompacto();

export function mudarCompacto(valor: boolean) {
  compacto = valor;
  try {
    localStorage.setItem(CHAVE_COMPACTO, valor ? '1' : '0');
  } catch {
    // sem armazenamento, vale só até fechar o app
  }
  ouvintes.forEach((o) => o());
}

function assinar(o: () => void) {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}

export function useCompacto(): boolean {
  return useSyncExternalStore(
    assinar,
    () => compacto,
    () => false,
  );
}

// No navegador, o tamanho de letra escolhido nas configurações muda a fonte da página (16px é o normal).
// No celular, o React Native já segue o tamanho de letra do sistema.
function escalaDoNavegador(): number {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return 1;
  const base = parseFloat(getComputedStyle(document.documentElement).fontSize || '16');
  if (!Number.isFinite(base) || base <= 0) return 1;
  return Math.min(Math.max(base / 16, 0.85), 2);
}

export const escalaDaFonte = escalaDoNavegador();
