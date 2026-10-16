import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { Aviso, Botao, Carregando, Cartao, Tela, Texto } from '@/components/ui';
import { useCarregar } from '@/hooks/use-carregar';
import { useTema } from '@/hooks/use-tema';
import { buscarGrupo, mensagemDeErro, novoCodigoConvite } from '@/lib/api';
import { urlDoSite } from '@/lib/supabase';

export default function Convite() {
  const tema = useTema();
  const { id, novo } = useLocalSearchParams<{ id: string; novo?: string }>();
  const { dados: grupo, erro, carregando, setDados } = useCarregar(() => buscarGrupo(id), id);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);
  const [gerando, setGerando] = useState(false);

  if (carregando) return <Carregando />;
  if (!grupo) return <Tela>{erro ? <Aviso texto={erro} /> : null}</Tela>;

  const link = urlDoSite(`/convite/${grupo.codigo_convite}`);
  const mensagem = link
    ? `Entra no grupo "${grupo.nome}" no Super Organizador 3021: ${link} (ou use o código ${grupo.codigo_convite})`
    : `Entra no grupo "${grupo.nome}" no Super Organizador 3021 com o código ${grupo.codigo_convite}`;

  async function copiar(texto: string, oQue: string) {
    await Clipboard.setStringAsync(texto);
    setAviso({ texto: `${oQue} copiado.`, tipo: 'ok' });
  }

  async function compartilhar() {
    try {
      await Share.share({ message: mensagem });
    } catch {
      await copiar(mensagem, 'Convite');
    }
  }

  async function gerarNovo() {
    if (!grupo) return;
    setGerando(true);
    try {
      const codigo = await novoCodigoConvite(id);
      setDados({ ...grupo, codigo_convite: codigo });
      setAviso({ texto: 'Código novo gerado. O antigo parou de funcionar.', tipo: 'ok' });
    } catch (e) {
      setAviso({ texto: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      setGerando(false);
    }
  }

  const podeCompartilhar = Platform.OS !== 'web' || (typeof navigator !== 'undefined' && 'share' in navigator);

  return (
    <Tela>
      {novo ? <Aviso tipo="ok" texto={`Grupo "${grupo.nome}" criado. Agora chame as pessoas.`} /> : null}

      <Cartao style={{ alignItems: 'center', paddingVertical: 28 }}>
        <Texto variante="rotulo">Código do grupo</Texto>
        <Texto style={[estilos.codigo, { color: grupo.cor }]}>{grupo.codigo_convite}</Texto>
        <Texto variante="suave" style={{ textAlign: 'center' }}>
          Quem tiver o app toca em &quot;Entrar com código&quot; e digita esse código.
        </Texto>
      </Cartao>

      {link ? (
        <View style={{ gap: 6 }}>
          <Texto variante="rotulo">Link do convite</Texto>
          <Texto variante="suave" style={{ color: tema.texto }}>{link}</Texto>
        </View>
      ) : null}

      {aviso ? <Aviso texto={aviso.texto} tipo={aviso.tipo} /> : null}

      {podeCompartilhar ? <Botao titulo="Compartilhar convite" aoPressionar={compartilhar} /> : null}
      <Botao titulo="Copiar código" variante="secundario" aoPressionar={() => copiar(grupo.codigo_convite, 'Código')} />
      {link ? <Botao titulo="Copiar link" variante="secundario" aoPressionar={() => copiar(link, 'Link')} /> : null}
      <Botao
        titulo="Gerar código novo"
        variante="texto"
        confirmar="Toque de novo: o código atual vai parar de funcionar"
        aoPressionar={gerarNovo}
        carregando={gerando}
      />
      {novo ? (
        <Botao titulo="Ir para o grupo" variante="secundario" aoPressionar={() => router.replace({ pathname: '/grupo/[id]', params: { id } })} />
      ) : null}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  codigo: { fontSize: 44, fontWeight: '900', letterSpacing: 6, fontVariant: ['tabular-nums'] },
});
