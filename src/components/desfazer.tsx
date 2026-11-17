import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { larguraMaxima, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { mensagemDeErro } from '@/lib/api';

type Pedido = { texto: string; tipo?: 'ok' | 'erro'; desfazer?: () => Promise<unknown> };
type Atual = Pedido & { id: number };

const Contexto = createContext<(p: Pedido) => void>(() => {});

// "Desfazer" depois de apagar, pagar, remover ou parar: a barra fica alguns segundos na parte de baixo
export function useDesfazer() {
  return useContext(Contexto);
}

const DURACAO = 7000;

export function ProvedorDesfazer({ children }: { children: ReactNode }) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const [atual, setAtual] = useState<Atual | null>(null);
  const [desfazendo, setDesfazendo] = useState(false);
  const proximo = useRef(1);

  const mostrar = useCallback((p: Pedido) => {
    setDesfazendo(false);
    setAtual({ ...p, id: proximo.current++ });
  }, []);

  useEffect(() => {
    if (!atual || desfazendo) return;
    const t = setTimeout(() => setAtual((a) => (a?.id === atual.id ? null : a)), DURACAO);
    return () => clearTimeout(t);
  }, [atual, desfazendo]);

  async function desfazer() {
    if (!atual?.desfazer) return;
    setDesfazendo(true);
    try {
      await atual.desfazer();
      mostrar({ texto: 'Desfeito.' });
    } catch (e) {
      mostrar({ texto: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  const erro = atual?.tipo === 'erro';
  return (
    <Contexto.Provider value={mostrar}>
      <View style={{ flex: 1 }}>
        {children}
        {atual ? (
          <View pointerEvents="box-none" style={[estilos.lugar, { bottom: insets.bottom + 92 }]}>
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[estilos.barra, { backgroundColor: erro ? tema.negativo : tema.texto }]}>
              <Text style={[estilos.texto, { color: tema.fundo }]} numberOfLines={3}>
                {atual.texto}
              </Text>
              {atual.desfazer ? (
                desfazendo ? (
                  <ActivityIndicator color={tema.fundo} />
                ) : (
                  <Pressable onPress={desfazer} hitSlop={10} accessibilityRole="button">
                    <Text style={[estilos.acao, { color: tema.fundo }]}>Desfazer</Text>
                  </Pressable>
                )
              ) : (
                <Pressable
                  onPress={() => setAtual(null)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Fechar">
                  <Text style={[estilos.acao, { color: tema.fundo, opacity: 0.7 }]}>OK</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : null}
      </View>
    </Contexto.Provider>
  );
}

const estilos = StyleSheet.create({
  lugar: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 16 },
  barra: {
    width: '100%',
    maxWidth: larguraMaxima - 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: raio.m,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  texto: { flex: 1, fontSize: 14.5, fontWeight: '600' },
  acao: { fontSize: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
});
