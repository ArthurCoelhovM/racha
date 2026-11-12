import { Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components/ui';
import { raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';

export function Abas<T extends string>({
  opcoes,
  valor,
  aoMudar,
  pequena = false,
}: {
  opcoes: [T, string][];
  valor: T;
  aoMudar: (v: T) => void;
  pequena?: boolean;
}) {
  const tema = useTema();
  return (
    <View style={[estilos.abas, { backgroundColor: tema.superficie2 }]}>
      {opcoes.map(([chave, rotulo]) => {
        const ativa = chave === valor;
        return (
          <Pressable
            key={chave}
            accessibilityRole="tab"
            accessibilityState={{ selected: ativa }}
            onPress={() => aoMudar(chave)}
            style={[estilos.aba, pequena && { paddingVertical: 6 }, ativa && { backgroundColor: tema.superficie }]}>
            <Texto
              variante={pequena ? 'suave' : 'forte'}
              cor={ativa ? tema.texto : tema.textoSuave}
              style={{ fontWeight: '700' }}>
              {rotulo}
            </Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  abas: { flexDirection: 'row', borderRadius: raio.m, padding: 4, gap: 4 },
  aba: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: raio.p },
});
