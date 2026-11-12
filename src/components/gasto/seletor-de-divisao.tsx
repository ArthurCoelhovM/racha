import { Campo, CampoDinheiro, Cartao, Ficha, Fichas, Linha, Texto } from '@/components/ui';
import { Decimal, lerValor } from '@/lib/dinheiro';
import { TIPOS_DIVISAO, type Item, type Membro, type TipoDivisao } from '@/lib/tipos';

import { FormularioDeItens } from './formulario-de-itens';
import { alternar, BotaoRedondo, estilosGasto, LinhaPessoa, Secao } from './partes';

export type EstadoDivisao = {
  tipo: TipoDivisao;
  selecionados: string[];
  valores: Record<string, string>;
  porcentagens: Record<string, string>;
  cotas: Record<string, string>;
  itens: Item[];
};

export function SeletorDeDivisao({
  estado,
  permitidos,
  cor,
  membros,
  ativos,
  nome,
  aoMudar,
}: {
  estado: EstadoDivisao;
  permitidos: TipoDivisao[];
  cor: string;
  membros: Membro[];
  ativos: string[];
  nome: (u: string) => string;
  aoMudar: (mudanca: Partial<EstadoDivisao>) => void;
}) {
  const { tipo, selecionados, valores, porcentagens, cotas, itens } = estado;
  const ids = membros.map((m) => m.usuario_id);
  const dica = TIPOS_DIVISAO.find((t) => t.tipo === tipo)?.dica;

  function mudarCota(u: string, delta: number) {
    const atual = lerValor(cotas[u] ?? '0') ?? new Decimal(0);
    const novo = Decimal.max(0, atual.plus(delta));
    aoMudar({ cotas: { ...cotas, [u]: novo.toString().replace('.', ',') } });
  }

  return (
    <Secao titulo="Como dividir">
      <Fichas>
        {TIPOS_DIVISAO.filter((t) => permitidos.includes(t.tipo)).map((t) => (
          <Ficha
            key={t.tipo}
            rotulo={t.nome}
            selecionada={tipo === t.tipo}
            aoPressionar={() => aoMudar({ tipo: t.tipo })}
            cor={cor}
          />
        ))}
      </Fichas>
      {dica ? <Texto variante="suave">{dica}</Texto> : null}

      {tipo === 'igual' ? (
        <Fichas>
          {membros.map((m) => (
            <Ficha
              key={m.usuario_id}
              rotulo={nome(m.usuario_id)}
              selecionada={selecionados.includes(m.usuario_id)}
              aoPressionar={() => aoMudar({ selecionados: alternar(selecionados, m.usuario_id) })}
            />
          ))}
          <Ficha
            rotulo="Todos"
            selecionada={selecionados.length === ids.length}
            aoPressionar={() => aoMudar({ selecionados: selecionados.length === ids.length ? [] : ids })}
          />
        </Fichas>
      ) : null}

      {tipo === 'exato' ? (
        <Cartao>
          {membros.map((m) => (
            <LinhaPessoa key={m.usuario_id} id={m.usuario_id} nome={nome(m.usuario_id)}>
              <CampoDinheiro
                value={valores[m.usuario_id] ?? ''}
                onChangeText={(t) => aoMudar({ valores: { ...valores, [m.usuario_id]: t } })}
                accessibilityLabel={`Parte de ${nome(m.usuario_id)}`}
                style={estilosGasto.campoPequeno}
              />
            </LinhaPessoa>
          ))}
        </Cartao>
      ) : null}

      {tipo === 'porcentagem' ? (
        <Cartao>
          {membros.map((m) => (
            <LinhaPessoa key={m.usuario_id} id={m.usuario_id} nome={nome(m.usuario_id)}>
              <Campo
                value={porcentagens[m.usuario_id] ?? ''}
                onChangeText={(t) => aoMudar({ porcentagens: { ...porcentagens, [m.usuario_id]: t } })}
                keyboardType="decimal-pad"
                placeholder="0 %"
                accessibilityLabel={`Porcentagem de ${nome(m.usuario_id)}`}
                style={estilosGasto.campoPequeno}
              />
            </LinhaPessoa>
          ))}
        </Cartao>
      ) : null}

      {tipo === 'cotas' ? (
        <Cartao>
          {membros.map((m) => (
            <LinhaPessoa key={m.usuario_id} id={m.usuario_id} nome={nome(m.usuario_id)}>
              <Linha style={{ gap: 6 }}>
                <BotaoRedondo rotulo="−" aoPressionar={() => mudarCota(m.usuario_id, -1)} />
                <Campo
                  value={cotas[m.usuario_id] ?? ''}
                  onChangeText={(t) => aoMudar({ cotas: { ...cotas, [m.usuario_id]: t } })}
                  keyboardType="decimal-pad"
                  style={[estilosGasto.campoPequeno, { width: 64, textAlign: 'center' }]}
                />
                <BotaoRedondo rotulo="+" aoPressionar={() => mudarCota(m.usuario_id, 1)} />
              </Linha>
            </LinhaPessoa>
          ))}
        </Cartao>
      ) : null}

      {tipo === 'itens' ? (
        <FormularioDeItens
          itens={itens}
          membros={membros}
          ativos={ativos}
          nome={nome}
          aoMudar={(i) => aoMudar({ itens: i })}
        />
      ) : null}
    </Secao>
  );
}
