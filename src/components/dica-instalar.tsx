import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components/ui';
import { espaco, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';

const CHAVE = 'so3021-dica-instalar';

function deveMostrar(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const ehIphone = /iPhone|iPad|iPod/i.test(nav.userAgent);
  const instalado = nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  let dispensada = false;
  try {
    dispensada = window.localStorage.getItem(CHAVE) === '1';
  } catch {
    dispensada = false;
  }
  return ehIphone && !instalado && !dispensada;
}

// No iPhone o app chega pelo navegador: esta dica ensina a colocar o ícone na Tela de Início.
export function DicaInstalar() {
  const tema = useTema();
  const [visivel, setVisivel] = useState(deveMostrar);

  if (!visivel) return null;

  function fechar() {
    try {
      window.localStorage.setItem(CHAVE, '1');
    } catch {
      // sem armazenamento, só esconde agora
    }
    setVisivel(false);
  }

  return (
    <View style={[estilos.caixa, { backgroundColor: tema.superficie, borderColor: tema.primaria }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Texto variante="forte">Instale no seu iPhone</Texto>
        <Texto variante="suave">
          No Safari, toque em Compartilhar e depois em &quot;Adicionar à Tela de Início&quot;. O app abre em tela cheia, como os outros.
        </Texto>
      </View>
      <Pressable onPress={fechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar dica">
        <Texto variante="forte" cor={tema.primaria}>OK</Texto>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { flexDirection: 'row', gap: espaco.m, padding: 14, borderRadius: raio.m, borderWidth: 1.5, alignItems: 'flex-start' },
});
