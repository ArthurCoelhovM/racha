import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuRapido } from '@/components/navegacao/menu-rapido';
import { Icone, Texto, type NomeIcone } from '@/components/ui';
import { larguraMaxima, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { useInicio } from '@/lib/consultas';

const ABAS: Record<string, { rotulo: string; icone: NomeIcone; iconeAtivo: NomeIcone }> = {
  index: { rotulo: 'Início', icone: 'home-outline', iconeAtivo: 'home' },
  gastos: { rotulo: 'Gastos', icone: 'receipt-outline', iconeAtivo: 'receipt' },
  avisos: { rotulo: 'Avisos', icone: 'notifications-outline', iconeAtivo: 'notifications' },
  conta: { rotulo: 'Conta', icone: 'person-circle-outline', iconeAtivo: 'person-circle' },
};

export function BarraDeBaixo({ state, navigateToTab }: BottomTabBarProps) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const naoLidos = useInicio().data?.naoLidos ?? 0;
  const [menu, setMenu] = useState(false);

  const botoes = state.routes.map((rota, i) => {
    const info = ABAS[rota.name];
    if (!info) return null;
    const ativa = state.index === i;
    const cor = ativa ? tema.primaria : tema.textoSuave;
    return (
      <Pressable
        key={rota.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: ativa }}
        accessibilityLabel={rota.name === 'avisos' && naoLidos > 0 ? `Avisos, ${naoLidos} não lidos` : info.rotulo}
        onPress={() => navigateToTab(rota.key)}
        style={estilos.aba}>
        <View>
          <Icone nome={ativa ? info.iconeAtivo : info.icone} cor={cor} tamanho={24} />
          {rota.name === 'avisos' && naoLidos > 0 ? (
            <View style={[estilos.contador, { backgroundColor: tema.negativo, borderColor: tema.superficie }]}>
              <Texto variante="suave" cor="#FFFFFF" style={{ fontSize: 10, lineHeight: 13, fontWeight: '800' }}>
                {naoLidos > 9 ? '9+' : naoLidos}
              </Texto>
            </View>
          ) : null}
        </View>
        <Texto variante="suave" cor={cor} style={{ fontSize: 11.5, lineHeight: 15, fontWeight: ativa ? '700' : '500' }}>
          {info.rotulo}
        </Texto>
      </Pressable>
    );
  });

  // o + fica no meio: duas abas de cada lado
  return (
    <View
      style={[
        estilos.barra,
        { backgroundColor: tema.superficie, borderColor: tema.borda, paddingBottom: insets.bottom },
      ]}>
      <View style={estilos.linha}>
        {botoes.slice(0, 2)}
        <View style={estilos.aba}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Adicionar: gasto, pagamento, cupom ou grupo"
            onPress={() => setMenu(true)}
            style={({ pressed }) => [
              estilos.mais,
              { backgroundColor: tema.primaria, transform: [{ scale: pressed ? 0.94 : 1 }] },
            ]}>
            <Icone nome="add" cor={tema.sobrePrimaria} tamanho={30} />
          </Pressable>
        </View>
        {botoes.slice(2)}
      </View>
      <MenuRapido visivel={menu} aoFechar={() => setMenu(false)} />
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: { borderTopWidth: StyleSheet.hairlineWidth },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: larguraMaxima,
    alignSelf: 'center',
    paddingTop: 6,
    paddingBottom: 6,
  },
  aba: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 50 },
  mais: {
    width: 52,
    height: 52,
    borderRadius: raio.total,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  contador: {
    position: 'absolute',
    top: -4,
    right: -9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
