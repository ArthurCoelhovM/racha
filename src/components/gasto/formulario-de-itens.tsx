import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  Avatar,
  Botao,
  Campo,
  CampoDinheiro,
  Cartao,
  Ficha,
  Fichas,
  Icone,
  Linha,
  Separador,
  Texto,
} from '@/components/ui';
import { espaco } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { lerValor, reais } from '@/lib/dinheiro';
import type { Item, Membro } from '@/lib/tipos';

import { alternar, estilosGasto } from './partes';

export function novoItem(membros: string[]): Item {
  return { descricao: '', valor: '', participantes: membros };
}

// Uma linha por item (nome, valor e as iniciais de quem participa); tocar abre a edição.
// Um cupom de mercado com 30 itens continua cabendo na tela.
export function FormularioDeItens({
  itens,
  membros,
  ativos,
  nome,
  aoMudar,
}: {
  itens: Item[];
  membros: Membro[];
  ativos: string[];
  nome: (u: string) => string;
  aoMudar: (itens: Item[]) => void;
}) {
  const tema = useTema();
  // começa aberto só o item vazio de um gasto novo
  const [aberto, setAberto] = useState<number | null>(() =>
    itens.length === 1 && !itens[0].descricao && !itens[0].valor ? 0 : null,
  );

  function mudarItem(indice: number, mudanca: Partial<Item>) {
    aoMudar(itens.map((item, i) => (i === indice ? { ...item, ...mudanca } : item)));
  }

  function remover(indice: number) {
    aoMudar(itens.filter((_, j) => j !== indice));
    setAberto(null);
  }

  return (
    <View style={{ gap: espaco.m }}>
      <Cartao style={{ padding: 0, gap: 0 }}>
        {itens.map((item, i) => {
          const valor = lerValor(item.valor);
          return (
            <View key={i}>
              {i > 0 ? <Separador /> : null}
              {aberto === i ? (
                <View style={{ padding: espaco.g, gap: espaco.m }}>
                  <Campo
                    value={item.descricao}
                    onChangeText={(t) => mudarItem(i, { descricao: t })}
                    placeholder={`Item ${i + 1}`}
                    accessibilityLabel={`Item ${i + 1}`}
                  />
                  <Linha style={{ alignItems: 'flex-start' }}>
                    <CampoDinheiro
                      value={item.valor}
                      onChangeText={(t) => mudarItem(i, { valor: t })}
                      accessibilityLabel={`Valor do item ${i + 1}`}
                      style={estilosGasto.campoPequeno}
                    />
                    <View style={{ flex: 1 }}>
                      <Fichas>
                        {membros.map((m) => (
                          <Ficha
                            key={m.usuario_id}
                            rotulo={nome(m.usuario_id)}
                            selecionada={item.participantes.includes(m.usuario_id)}
                            aoPressionar={() =>
                              mudarItem(i, { participantes: alternar(item.participantes, m.usuario_id) })
                            }
                          />
                        ))}
                      </Fichas>
                    </View>
                  </Linha>
                  <Linha style={{ justifyContent: 'space-between' }}>
                    {itens.length > 1 ? (
                      <Botao titulo="Remover item" variante="texto" pequeno aoPressionar={() => remover(i)} />
                    ) : (
                      <View />
                    )}
                    <Botao titulo="Pronto" variante="secundario" pequeno aoPressionar={() => setAberto(null)} />
                  </Linha>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Editar ${item.descricao || `item ${i + 1}`}`}
                  onPress={() => setAberto(i)}
                  style={({ pressed }) => [estilos.linha, { opacity: pressed ? 0.7 : 1 }]}>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Texto variante="forte" numberOfLines={1}>
                      {item.descricao || `Item ${i + 1}`}
                    </Texto>
                    <Linha style={{ gap: 2 }}>
                      {item.participantes.length === 0 ? (
                        <Texto variante="suave" cor={tema.negativo}>
                          ninguém escolhido
                        </Texto>
                      ) : (
                        item.participantes.map((u) => <Avatar key={u} id={u} nome={nome(u)} tamanho={20} />)
                      )}
                    </Linha>
                  </View>
                  <Texto variante="forte" cor={valor ? tema.texto : tema.negativo}>
                    {valor ? reais(valor) : 'sem valor'}
                  </Texto>
                  <Icone nome="create-outline" tamanho={18} cor={tema.textoSuave} />
                </Pressable>
              )}
            </View>
          );
        })}
      </Cartao>
      <Botao
        titulo="+ Adicionar item"
        variante="secundario"
        aoPressionar={() => {
          aoMudar([...itens, novoItem(ativos)]);
          setAberto(itens.length);
        }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingHorizontal: espaco.g,
    paddingVertical: 12,
  },
});
