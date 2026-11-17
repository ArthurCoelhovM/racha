import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icone, Texto } from '@/components/ui';
import { espaco, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { jaViu, marcarVisto, type DICAS } from '@/lib/tutorial';

// balão que aparece na primeira vez que a pessoa abre uma tela e some com "Entendi"
export function Dica({ id, titulo, texto }: { id: (typeof DICAS)[number]; titulo: string; texto: string }) {
  const tema = useTema();
  const [visivel, setVisivel] = useState(() => !jaViu(id));
  if (!visivel) return null;

  function fechar() {
    marcarVisto(id);
    setVisivel(false);
  }

  return (
    <View
      accessibilityRole="summary"
      style={[estilos.caixa, { backgroundColor: tema.superficie, borderColor: tema.primaria }]}>
      <View style={[estilos.icone, { backgroundColor: tema.superficie2 }]}>
        <Icone nome="bulb-outline" cor={tema.primaria} tamanho={18} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Texto variante="forte">{titulo}</Texto>
        <Texto variante="suave">{texto}</Texto>
      </View>
      <Pressable onPress={fechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Entendi, fechar dica">
        <Texto variante="forte" cor={tema.primaria}>
          Entendi
        </Texto>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: {
    flexDirection: 'row',
    gap: espaco.m + 4,
    padding: 14,
    borderRadius: raio.m,
    borderWidth: 1.5,
    alignItems: 'flex-start',
  },
  icone: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
