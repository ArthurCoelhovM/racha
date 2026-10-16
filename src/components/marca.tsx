import { StyleSheet, Text, View } from 'react-native';

import { useTema } from '@/hooks/use-tema';

const coresAno = ['#E8680A', '#5B4CF0', '#D92657', '#12924B'];

export function Marca({ tamanho = 34 }: { tamanho?: number }) {
  const tema = useTema();
  return (
    <View style={estilos.linha}>
      <Text style={[estilos.nome, { color: tema.texto, fontSize: tamanho }]}>
        Super Organizador{' '}
        {'3021'.split('').map((digito, i) => (
          <Text key={i} style={{ color: coresAno[i] }}>
            {digito}
          </Text>
        ))}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap' },
  nome: { fontWeight: '900', letterSpacing: -1, lineHeight: undefined },
});
