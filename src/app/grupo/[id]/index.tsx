import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable } from 'react-native';

import { Abas } from '@/components/grupo/abas';
import { Historico } from '@/components/grupo/historico';
import { ListaDeDividas } from '@/components/grupo/lista-de-dividas';
import { ListaDeGastos, ListaDeRecorrentes } from '@/components/grupo/lista-de-gastos';
import { ResumoDoGrupo } from '@/components/grupo/resumo-do-grupo';
import { SaldosPorPessoa } from '@/components/grupo/saldos-por-pessoa';
import { Aviso, Botao, BotaoFlutuante, Carregando, CoresDoGrupo, Linha, Tela, Texto, Vazio } from '@/components/ui';
import { useTema } from '@/hooks/use-tema';
import { ehForaDoGrupo, listarGastos, mensagemDeErro, pararRecorrente } from '@/lib/api';
import {
  textoDoErro,
  useAtualizarAoFocar,
  useDesfazerPagamento,
  useGastos,
  useGrupo,
  useHistorico,
  useInvalidarGrupo,
  useMarcarPago,
  useMembros,
  usePendencias,
  useRecorrentes,
  useTotalGastos,
  usePuxar,
} from '@/lib/consultas';
import { exportarCsv, gastosEmCsv } from '@/lib/csv';
import { reais } from '@/lib/dinheiro';
import { resumoDoUsuario, type Pendencia } from '@/lib/saldos';
import { useSessao } from '@/lib/sessao';
import type { Recorrente } from '@/lib/tipos';

type Aba = 'dividas' | 'gastos' | 'historico';
type Visao = 'lista' | 'pessoas' | 'grafico';
type Mensagem = { texto: string; tipo: 'ok' | 'erro'; pagamentoId?: string };

export default function TelaGrupo() {
  const tema = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuarioId } = useSessao();
  const eu = usuarioId ?? '';

  const grupo = useGrupo(id);
  const membros = useMembros(id);
  const pendencias = usePendencias(id);
  const gastos = useGastos(id);
  const totalGastos = useTotalGastos(id);
  const historico = useHistorico(id);
  const recorrentes = useRecorrentes(id);
  const invalidar = useInvalidarGrupo();
  const marcarPago = useMarcarPago(id);
  const desfazerPagamento = useDesfazerPagamento(id);

  const [aba, setAba] = useState<Aba>('dividas');
  const [visao, setVisao] = useState<Visao>('lista');
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const [exportando, setExportando] = useState(false);

  const atualizar = useCallback(() => invalidar(id), [invalidar, id]);
  useAtualizarAoFocar(atualizar);
  const { puxando, puxar } = usePuxar(atualizar);

  const nomes = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const m of membros.data ?? []) mapa.set(m.usuario_id, m.perfil.nome || 'Alguém');
    return mapa;
  }, [membros.data]);

  const erroDoGrupo = textoDoErro(grupo.error ?? membros.error);
  if (grupo.isPending || membros.isPending) {
    if (!erroDoGrupo) return <Carregando />;
  }
  if (!grupo.data || !membros.data) {
    return (
      <Tela>
        <Stack.Screen options={{ title: 'Grupo' }} />
        {ehForaDoGrupo(erroDoGrupo) ? (
          <>
            <Vazio titulo="Você não está mais neste grupo" texto="Ele saiu da sua lista. Peça um convite novo para voltar." />
            <Botao titulo="Ver meus grupos" aoPressionar={() => router.dismissTo('/')} />
          </>
        ) : erroDoGrupo ? (
          <Aviso texto={erroDoGrupo} acao="Tentar de novo" aoAcionar={atualizar} />
        ) : null}
      </Tela>
    );
  }

  const g = grupo.data;
  const listaPendencias = pendencias.data ?? [];
  const listaGastos = gastos.data?.pages.flat() ?? [];
  const nome = (u: string) => (u === eu ? 'Você' : (nomes.get(u) ?? 'Alguém'));
  const { voceDeve, teDevem } = resumoDoUsuario(listaPendencias, eu);
  const erroDasListas = textoDoErro(pendencias.error ?? gastos.error ?? historico.error ?? recorrentes.error);

  function pagar(p: Pendencia) {
    setMensagem(null);
    marcarPago.mutate(p, {
      onSuccess: (pagamentoId) =>
        setMensagem({ texto: `Pagamento de ${reais(p.cobrar)} marcado.`, tipo: 'ok', pagamentoId }),
      onError: (e) => setMensagem({ texto: mensagemDeErro(e), tipo: 'erro' }),
    });
  }

  function desfazer(pagamentoId: string) {
    desfazerPagamento.mutate(pagamentoId, {
      onSuccess: () => setMensagem({ texto: 'Pagamento desfeito.', tipo: 'ok' }),
      onError: (e) => setMensagem({ texto: mensagemDeErro(e), tipo: 'erro' }),
    });
  }

  async function exportar() {
    setExportando(true);
    try {
      const todos = await listarGastos(g.id);
      await exportarCsv(`${g.nome.replace(/[^\w-]+/g, '-').toLowerCase()}-gastos.csv`, gastosEmCsv(todos, nomes));
    } catch (e) {
      setMensagem({ texto: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      setExportando(false);
    }
  }

  async function parar(r: Recorrente) {
    try {
      await pararRecorrente(r.id);
      setMensagem({ texto: `"${r.descricao}" não vai mais se repetir.`, tipo: 'ok' });
      atualizar();
    } catch (e) {
      setMensagem({ texto: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  return (
    <CoresDoGrupo membros={membros.data}>
      <Tela
        aoAtualizar={puxar}
        atualizando={puxando}
        sobreposto={
          <BotaoFlutuante
            titulo="+ Gasto"
            aoPressionar={() => router.push({ pathname: '/grupo/[id]/gasto', params: { id: g.id } })}
          />
        }>
        <Stack.Screen
          options={{
            title: g.nome,
            headerRight: () => (
              <Linha style={{ gap: 16, paddingHorizontal: 8 }}>
                <Pressable
                  hitSlop={10}
                  onPress={() => router.push({ pathname: '/grupo/[id]/convite', params: { id: g.id } })}>
                  <Texto variante="forte" cor={tema.primaria}>
                    Convidar
                  </Texto>
                </Pressable>
                <Pressable
                  hitSlop={10}
                  onPress={() => router.push({ pathname: '/grupo/[id]/configuracoes', params: { id: g.id } })}>
                  <Texto variante="forte" cor={tema.primaria}>
                    Ajustes
                  </Texto>
                </Pressable>
              </Linha>
            ),
          }}
        />

        <ResumoDoGrupo grupo={g} membros={membros.data} voceDeve={voceDeve} teDevem={teDevem} />

        <Abas
          opcoes={[
            ['dividas', 'Dívidas'],
            ['gastos', `Gastos (${totalGastos.data ?? listaGastos.length})`],
            ['historico', 'Histórico'],
          ]}
          valor={aba}
          aoMudar={setAba}
        />

        {mensagem ? (
          <Aviso
            texto={mensagem.texto}
            tipo={mensagem.tipo}
            acao={mensagem.pagamentoId ? 'Desfazer' : undefined}
            aoAcionar={mensagem.pagamentoId ? () => desfazer(mensagem.pagamentoId!) : undefined}
          />
        ) : null}
        {erroDasListas ? <Aviso texto={erroDasListas} acao="Tentar de novo" aoAcionar={atualizar} /> : null}

        {aba === 'dividas' ? (
          <>
            <Abas
              pequena
              opcoes={[
                ['lista', 'Lista'],
                ['pessoas', 'Por pessoa'],
                ['grafico', 'Gráfico'],
              ]}
              valor={visao}
              aoMudar={setVisao}
            />
            {pendencias.isPending ? (
              <Carregando />
            ) : visao === 'lista' ? (
              <ListaDeDividas
                pendencias={listaPendencias}
                eu={eu}
                nome={nome}
                marcando={marcarPago.isPending ? (marcarPago.variables?.chave ?? null) : null}
                aoPagar={pagar}
              />
            ) : listaPendencias.length === 0 ? (
              <Vazio titulo="Ninguém deve nada" texto="Quando alguém registrar um gasto, as dívidas aparecem aqui." />
            ) : (
              <SaldosPorPessoa
                membros={membros.data}
                pendencias={listaPendencias}
                nome={nome}
                grafico={visao === 'grafico'}
              />
            )}
          </>
        ) : null}

        {aba === 'gastos' ? (
          <>
            <ListaDeRecorrentes recorrentes={recorrentes.data ?? []} aoParar={parar} />
            {gastos.isPending ? (
              <Carregando />
            ) : (
              <ListaDeGastos
                gastos={listaGastos}
                total={totalGastos.data ?? listaGastos.length}
                eu={eu}
                nome={nome}
                carregandoMais={gastos.isFetchingNextPage}
                aoAbrir={(gasto) =>
                  router.push({ pathname: '/grupo/[id]/gasto', params: { id: g.id, gastoId: gasto.id } })
                }
                aoCarregarMais={() => gastos.fetchNextPage()}
              />
            )}
            {listaGastos.length > 0 ? (
              <Botao titulo="Exportar gastos em CSV" variante="secundario" carregando={exportando} aoPressionar={exportar} />
            ) : null}
          </>
        ) : null}

        {aba === 'historico' ? <Historico registros={historico.data ?? []} nome={nome} /> : null}
      </Tela>
    </CoresDoGrupo>
  );
}
