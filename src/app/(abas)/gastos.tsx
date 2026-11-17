import { router } from 'expo-router';

import { GastosPorData, LinhaGasto } from '@/components/grupo/lista-de-gastos';
import { Aviso, Botao, Esqueleto, Tela, Vazio } from '@/components/ui';
import { textoDoErro, useAtualizarAoFocar, useMeusGastos, useNomesConhecidos, usePuxar } from '@/lib/consultas';
import { useSessao } from '@/lib/sessao';

// Os gastos de todos os seus grupos juntos, do mais novo ao mais velho
export default function TodosOsGastos() {
  const { usuarioId } = useSessao();
  const eu = usuarioId ?? '';
  const gastos = useMeusGastos();
  const nomes = useNomesConhecidos();
  const recarregar = gastos.refetch;
  const { puxando, puxar } = usePuxar(recarregar);
  useAtualizarAoFocar(recarregar);

  const lista = gastos.data?.pages.flat() ?? [];
  const erro = textoDoErro(gastos.error);
  const nome = (u: string) => (u === eu ? 'Você' : (nomes.data?.get(u) ?? 'Alguém'));

  return (
    <Tela aoAtualizar={puxar} atualizando={puxando}>
      {erro ? <Aviso texto={erro} acao="Tentar de novo" aoAcionar={() => recarregar()} /> : null}
      {gastos.isPending && !erro ? <Esqueleto comResumo={false} /> : null}
      {!gastos.isPending && lista.length === 0 && !erro ? (
        <Vazio titulo="Nenhum gasto ainda" texto="Toque no + aqui embaixo para registrar o primeiro." />
      ) : null}

      <GastosPorData
        gastos={lista}
        linha={(g) => (
          <LinhaGasto
            g={g}
            eu={eu}
            nome={nome}
            pago={false}
            grupo={g.grupo}
            aoAbrir={() => router.push({ pathname: '/grupo/[id]/gasto', params: { id: g.grupo_id, gastoId: g.id } })}
          />
        )}
      />

      {gastos.hasNextPage ? (
        <Botao
          titulo="Ver mais gastos"
          variante="texto"
          carregando={gastos.isFetchingNextPage}
          aoPressionar={() => gastos.fetchNextPage()}
        />
      ) : null}
    </Tela>
  );
}
