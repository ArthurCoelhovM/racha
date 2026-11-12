import { Cartao, Ficha, Fichas, Interruptor, Texto } from '@/components/ui';
import { isoParaBr } from '@/lib/formatos';
import type { Frequencia } from '@/lib/tipos';

export function RepetirGasto({
  valorVariavel,
  aoMudarVariavel,
  repetir,
  frequencia,
  proximaData,
  aoMudarRepetir,
  aoMudarFrequencia,
}: {
  valorVariavel: boolean;
  aoMudarVariavel: (v: boolean) => void;
  repetir: boolean;
  frequencia: Frequencia;
  proximaData: string | null;
  aoMudarRepetir: (v: boolean) => void;
  aoMudarFrequencia: (f: Frequencia) => void;
}) {
  return (
    <Cartao>
      <Interruptor
        titulo="Repetir este gasto"
        descricao="Bom para aluguel, luz e internet. Dá para editar o valor de cada lançamento depois."
        valor={repetir}
        aoMudar={aoMudarRepetir}
      />
      {repetir ? (
        <>
          <Fichas>
            <Ficha
              rotulo="Todo mês"
              selecionada={frequencia === 'mensal'}
              aoPressionar={() => aoMudarFrequencia('mensal')}
            />
            <Ficha
              rotulo="Toda semana"
              selecionada={frequencia === 'semanal'}
              aoPressionar={() => aoMudarFrequencia('semanal')}
            />
          </Fichas>
          <Interruptor
            titulo="O valor muda todo mês"
            descricao="Para luz e água: no dia, o app avisa quem pagou para preencher o valor da conta."
            valor={valorVariavel}
            aoMudar={aoMudarVariavel}
          />
          {proximaData ? (
            <Texto variante="suave">
              {valorVariavel ? 'Próximo aviso em' : 'Próximo lançamento em'} {isoParaBr(proximaData)}.
            </Texto>
          ) : null}
        </>
      ) : null}
    </Cartao>
  );
}
