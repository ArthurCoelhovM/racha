import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { Abas } from '@/components/grupo/abas';
import { Historico } from '@/components/grupo/historico';
import { ListaDeDividas } from '@/components/grupo/lista-de-dividas';
import { AbaResumo } from '@/components/grupo/aba-resumo';
import { useDesfazer } from '@/components/desfazer';
import { tomClaro } from '@/constants/tema';
import { useEscuro } from '@/hooks/use-tema';
import { Conferir } from '@/components/grupo/conferir';
import { MapaDeDividas } from '@/components/graficos/dividas';
import { PagarComPix } from '@/components/pix/pagar-com-pix';
import { Dica } from '@/components/tutorial/dica';
import { FiltrosDeGastos, SEM_FILTRO } from '@/components/grupo/filtros-de-gastos';
import { ContasSemValor, ListaDeGastos, ListaDeRecorrentes } from '@/components/grupo/lista-de-gastos';
import { fraseDoGrupo, ResumoDoGrupo } from '@/components/grupo/resumo-do-grupo';
import { SaldosPorPessoa } from '@/components/grupo/saldos-por-pessoa';
import { Aviso, Botao, BotaoFlutuante, BotaoIcone, CoresDoGrupo, Esqueleto, Linha, Tela, Vazio } from '@/components/ui';
import {
  cobrar,
  ehForaDoGrupo,
  listarGastos,
  mensagemDeErro,
  pararRecorrente,
  retomarRecorrente,
  temFiltro,
  type Filtros,
} from '@/lib/api';
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
  useBusca,
  usePendentes,
  useTodosGastos,
  usePuxar,
} from '@/lib/consultas';
import { exportarCsv, gastosEmCsv } from '@/lib/csv';
import { Decimal, reais } from '@/lib/dinheiro';
import { meuPapel, pode } from '@/lib/permissoes';
import { resumoDoUsuario, type Pendencia } from '@/lib/saldos';
import { vibrarSucesso } from '@/lib/toque';
import { useSessao } from '@/lib/sessao';
import type { Recorrente } from '@/lib/tipos';

type Aba = 'dividas' | 'gastos' | 'resumo' | 'historico';
type Visao = 'lista' | 'pessoas' | 'grafico' | 'conferir';
type Mensagem = { texto: string; tipo: 'ok' | 'erro' };

export default function TelaGrupo() {
  const { id, ver } = useLocalSearchParams<{ id: string; ver?: string }>();
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
  const desfazer = useDesfazer();
  const escuro = useEscuro();

  const [aba, setAba] = useState<Aba>('dividas');
  const [visao, setVisao] = useState<Visao>(ver === 'conferir' ? 'conferir' : 'lista');
  const [pessoaExtrato, setPessoaExtrato] = useState<string | null>(null);
  const [pix, setPix] = useState<Pendencia | null>(null);
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const [exportando, setExportando] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTRO);
  const busca = useBusca(id, filtros);
  const todosGastos = useTodosGastos(id, aba === 'resumo');
  const pendentes = usePendentes(id);

  const atualizar = useCallback(() => invalidar(id), [invalidar, id]);
  useAtualizarAoFocar(atualizar);
  const { puxando, puxar } = usePuxar(atualizar);

  const nomes = useMemo(() => {
    const mapa = new Map<string, string>();
    // quem saiu continua aparecendo nas dívidas, marcado como "(saiu)"
    for (const m of membros.data ?? [])
      mapa.set(m.usuario_id, `${m.perfil.nome || 'Alguém'}${m.ativo ? '' : ' (saiu)'}`);
    return mapa;
  }, [membros.data]);

  const erroDoGrupo = textoDoErro(grupo.error ?? membros.error);
  if (grupo.isPending || membros.isPending) {
    if (!erroDoGrupo) {
      return (
        <Tela>
          <Esqueleto />
        </Tela>
      );
    }
  }
  if (!grupo.data || !membros.data) {
    return (
      <Tela>
        <Stack.Screen options={{ title: 'Grupo' }} />
        {ehForaDoGrupo(erroDoGrupo) ? (
          <>
            <Vazio
              desenho="grupo"
              titulo="Você não está mais neste grupo"
              texto="Ele saiu da sua lista. Peça um convite novo para voltar."
            />
            <Botao titulo="Ver meus grupos" aoPressionar={() => router.dismissTo('/')} />
          </>
        ) : erroDoGrupo ? (
          <Aviso texto={erroDoGrupo} acao="Tentar de novo" aoAcionar={atualizar} />
        ) : null}
      </Tela>
    );
  }

  const g = grupo.data;
  const filtrando = temFiltro(filtros);
  const listaPendencias = pendencias.data ?? [];
  const listaGastos = gastos.data?.pages.flat() ?? [];
  const nome = (u: string) => (u === eu ? 'Você' : (nomes.get(u) ?? 'Alguém'));
  const papel = meuPapel(membros.data, eu);
  const podeRegistrar = pode(g, papel, 'registrar_gastos');
  const podeConvidar = pode(g, papel, 'convidar_membros');
  const { voceDeve, teDevem } = resumoDoUsuario(listaPendencias, eu);
  const erroDasListas = textoDoErro(pendencias.error ?? gastos.error ?? historico.error ?? recorrentes.error);

  function pagar(p: Pendencia) {
    setMensagem(null);
    vibrarSucesso();
    marcarPago.mutate(p, {
      onSuccess: (pagamentoId) =>
        desfazer({
          texto: `Pagamento de ${reais(p.cobrar)} marcado.`,
          desfazer: () => desfazerPagamento.mutateAsync(pagamentoId),
        }),
      onError: (e) => setMensagem({ texto: mensagemDeErro(e), tipo: 'erro' }),
    });
  }

  async function cobrarPessoa(devedor: string) {
    setMensagem(null);
    try {
      const valor = await cobrar(g.id, devedor);
      setMensagem({ texto: `${nome(devedor)} recebeu um aviso para acertar ${valor}.`, tipo: 'ok' });
    } catch (e) {
      setMensagem({ texto: mensagemDeErro(e), tipo: 'erro' });
    }
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
      atualizar();
      desfazer({
        texto: `"${r.descricao}" não vai mais se repetir.`,
        desfazer: async () => {
          await retomarRecorrente(r.id);
          await atualizar();
        },
      });
    } catch (e) {
      setMensagem({ texto: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  return (
    <CoresDoGrupo membros={membros.data}>
      <Tela
        aoAtualizar={puxar}
        atualizando={puxando}
        topo={
          <>
            <ResumoDoGrupo
              grupo={g}
              membros={membros.data}
              voceDeve={voceDeve}
              teDevem={teDevem}
              frase={fraseDoGrupo(listaPendencias, eu, (u) => nome(u).replace(/ \(saiu\)$/, ''))}
            />

            <Dica
              id="grupo-abatimento"
              titulo={g.abatimento ? 'Abatimento direto' : 'Cada gasto, uma dívida'}
              texto={
                g.abatimento
                  ? 'Se você deve R$ 30 à Bia e ela te deve R$ 10, você só paga R$ 20. O abatimento é sempre entre duas pessoas: ninguém paga a dívida de outro.'
                  : 'Neste grupo as dívidas não se compensam: cada gasto é pago separado. Dá para ligar o abatimento nos ajustes do grupo.'
              }
            />
          </>
        }
        fixo={
          <Abas
            opcoes={[
              ['dividas', 'Dívidas'],
              ['gastos', `Gastos (${totalGastos.data ?? listaGastos.length})`],
              ['resumo', 'Resumo'],
              ['historico', 'Histórico'],
            ]}
            valor={aba}
            aoMudar={setAba}
          />
        }
        sobreposto={
          podeRegistrar ? (
            <BotaoFlutuante
              titulo="+ Gasto"
              aoPressionar={() => router.push({ pathname: '/grupo/[id]/gasto', params: { id: g.id } })}
            />
          ) : undefined
        }>
        <Stack.Screen
          options={{
            title: g.nome,
            // a cor do grupo no cabeçalho: dois grupos abertos em seguida já ficam diferentes
            headerStyle: { backgroundColor: tomClaro(g.cor, escuro) },
            headerRight: () => (
              <Linha style={{ gap: 6, paddingHorizontal: 4 }}>
                {podeConvidar ? (
                  <BotaoIcone
                    icone="person-add-outline"
                    rotulo="Convidar"
                    aoPressionar={() => router.push({ pathname: '/grupo/[id]/convite', params: { id: g.id } })}
                  />
                ) : null}
                <BotaoIcone
                  icone="settings-outline"
                  rotulo="Ajustes"
                  aoPressionar={() => router.push({ pathname: '/grupo/[id]/configuracoes', params: { id: g.id } })}
                />
              </Linha>
            ),
          }}
        />

        {mensagem ? <Aviso texto={mensagem.texto} tipo={mensagem.tipo} /> : null}
        {erroDasListas ? <Aviso texto={erroDasListas} acao="Tentar de novo" aoAcionar={atualizar} /> : null}

        {aba === 'dividas' ? (
          <>
            <Abas
              pequena
              opcoes={[
                ['lista', 'Lista'],
                ['pessoas', 'Por pessoa'],
                ['grafico', 'Gráfico'],
                ['conferir', 'Conferir'],
              ]}
              valor={visao}
              aoMudar={setVisao}
            />
            {visao === 'lista' && listaPendencias.some((p) => p.devedor === eu || p.credor === eu) ? (
              <Dica
                id="dividas-paguei"
                titulo="Acertou? Toque em Paguei"
                texto="Quando pagar ou receber, toque em Paguei (ou Recebi). O botão do QR mostra a chave Pix e o código com o valor certo. Tocar na linha abre o extrato com a pessoa."
              />
            ) : null}
            {visao === 'conferir' ? (
              <Dica
                id="conferir"
                titulo="Confira linha por linha"
                texto="Escolha uma pessoa para ver cada gasto e pagamento que formou o saldo entre vocês, com o saldo depois de cada um."
              />
            ) : null}
            {pendencias.isPending ? (
              <Esqueleto comResumo={false} />
            ) : visao === 'conferir' ? (
              <Conferir
                key={pessoaExtrato ?? 'conferir'}
                grupoId={g.id}
                abatimento={g.abatimento}
                membros={membros.data}
                pendencias={listaPendencias}
                eu={eu}
                nome={nome}
                pessoaInicial={pessoaExtrato}
                aoAbrirGasto={(gastoId) =>
                  router.push({ pathname: '/grupo/[id]/gasto', params: { id: g.id, gastoId } })
                }
              />
            ) : visao === 'lista' ? (
              <ListaDeDividas
                aoPix={setPix}
                aoVerExtrato={(outro) => {
                  setPessoaExtrato(outro);
                  setVisao('conferir');
                }}
                pendencias={listaPendencias}
                eu={eu}
                nome={nome}
                abatimento={g.abatimento}
                aoCobrar={cobrarPessoa}
                marcando={marcarPago.isPending ? (marcarPago.variables?.chave ?? null) : null}
                aoPagar={pagar}
              />
            ) : listaPendencias.length === 0 ? (
              <Vazio
                desenho="cofre"
                titulo="Ninguém deve nada"
                texto="Quando alguém registrar um gasto, as dívidas aparecem aqui."
              />
            ) : (
              <>
                {visao === 'grafico' ? (
                  <MapaDeDividas
                    pendencias={listaPendencias}
                    pessoas={membros.data.map((m) => m.usuario_id)}
                    eu={eu}
                    nome={nome}
                  />
                ) : null}
                <SaldosPorPessoa
                  membros={membros.data}
                  pendencias={listaPendencias}
                  nome={nome}
                  grafico={visao === 'grafico'}
                />
              </>
            )}
          </>
        ) : null}

        {aba === 'gastos' ? (
          <>
            <ContasSemValor
              pendentes={pendentes.data ?? []}
              eu={eu}
              nome={nome}
              aoPreencher={(p) => router.push({ pathname: '/grupo/[id]/gasto', params: { id: g.id, pendente: p.id } })}
            />
            <FiltrosDeGastos filtros={filtros} membros={membros.data} nome={nome} aoMudar={setFiltros} />
            {!filtrando ? <ListaDeRecorrentes recorrentes={recorrentes.data ?? []} aoParar={parar} /> : null}
            {(filtrando ? busca.isPending : gastos.isPending) ? (
              <Esqueleto comResumo={false} />
            ) : filtrando && (busca.data ?? []).length === 0 ? (
              <Vazio
                desenho="busca"
                titulo="Nenhum gasto encontrado"
                texto="Tente outra palavra ou tire algum filtro."
              />
            ) : (
              <ListaDeGastos
                gastos={filtrando ? (busca.data ?? []) : listaGastos}
                pendencias={listaPendencias}
                total={filtrando ? (busca.data ?? []).length : (totalGastos.data ?? listaGastos.length)}
                eu={eu}
                nome={nome}
                carregandoMais={gastos.isFetchingNextPage}
                aoAbrir={(gasto) =>
                  router.push({ pathname: '/grupo/[id]/gasto', params: { id: g.id, gastoId: gasto.id } })
                }
                aoCarregarMais={() => gastos.fetchNextPage()}
                aoRegistrar={
                  podeRegistrar ? () => router.push({ pathname: '/grupo/[id]/gasto', params: { id: g.id } }) : undefined
                }
              />
            )}
            {listaGastos.length > 0 ? (
              <Botao
                titulo="Exportar gastos em CSV"
                variante="secundario"
                carregando={exportando}
                aoPressionar={exportar}
              />
            ) : null}
          </>
        ) : null}

        {aba === 'resumo' ? (
          todosGastos.data ? (
            <AbaResumo
              gastos={todosGastos.data}
              eu={eu}
              nome={nome}
              grupo={g}
              podeMudarMetas={pode(g, papel, 'mudar_configuracoes')}
              recorrentes={recorrentes.data ?? []}
              pendentes={pendentes.data ?? []}
              aoMudar={atualizar}
            />
          ) : (
            <Esqueleto comResumo={false} />
          )
        ) : null}

        {aba === 'historico' ? <Historico registros={historico.data ?? []} nome={nome} /> : null}
      </Tela>
      <PagarComPix
        credor={pix?.credor ?? null}
        nomeCredor={pix ? nome(pix.credor) : ''}
        valor={pix?.valor ?? new Decimal(0)}
        aoFechar={() => setPix(null)}
        aoMarcarPago={() => pix && pagar(pix)}
      />
    </CoresDoGrupo>
  );
}
