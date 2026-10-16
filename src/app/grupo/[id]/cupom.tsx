import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { LeitorQr } from '@/components/leitor-qr';
import { Aviso, Botao, Campo, Cartao, Tela, Texto } from '@/components/ui';
import { useTema } from '@/hooks/use-tema';
import { lerNotaFiscal, mensagemDeErro } from '@/lib/api';
import { guardarNota, validarUrlNfce } from '@/lib/cupom';

const hostsExtras = (process.env.EXPO_PUBLIC_NFCE_HOSTS_EXTRAS ?? '').split(',').filter(Boolean);

export default function LerCupom() {
  const tema = useTema();
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const ocupado = useRef(false);

  async function processar(texto: string) {
    if (ocupado.current) return;
    const url = validarUrlNfce(texto, hostsExtras);
    if (!url) {
      setErro('Esse QR code não é de uma NFC-e. Use o QR code que fica no rodapé do cupom fiscal.');
      return;
    }
    ocupado.current = true;
    setBuscando(true);
    setErro(null);
    try {
      const nota = await lerNotaFiscal(url);
      guardarNota(nota);
      router.back();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setBuscando(false);
      ocupado.current = false;
    }
  }

  return (
    <Tela>
      <Texto>Aponte a câmera para o QR code no rodapé do cupom. Os produtos da nota viram itens do gasto.</Texto>

      {buscando ? (
        <Cartao style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
          <ActivityIndicator color={tema.primaria} size="large" />
          <Texto>Buscando a nota no site da Sefaz…</Texto>
        </Cartao>
      ) : (
        <LeitorQr aoLer={processar} />
      )}

      {erro ? <Aviso texto={erro} /> : null}

      <View style={{ gap: 8 }}>
        <Campo
          rotulo="Ou cole o link da nota"
          value={link}
          onChangeText={setLink}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://www.sefaz..."
          onSubmitEditing={() => processar(link)}
        />
        <Botao
          titulo="Buscar nota"
          variante="secundario"
          aoPressionar={() => processar(link)}
          desabilitado={!link.trim() || buscando}
        />
      </View>
    </Tela>
  );
}
