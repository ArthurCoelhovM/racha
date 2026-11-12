import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Aviso, Botao, Linha, Texto } from '@/components/ui';
import { raio } from '@/constants/tema';
import { enviarComprovante, mensagemDeErro, urlDoComprovante } from '@/lib/api';

// Foto do comprovante: fica no Supabase Storage e só quem é do grupo consegue abrir
export function Comprovante({
  grupoId,
  caminho,
  podeMudar,
  aoMudar,
}: {
  grupoId: string;
  caminho: string | null;
  podeMudar: boolean;
  aoMudar: (caminho: string | null) => void;
}) {
  // a url assinada vale para o caminho que a gerou; trocou a foto, espera a nova
  const [assinada, setAssinada] = useState<{ caminho: string; url: string } | null>(null);
  const url = assinada && assinada.caminho === caminho ? assinada.url : null;
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ampliada, setAmpliada] = useState(false);

  useEffect(() => {
    let valendo = true;
    if (!caminho) return;
    urlDoComprovante(caminho)
      .then((u) => valendo && setAssinada({ caminho, url: u }))
      .catch((e) => valendo && setErro(mensagemDeErro(e)));
    return () => {
      valendo = false;
    };
  }, [caminho]);

  async function escolher(camera: boolean) {
    setErro(null);
    try {
      if (camera) {
        const permissao = await ImagePicker.requestCameraPermissionsAsync();
        if (!permissao.granted) {
          setErro('Sem permissão para usar a câmera.');
          return;
        }
      }
      const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, allowsEditing: false };
      const resultado = camera
        ? await ImagePicker.launchCameraAsync(opcoes)
        : await ImagePicker.launchImageLibraryAsync(opcoes);
      if (resultado.canceled || !resultado.assets[0]) return;
      const foto = resultado.assets[0];
      setEnviando(true);
      aoMudar(await enviarComprovante(grupoId, foto.uri, foto.mimeType ?? 'image/jpeg'));
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  if (!caminho && !podeMudar) return null;

  return (
    <View style={{ gap: 6 }}>
      <Texto variante="rotulo">Comprovante</Texto>
      {erro ? <Aviso texto={erro} /> : null}
      {caminho ? (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel="Ver o comprovante"
          onPress={() => setAmpliada(!ampliada)}>
          {url ? (
            <Image source={{ uri: url }} style={[estilos.foto, ampliada && estilos.ampliada]} contentFit="contain" />
          ) : (
            <View style={estilos.foto} />
          )}
        </Pressable>
      ) : null}
      {podeMudar ? (
        <Linha style={{ gap: 8, flexWrap: 'wrap' }}>
          <Botao
            pequeno
            variante="secundario"
            titulo={caminho ? 'Trocar foto' : 'Tirar foto'}
            carregando={enviando}
            aoPressionar={() => escolher(true)}
          />
          <Botao pequeno variante="secundario" titulo="Escolher da galeria" aoPressionar={() => escolher(false)} />
          {caminho ? (
            <Botao pequeno variante="texto" titulo="Tirar o comprovante" aoPressionar={() => aoMudar(null)} />
          ) : null}
        </Linha>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  foto: { width: '100%', height: 160, borderRadius: raio.m, backgroundColor: '#0002' },
  ampliada: { height: 480 },
});
