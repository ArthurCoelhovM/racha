import { View } from 'react-native';

import { Botao, Campo, CampoDinheiro, Cartao, Ficha, Fichas, Linha } from '@/components/ui';
import { espaco } from '@/constants/tema';
import type { Item, Membro } from '@/lib/tipos';

import { alternar, estilosGasto } from './partes';

export function novoItem(membros: string[]): Item {
  return { descricao: '', valor: '', participantes: membros };
}

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
  function mudarItem(indice: number, mudanca: Partial<Item>) {
    aoMudar(itens.map((item, i) => (i === indice ? { ...item, ...mudanca } : item)));
  }

  return (
    <View style={{ gap: espaco.m }}>
      {itens.map((item, i) => (
        <Cartao key={i}>
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
                    aoPressionar={() => mudarItem(i, { participantes: alternar(item.participantes, m.usuario_id) })}
                  />
                ))}
              </Fichas>
            </View>
          </Linha>
          {itens.length > 1 ? (
            <Botao
              titulo="Remover item"
              variante="texto"
              pequeno
              aoPressionar={() => aoMudar(itens.filter((_, j) => j !== i))}
              style={{ alignSelf: 'flex-start' }}
            />
          ) : null}
        </Cartao>
      ))}
      <Botao titulo="+ Adicionar item" variante="secundario" aoPressionar={() => aoMudar([...itens, novoItem(ativos)])} />
    </View>
  );
}
