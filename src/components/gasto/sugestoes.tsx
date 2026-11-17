import { Pressable, StyleSheet, View } from 'react-native';

import { Icone, Texto, type NomeIcone } from '@/components/ui';
import { espaco, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { sugestoesDeDescricao } from '@/lib/agrupar';
import { infoCategoria, type Gasto } from '@/lib/tipos';

// "mer" -> Mercado (Mercado · você pagou): um toque preenche o resto como da última vez
export function SugestoesDeDescricao({
  gastos,
  texto,
  nome,
  aoEscolher,
}: {
  gastos: Gasto[];
  texto: string;
  nome: (u: string) => string;
  aoEscolher: (g: Gasto) => void;
}) {
  const tema = useTema();
  const sugestoes = sugestoesDeDescricao(gastos, texto);
  if (sugestoes.length === 0) return null;
  return (
    <View style={{ gap: 6, marginTop: -espaco.m }} accessibilityLabel="Sugestões de descrição">
      {sugestoes.map((g) => {
        const categoria = infoCategoria(g.categoria);
        const quem = g.pagadores.length === 1 ? `${nome(g.pagadores[0].usuario_id)} pagou` : 'mais de um pagou';
        return (
          <Pressable
            key={g.id}
            accessibilityRole="button"
            accessibilityLabel={`Usar ${g.descricao}`}
            onPress={() => aoEscolher(g)}
            style={({ pressed }) => [
              estilos.sugestao,
              { backgroundColor: tema.superficie, borderColor: tema.borda, opacity: pressed ? 0.75 : 1 },
            ]}>
            <Icone nome={categoria.icone as NomeIcone} cor={categoria.cor} tamanho={18} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Texto variante="forte" numberOfLines={1}>
                {g.descricao}
              </Texto>
              <Texto variante="suave" numberOfLines={1}>
                {categoria.nome} · {quem.replace(/^Você pagou$/, 'você pagou')}
              </Texto>
            </View>
            <Icone nome="arrow-up-outline" cor={tema.textoSuave} tamanho={16} />
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  sugestao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m + 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: raio.m,
    borderWidth: 1,
  },
});
