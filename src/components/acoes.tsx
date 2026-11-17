import { useState, type ReactNode } from 'react';
import { Animated, Modal, PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icone, Texto, type NomeIcone } from '@/components/ui';
import { espaco, larguraMaxima, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';

// no navegador, soltar depois de um toque longo ainda dispara o toque normal: este horário evita abrir a linha junto com o menu
let ultimoToqueLongo = 0;
let segurando = false;
export function marcarToqueLongo() {
  ultimoToqueLongo = Date.now();
  segurando = true;
}
// ao soltar o dedo depois de segurar, o prazo conta de novo a partir dali
export function soltouToque() {
  if (segurando) ultimoToqueLongo = Date.now();
  segurando = false;
}
export function foiToqueLongo() {
  return Date.now() - ultimoToqueLongo < 400;
}

export type Acao = { titulo: string; icone: NomeIcone; acao: () => void; cor?: string };

// Menu que sobe de baixo, aberto pelo toque longo numa linha
export function MenuDeAcoes({
  titulo,
  acoes,
  aoFechar,
}: {
  titulo: string | null;
  acoes: Acao[];
  aoFechar: () => void;
}) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!titulo} transparent animationType="fade" onRequestClose={aoFechar}>
      <Pressable
        style={estilos.fundo}
        onPress={() => {
          if (!foiToqueLongo()) aoFechar();
        }}
        accessibilityLabel="Fechar menu"
      />
      <View
        style={[
          estilos.folha,
          { backgroundColor: tema.superficie, borderColor: tema.borda, paddingBottom: insets.bottom + espaco.g },
        ]}>
        <Texto variante="rotulo" style={{ paddingHorizontal: espaco.g }} numberOfLines={1}>
          {titulo ?? ''}
        </Texto>
        {acoes.map((a) => (
          <Pressable
            key={a.titulo}
            accessibilityRole="button"
            onPress={() => {
              // o mesmo toque que abriu o menu não escolhe uma opção ao soltar
              if (foiToqueLongo()) return;
              aoFechar();
              a.acao();
            }}
            style={({ pressed }) => [estilos.opcao, { backgroundColor: pressed ? tema.superficie2 : 'transparent' }]}>
            <Icone nome={a.icone} cor={a.cor ?? tema.primaria} tamanho={22} />
            <Texto variante="forte" cor={a.cor}>
              {a.titulo}
            </Texto>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const LARGURA_ACAO = 76;

// Deslizar a linha para a esquerda mostra as ações por baixo; tocar numa delas faz e fecha
export function LinhaDeslizavel({ acoes, children }: { acoes: Acao[]; children: ReactNode }) {
  const tema = useTema();
  const largura = acoes.length * LARGURA_ACAO;
  const [x] = useState(() => new Animated.Value(0));
  const [mostrarAcoes, setMostrarAcoes] = useState(false);
  // enquanto arrasta (e logo depois de soltar), a linha não recebe toque: soltar em cima do Paguei não marca nada
  const [arrastando, setArrastando] = useState(false);

  // o gesto e o "está aberta" moram juntos, criados uma vez
  const [{ gesto, ir }] = useState(() => {
    let aberta = false;
    const nativo = Platform.OS !== 'web';
    const ir = (para: number) => {
      aberta = para !== 0;
      if (para !== 0) setMostrarAcoes(true);
      Animated.spring(x, { toValue: para, useNativeDriver: nativo, bounciness: 0, speed: 20 }).start(() => {
        if (para === 0) setMostrarAcoes(false);
      });
    };
    const gesto = PanResponder.create({
      // só pega o gesto quando ele é claramente para o lado, para não atrapalhar a rolagem
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        setMostrarAcoes(true);
        setArrastando(true);
      },
      onPanResponderMove: (_, g) => {
        const base = aberta ? -largura : 0;
        x.setValue(Math.min(0, Math.max(-largura - 20, base + g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        const base = aberta ? -largura : 0;
        ir(base + g.dx < -largura / 3 ? -largura : 0);
        setTimeout(() => setArrastando(false), 250);
      },
      onPanResponderTerminate: () => {
        ir(aberta ? -largura : 0);
        setTimeout(() => setArrastando(false), 250);
      },
    });
    return { gesto, ir };
  });

  return (
    <View style={{ overflow: 'hidden' }}>
      {mostrarAcoes ? (
        <View style={[estilos.acoes, { width: largura }]}>
          {acoes.map((a) => (
            <Pressable
              key={a.titulo}
              accessibilityRole="button"
              onPress={() => {
                ir(0);
                a.acao();
              }}
              style={({ pressed }) => [
                estilos.acao,
                { backgroundColor: a.cor ?? tema.primaria, opacity: pressed ? 0.8 : 1 },
              ]}>
              <Icone nome={a.icone} cor="#FFFFFF" tamanho={20} />
              <Texto variante="suave" cor="#FFFFFF" style={{ fontWeight: '700', fontSize: 11.5 }} numberOfLines={1}>
                {a.titulo}
              </Texto>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Animated.View
        {...gesto.panHandlers}
        style={{ transform: [{ translateX: x }], backgroundColor: tema.superficie }}>
        <View pointerEvents={arrastando ? 'none' : 'auto'}>{children}</View>
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  folha: {
    width: '100%',
    maxWidth: larguraMaxima,
    alignSelf: 'center',
    paddingTop: espaco.g,
    gap: 2,
    borderTopLeftRadius: raio.g + 4,
    borderTopRightRadius: raio.g + 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.g,
    paddingHorizontal: espaco.g,
    paddingVertical: 14,
  },
  acoes: { position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row' },
  acao: { width: LARGURA_ACAO, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4 },
});
