import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icone, Texto, type NomeIcone } from '@/components/ui';
import { raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { CATEGORIAS, type Categoria } from '@/lib/tipos';

export function SeletorDeCategoria({ valor, aoMudar }: { valor: Categoria; aoMudar: (c: Categoria) => void }) {
  const tema = useTema();
  return (
    <View style={{ gap: 6 }}>
      <Texto variante="rotulo">Categoria</Texto>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {CATEGORIAS.map((c) => {
          const ativa = c.categoria === valor;
          return (
            <Pressable
              key={c.categoria}
              accessibilityRole="radio"
              accessibilityState={{ checked: ativa }}
              accessibilityLabel={c.nome}
              onPress={() => aoMudar(c.categoria)}
              style={[
                estilos.opcao,
                {
                  backgroundColor: ativa ? c.cor : tema.superficie,
                  borderColor: ativa ? c.cor : tema.borda,
                },
              ]}>
              <Icone nome={c.icone as NomeIcone} tamanho={20} cor={ativa ? '#FFFFFF' : c.cor} />
              <Texto variante="suave" cor={ativa ? '#FFFFFF' : tema.texto} style={{ fontWeight: '600' }}>
                {c.nome}
              </Texto>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  opcao: {
    alignItems: 'center',
    gap: 2,
    width: 84,
    paddingVertical: 10,
    borderRadius: raio.m,
    borderWidth: 1.5,
  },
});
