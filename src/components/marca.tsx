import { StyleSheet, Text, View } from 'react-native';

import { fontes } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';

// "Racha" partido em dois, cada metade de uma cor: a conta dividida
export function Marca({ tamanho = 34 }: { tamanho?: number }) {
  const tema = useTema();
  return (
    <View style={estilos.linha} accessibilityRole="header" accessibilityLabel="Racha">
      <Text style={[estilos.nome, { color: tema.texto, fontSize: tamanho }]}>
        Ra
        <Text style={{ color: '#5B4CF0' }}>cha</Text>
        <Text style={{ color: '#E8680A' }}>.</Text>
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap' },
  nome: { fontFamily: fontes.titulo, letterSpacing: -1, lineHeight: undefined },
});
