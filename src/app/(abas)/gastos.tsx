import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { GastosPorData, LinhaGastoComAcoes } from '@/components/grupo/lista-de-gastos';
import { Aviso, Botao, Campo, Esqueleto, Tela, Vazio } from '@/components/ui';
import type { GastoComGrupo } from '@/lib/api';
import {
  textoDoErro,
  useAtualizarAoFocar,
  useBuscaGeral,
  useMeusGastos,
  useNomesConhecidos,
  usePuxar,
} from '@/lib/consultas';
import { useSessao } from '@/lib/sessao';

// Os gastos de todos os seus grupos juntos, do mais novo ao mais velho, com uma busca que olha em todos
export default function TodosOsGastos() {
  const { usuarioId } = useSessao();
  const eu = usuarioId ?? '';
  const gastos = useMeusGastos();
  const nomes = useNomesConhecidos();
  const recarregar = gastos.refetch;
  const { puxando, puxar } = usePuxar(recarregar);
  useAtualizarAoFocar(recarregar);

  // espera a pessoa parar de digitar antes de buscar
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setBusca(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);
  const buscando = busca.length >= 2;
  const resultado = useBuscaGeral(busca);

  const lista: GastoComGrupo[] = buscando ? (resultado.data ?? []) : (gastos.data?.pages.flat() ?? []);
  const erro = textoDoErro(buscando ? resultado.error : gastos.error);
  const carregando = buscando ? resultado.isPending : gastos.isPending;
  const nome = (u: string) => (u === eu ? 'Você' : (nomes.data?.get(u) ?? 'Alguém'));

  return (
    <Tela aoAtualizar={puxar} atualizando={puxando}>
      <Campo
        value={texto}
        onChangeText={setTexto}
        placeholder="Buscar em todos os grupos (ex.: pizza, café)"
        accessibilityLabel="Buscar em todos os grupos"
        returnKeyType="search"
        autoCorrect={false}
      />
      {erro ? <Aviso texto={erro} acao="Tentar de novo" aoAcionar={() => recarregar()} /> : null}
      {carregando && !erro ? <Esqueleto comResumo={false} /> : null}
      {!carregando && lista.length === 0 && !erro ? (
        buscando ? (
          <Vazio desenho="busca" titulo="Nada encontrado" texto={`Nenhum gasto ou item com "${busca}".`} />
        ) : (
          <Vazio
            desenho="sacola"
            titulo="Nenhum gasto ainda"
            texto="Toque no + aqui embaixo para registrar o primeiro."
          />
        )
      ) : null}

      <GastosPorData
        gastos={lista}
        linha={(g) => (
          <LinhaGastoComAcoes
            g={g}
            eu={eu}
            nome={nome}
            pago={false}
            grupo={g.grupo}
            aoAbrir={() => router.push({ pathname: '/grupo/[id]/gasto', params: { id: g.grupo_id, gastoId: g.id } })}
          />
        )}
      />

      {!buscando && gastos.hasNextPage ? (
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
