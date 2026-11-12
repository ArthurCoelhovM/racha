import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { Aviso, Botao, Carregando, Cartao, Tela, Texto } from '@/components/ui';
import { useTema } from '@/hooks/use-tema';
import { mensagemDeErro, novoCodigoConvite } from '@/lib/api';
import { chaves, textoDoErro, useCodigo, useGrupo, useMembros } from '@/lib/consultas';
import { meuPapel, pode, quemPode } from '@/lib/permissoes';
import { useSessao } from '@/lib/sessao';
import { urlDoSite } from '@/lib/supabase';

export default function Convite() {
  const tema = useTema();
  const { id, novo } = useLocalSearchParams<{ id: string; novo?: string }>();
  const consulta = useGrupo(id);
  const membros = useMembros(id);
  const { usuarioId } = useSessao();
  const cliente = useQueryClient();
  const grupo = consulta.data;
  const podeConvidar = !!grupo && !!membros.data && pode(grupo, meuPapel(membros.data, usuarioId ?? ''), 'convidar_membros');
  const codigoConsulta = useCodigo(id, podeConvidar);
  const codigo = codigoConsulta.data;
  const erro = textoDoErro(consulta.error ?? membros.error ?? codigoConsulta.error);
  const carregando = (consulta.isPending || membros.isPending || (podeConvidar && codigoConsulta.isPending)) && !erro;
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);
  const [gerando, setGerando] = useState(false);

  if (carregando) return <Carregando />;
  if (!grupo) return <Tela>{erro ? <Aviso texto={erro} /> : null}</Tela>;
  if (!podeConvidar || !codigo) {
    return (
      <Tela>
        {erro ? <Aviso texto={erro} /> : null}
        <Aviso tipo="info" texto={`Neste grupo, convidar pessoas é com ${quemPode(grupo, 'convidar_membros')}.`} />
      </Tela>
    );
  }

  const link = urlDoSite(`/convite/${codigo}`);
  const mensagem = link
    ? `Entra no grupo "${grupo.nome}" no Super Organizador 3021: ${link} (ou use o código ${codigo})`
    : `Entra no grupo "${grupo.nome}" no Super Organizador 3021 com o código ${codigo}`;

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
      const novoCodigo = await novoCodigoConvite(id);
      cliente.setQueryData(chaves.codigo(id), novoCodigo);
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
        <Texto style={[estilos.codigo, { color: grupo.cor }]}>{codigo}</Texto>
        <Texto variante="suave" style={{ textAlign: 'center' }}>
          Quem tiver o app toca em &quot;Entrar com código&quot; e digita esse código.
        </Texto>
      </Cartao>

      {link ? (
        <View style={{ gap: 6 }}>
          <Texto variante="rotulo">Link do convite</Texto>
          <Texto variante="suave" style={{ color: tema.texto }}>
            {link}
          </Texto>
        </View>
      ) : null}

      {aviso ? <Aviso texto={aviso.texto} tipo={aviso.tipo} /> : null}

      {podeCompartilhar ? <Botao titulo="Compartilhar convite" aoPressionar={compartilhar} /> : null}
      <Botao titulo="Copiar código" variante="secundario" aoPressionar={() => copiar(codigo, 'Código')} />
      {link ? <Botao titulo="Copiar link" variante="secundario" aoPressionar={() => copiar(link, 'Link')} /> : null}
      <Botao
        titulo="Gerar código novo"
        variante="texto"
        confirmar="Toque de novo: o código atual vai parar de funcionar"
        aoPressionar={gerarNovo}
        carregando={gerando}
      />
      {novo ? (
        <Botao
          titulo="Ir para o grupo"
          variante="secundario"
          aoPressionar={() => router.replace({ pathname: '/grupo/[id]', params: { id } })}
        />
      ) : null}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  codigo: { fontSize: 44, fontWeight: '900', letterSpacing: 6, fontVariant: ['tabular-nums'] },
});
