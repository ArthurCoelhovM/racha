import { View } from 'react-native';

import { Cartao, Separador, Texto } from '@/components/ui';
import { espaco } from '@/constants/tema';
import { dec, reais } from '@/lib/dinheiro';
import { isoParaBr } from '@/lib/formatos';
import { TIPOS_DIVISAO, type Gasto } from '@/lib/tipos';

import { LinhaPessoa, Secao } from './partes';

// Gasto de outra pessoa quando o grupo não deixa você editar: só leitura
export function DetalheDoGasto({ gasto, nome }: { gasto: Gasto; nome: (u: string) => string }) {
  const tipo = TIPOS_DIVISAO.find((t) => t.tipo === gasto.tipo_divisao)?.nome ?? gasto.tipo_divisao;
  return (
    <>
      <Cartao>
        <Texto variante="titulo">{gasto.descricao}</Texto>
        <Texto variante="grande">{reais(dec(gasto.valor_total))}</Texto>
        <Texto variante="suave">
          {isoParaBr(gasto.data)} · divisão {tipo.toLowerCase()} · registrado por {nome(gasto.criado_por)}
        </Texto>
      </Cartao>
      <Secao titulo="Quem pagou">
        <Cartao>
          {gasto.pagadores.map((p) => (
            <LinhaPessoa key={p.usuario_id} id={p.usuario_id} nome={nome(p.usuario_id)}>
              <Texto variante="forte">{reais(p.valor)}</Texto>
            </LinhaPessoa>
          ))}
        </Cartao>
      </Secao>
      <Secao titulo="Partes">
        <Cartao>
          {gasto.divisoes.map((d, i) => (
            <View key={d.usuario_id} style={{ gap: espaco.m }}>
              {i > 0 ? <Separador /> : null}
              <LinhaPessoa id={d.usuario_id} nome={nome(d.usuario_id)}>
                <Texto variante="forte">{reais(d.valor)}</Texto>
              </LinhaPessoa>
            </View>
          ))}
        </Cartao>
      </Secao>
      {gasto.itens && gasto.itens.length > 0 ? (
        <Secao titulo="Itens">
          <Cartao>
            {gasto.itens.map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espaco.m }}>
                <Texto style={{ flex: 1 }}>{item.descricao || `Item ${i + 1}`}</Texto>
                <Texto variante="forte">{reais(item.valor)}</Texto>
              </View>
            ))}
          </Cartao>
        </Secao>
      ) : null}
    </>
  );
}
