import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QrCode } from '@/components/pix/qr';
import { Aviso, Botao, Icone, Linha, Texto } from '@/components/ui';
import { espaco, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { textoDoErro, useChavePixDe } from '@/lib/consultas';
import { reais, valorACobrar, type Decimal } from '@/lib/dinheiro';
import { chaveParaMostrar, codigoPix } from '@/lib/pix';
import { vibrarSucesso } from '@/lib/toque';

// Folha que abre por cima da tela: chave e "copia e cola" para o banco, e o QR para outro celular ler
export function PagarComPix({
  credor,
  nomeCredor,
  valor,
  aoFechar,
  aoMarcarPago,
}: {
  credor: string | null;
  nomeCredor: string;
  valor: Decimal;
  aoFechar: () => void;
  aoMarcarPago: () => void;
}) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const chave = useChavePixDe(credor);
  const [copiado, setCopiado] = useState<'chave' | 'codigo' | null>(null);
  const cobrar = valorACobrar(valor);
  const dados = chave.data;
  const codigo = dados?.chave ? codigoPix({ chave: dados.chave, nome: dados.nome || nomeCredor, valor: cobrar }) : null;

  async function copiar(texto: string, qual: 'chave' | 'codigo') {
    await Clipboard.setStringAsync(texto);
    vibrarSucesso();
    setCopiado(qual);
  }

  return (
    <Modal visible={!!credor} transparent animationType="slide" onRequestClose={aoFechar}>
      <Pressable style={estilos.fundo} onPress={aoFechar} accessibilityLabel="Fechar" />
      <View
        style={[
          estilos.folha,
          { backgroundColor: tema.superficie, paddingBottom: insets.bottom + espaco.g, borderColor: tema.borda },
        ]}>
        <ScrollView contentContainerStyle={{ gap: espaco.g, padding: espaco.xg }}>
          <Linha style={{ justifyContent: 'space-between' }}>
            <Texto variante="rotulo">Pagar com Pix</Texto>
            <Pressable onPress={aoFechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
              <Icone nome="close" cor={tema.textoSuave} />
            </Pressable>
          </Linha>
          <View style={{ gap: 2 }}>
            <Texto variante="suave">Para {nomeCredor}</Texto>
            <Texto variante="grande">{reais(cobrar)}</Texto>
          </View>

          {chave.isPending ? <Texto variante="suave">Buscando a chave…</Texto> : null}
          {chave.error ? <Aviso texto={textoDoErro(chave.error)!} /> : null}

          {dados && !dados.chave ? (
            <Aviso
              tipo="info"
              texto={`${nomeCredor} ainda não cadastrou a chave Pix. Peça para cadastrar em Sua conta; depois disso o código aparece aqui.`}
            />
          ) : null}

          {dados?.chave && codigo ? (
            <>
              <View style={[estilos.qr, { borderColor: tema.borda }]}>
                <QrCode texto={codigo} />
                <Texto variante="suave" cor="#5F627A" style={{ textAlign: 'center' }}>
                  Leia com o app do banco em outro celular
                </Texto>
              </View>
              <Botao
                titulo={copiado === 'codigo' ? 'Copiado! Cole no app do banco' : 'Copiar Pix copia e cola'}
                aoPressionar={() => copiar(codigo, 'codigo')}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => copiar(dados.chave!, 'chave')}
                style={({ pressed }) => [
                  estilos.chave,
                  { backgroundColor: tema.superficie2, opacity: pressed ? 0.8 : 1 },
                ]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Texto variante="suave">Chave de {nomeCredor}</Texto>
                  <Texto variante="forte" numberOfLines={1}>
                    {chaveParaMostrar(dados.chave)}
                  </Texto>
                </View>
                <Texto variante="forte" cor={tema.primaria}>
                  {copiado === 'chave' ? 'Copiada' : 'Copiar'}
                </Texto>
              </Pressable>
            </>
          ) : null}

          <Botao
            titulo="Já paguei: marcar como pago"
            variante="secundario"
            aoPressionar={() => {
              aoMarcarPago();
              aoFechar();
            }}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  folha: {
    maxHeight: '90%',
    borderTopLeftRadius: raio.g + 4,
    borderTopRightRadius: raio.g + 4,
    borderWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  qr: {
    alignItems: 'center',
    gap: espaco.m,
    padding: espaco.g,
    borderRadius: raio.g,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  chave: { flexDirection: 'row', alignItems: 'center', gap: espaco.m, padding: 14, borderRadius: raio.m },
});
