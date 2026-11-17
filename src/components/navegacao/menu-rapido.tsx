import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icone, Texto, type NomeIcone } from '@/components/ui';
import { espaco, larguraMaxima, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { useInicio } from '@/lib/consultas';
import { ultimoGrupo } from '@/lib/ultimo-grupo';

type Opcao = { titulo: string; texto: string; icone: NomeIcone; acao: () => void };

// O + da barra: gasto (já no último grupo usado), pagamento, cupom e grupo novo
export function MenuRapido({ visivel, aoFechar }: { visivel: boolean; aoFechar: () => void }) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const grupos = useInicio().data?.grupos ?? [];
  const ativos = grupos.filter((g) => !g.arquivado);
  const lista = ativos.length ? ativos : grupos;
  const ultimo = ultimoGrupo();
  const grupo = lista.find((g) => g.grupo_id === ultimo) ?? lista[0];

  function ir(acao: () => void) {
    aoFechar();
    acao();
  }

  const opcoes: Opcao[] = grupo
    ? [
        {
          titulo: 'Gasto',
          texto: `Em ${grupo.nome}; dá para trocar o grupo lá dentro`,
          icone: 'cart-outline',
          acao: () => router.push({ pathname: '/grupo/[id]/gasto', params: { id: grupo.grupo_id, escolher: '1' } }),
        },
        {
          titulo: 'Pagamento',
          texto: 'Paguei ou recebi de alguém, no todo ou em parte',
          icone: 'swap-horizontal-outline',
          acao: () => router.push({ pathname: '/pagamento', params: { grupo: grupo.grupo_id } }),
        },
        {
          titulo: 'Ler cupom fiscal',
          texto: 'O QR code da nota vira um gasto com os itens',
          icone: 'qr-code-outline',
          acao: () =>
            router.push({ pathname: '/grupo/[id]/gasto', params: { id: grupo.grupo_id, escolher: '1', cupom: '1' } }),
        },
        {
          titulo: 'Novo grupo',
          texto: 'Casa, viagem, mercado…',
          icone: 'people-outline',
          acao: () => router.push('/grupo/novo'),
        },
      ]
    : [
        {
          titulo: 'Novo grupo',
          texto: 'Casa, viagem, mercado…',
          icone: 'people-outline',
          acao: () => router.push('/grupo/novo'),
        },
        {
          titulo: 'Entrar com código',
          texto: 'Alguém te mandou um convite',
          icone: 'enter-outline',
          acao: () => router.push('/entrar-grupo'),
        },
      ];

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={aoFechar}>
      <Pressable style={estilos.fundo} onPress={aoFechar} accessibilityLabel="Fechar menu" />
      <View
        style={[
          estilos.folha,
          { backgroundColor: tema.superficie, borderColor: tema.borda, paddingBottom: insets.bottom + espaco.g },
        ]}>
        <Texto variante="rotulo" style={{ paddingHorizontal: espaco.g }}>
          Adicionar
        </Texto>
        {opcoes.map((o) => (
          <Pressable
            key={o.titulo}
            accessibilityRole="button"
            onPress={() => ir(o.acao)}
            style={({ pressed }) => [estilos.opcao, { backgroundColor: pressed ? tema.superficie2 : 'transparent' }]}>
            <View style={[estilos.icone, { backgroundColor: tema.superficie2 }]}>
              <Icone nome={o.icone} cor={tema.primaria} tamanho={22} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Texto variante="forte">{o.titulo}</Texto>
              <Texto variante="suave" numberOfLines={1}>
                {o.texto}
              </Texto>
            </View>
          </Pressable>
        ))}
      </View>
    </Modal>
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
    gap: espaco.m + 6,
    paddingHorizontal: espaco.g,
    paddingVertical: 12,
  },
  icone: { width: 44, height: 44, borderRadius: raio.m, alignItems: 'center', justifyContent: 'center' },
});
