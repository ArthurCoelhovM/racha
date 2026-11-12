import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Linha, Texto } from '@/components/ui';
import { espaco } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={{ gap: espaco.m }}>
      <Texto variante="rotulo">{titulo}</Texto>
      {children}
    </View>
  );
}

export function LinhaPessoa({ id, nome, children }: { id: string; nome: string; children: ReactNode }) {
  return (
    <Linha>
      <Avatar id={id} nome={nome} tamanho={28} />
      <Texto variante="forte" numberOfLines={1} style={{ flex: 1 }}>
        {nome}
      </Texto>
      {children}
    </Linha>
  );
}

export function BotaoRedondo({ rotulo, aoPressionar }: { rotulo: string; aoPressionar: () => void }) {
  const tema = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={aoPressionar}
      style={({ pressed }) => [estilos.redondo, { backgroundColor: tema.superficie2, opacity: pressed ? 0.7 : 1 }]}>
      <Texto variante="subtitulo">{rotulo}</Texto>
    </Pressable>
  );
}

export function alternar(lista: string[], u: string) {
  return lista.includes(u) ? lista.filter((x) => x !== u) : [...lista, u];
}

export const estilosGasto = StyleSheet.create({
  campoPequeno: {
    width: 110,
    minHeight: 42,
    paddingVertical: 6,
    textAlign: 'right',
  },
});

const estilos = StyleSheet.create({
  redondo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
