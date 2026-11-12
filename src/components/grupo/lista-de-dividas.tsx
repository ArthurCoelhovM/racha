import { StyleSheet, View } from 'react-native';

import { Avatar, Botao, Cartao, Linha, Separador, Texto, Vazio } from '@/components/ui';
import { espaco } from '@/constants/tema';
import { ehExato, reais, reaisExato } from '@/lib/dinheiro';
import { diaCurto } from '@/lib/formatos';
import type { Pendencia } from '@/lib/saldos';

export function ListaDeDividas({
  pendencias,
  eu,
  nome,
  marcando,
  aoPagar,
}: {
  pendencias: Pendencia[];
  eu: string;
  nome: (u: string) => string;
  marcando: string | null;
  aoPagar: (p: Pendencia) => void;
}) {
  if (pendencias.length === 0) {
    return <Vazio titulo="Ninguém deve nada" texto="Quando alguém registrar um gasto, as dívidas aparecem aqui." />;
  }
  return (
    <Cartao style={{ padding: 0, gap: 0 }}>
      {pendencias.map((p, i) => (
        <View key={p.chave}>
          {i > 0 ? <Separador /> : null}
          <LinhaPendencia
            p={p}
            nome={nome}
            euParticipo={p.devedor === eu || p.credor === eu}
            carregando={marcando === p.chave}
            aoPagar={() => aoPagar(p)}
          />
        </View>
      ))}
    </Cartao>
  );
}

function LinhaPendencia({
  p,
  nome,
  euParticipo,
  carregando,
  aoPagar,
}: {
  p: Pendencia;
  nome: (u: string) => string;
  euParticipo: boolean;
  carregando: boolean;
  aoPagar: () => void;
}) {
  const exato = ehExato(p.valor);
  return (
    <View style={estilos.linha}>
      <Linha>
        <Avatar id={p.devedor} nome={nome(p.devedor)} />
        <Texto variante="suave">→</Texto>
        <Avatar id={p.credor} nome={nome(p.credor)} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Texto variante="forte" numberOfLines={2}>
            {nome(p.devedor)} deve a {nome(p.credor) === 'Você' ? 'você' : nome(p.credor)}
          </Texto>
          {p.descricao ? (
            <Texto variante="suave" numberOfLines={1}>
              {p.descricao}
              {p.data ? ` · ${diaCurto(p.data)}` : ''}
            </Texto>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Texto variante="subtitulo">{reais(p.cobrar)}</Texto>
          {!exato ? <Texto variante="suave">exato {reaisExato(p.valor)}</Texto> : null}
        </View>
      </Linha>
      {euParticipo ? (
        <Botao
          pequeno
          variante="secundario"
          titulo={nome(p.devedor) === 'Você' ? 'Marcar que paguei' : 'Marcar que recebi'}
          aoPressionar={aoPagar}
          carregando={carregando}
          style={{ alignSelf: 'flex-end' }}
        />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { padding: espaco.g, gap: espaco.m },
});
