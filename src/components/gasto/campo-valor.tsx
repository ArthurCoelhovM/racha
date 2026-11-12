import { StyleSheet, TextInput, View } from 'react-native';

import { Texto } from '@/components/ui';
import { fontes, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { mascaraDinheiro } from '@/lib/dinheiro';

// o valor em destaque, com o teclado numérico já aberto num gasto novo
export function CampoValor({
  valor,
  aoMudar,
  fixo,
  focar,
}: {
  valor: string;
  aoMudar: (texto: string) => void;
  fixo?: string;
  focar?: boolean;
}) {
  const tema = useTema();
  return (
    <View style={[estilos.caixa, { backgroundColor: tema.superficie, borderColor: tema.borda }]}>
      <Texto variante="rotulo">Valor</Texto>
      <View style={estilos.linha}>
        <Texto variante="titulo" cor={tema.textoSuave}>
          R$
        </Texto>
        {fixo !== undefined ? (
          <Texto style={[estilos.valor, { color: tema.texto }]}>{fixo}</Texto>
        ) : (
          <TextInput
            accessibilityLabel="Valor (R$)"
            value={valor}
            onChangeText={(t) => aoMudar(mascaraDinheiro(t))}
            placeholder="0,00"
            placeholderTextColor={tema.textoSuave}
            keyboardType="number-pad"
            inputMode="numeric"
            autoFocus={focar}
            style={[estilos.valor, estilos.entrada, { color: tema.texto }]}
          />
        )}
      </View>
      {fixo !== undefined ? <Texto variante="suave">Soma dos itens.</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { borderWidth: 1, borderRadius: raio.g, paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  valor: { fontFamily: fontes.titulo, fontSize: 40, fontVariant: ['tabular-nums'], flex: 1, minWidth: 0 },
  entrada: { paddingVertical: 2, outlineStyle: 'none' } as object,
});
