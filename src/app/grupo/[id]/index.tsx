import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Aviso, Avatar, Botao, BotaoFlutuante, Carregando, Cartao, Linha, Separador, Tela, Texto, Vazio } from '@/components/ui';
import { espaco, raio } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import { useTema } from '@/hooks/use-tema';
import {
  buscarGrupo,
  desfazerPagamento,
  listarDividas,
  listarGastos,
  listarHistorico,
  listarMembros,
  listarPagamentos,
  marcarPago,
  mensagemDeErro,
} from '@/lib/api';
import { exportarCsv, gastosEmCsv } from '@/lib/csv';
import { dec, Decimal, ehExato, ehZero, reais, reaisCobrar } from '@/lib/dinheiro';
import { diaCurto, momento } from '@/lib/formatos';
import { calcularPendencias, resumoDoUsuario, type Pendencia } from '@/lib/saldos';
import { useSessao } from '@/lib/sessao';
import type { Gasto, Membro, RegistroHistorico } from '@/lib/tipos';

type Aba = 'dividas' | 'gastos' | 'historico';
type Visao = 'lista' | 'pessoas' | 'grafico';

async function carregarTudo(id: string) {
  const [grupo, membros, gastos, dividas, pagamentos, historico] = await Promise.all([
    buscarGrupo(id),
    listarMembros(id),
    listarGastos(id),
    listarDividas(id),
    listarPagamentos(id),
    listarHistorico(id),
  ]);
  return { grupo, membros, gastos, dividas, pagamentos, historico };
}

export default function TelaGrupo() {
  const tema = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuarioId } = useSessao();
  const eu = usuarioId ?? '';
  const { dados, erro, carregando, atualizando, recarregar } = useCarregar(() => carregarTudo(id), id);
  const [aba, setAba] = useState<Aba>('dividas');
  const [visao, setVisao] = useState<Visao>('lista');
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'erro'; pagamentoId?: string } | null>(null);
  const [marcando, setMarcando] = useState<string | null>(null);

  const nomes = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const m of dados?.membros ?? []) mapa.set(m.usuario_id, m.perfil.nome || 'Alguém');
    return mapa;
  }, [dados?.membros]);

  const pendencias = useMemo(() => {
    if (!dados) return [];
    return calcularPendencias(dados.grupo.abatimento, dados.dividas, dados.pagamentos, dados.gastos);
  }, [dados]);

  if (carregando) return <Carregando />;
  if (!dados) return <Tela>{erro ? <Aviso texto={erro} acao="Tentar de novo" aoAcionar={recarregar} /> : null}</Tela>;

  const { grupo, membros, gastos, historico } = dados;
  const nome = (u: string) => (u === eu ? 'Você' : nomes.get(u) ?? 'Alguém');
  const { voceDeve, teDevem } = resumoDoUsuario(pendencias, eu);

  async function pagar(p: Pendencia) {
    setMarcando(p.chave);
    setAviso(null);
    try {
      const pagamentoId = await marcarPago(grupo.id, p.devedor, p.credor, p.valor, p.gasto_id);
      setAviso({ texto: `Pagamento de ${reais(p.cobrar)} marcado.`, tipo: 'ok', pagamentoId });
      recarregar();
    } catch (e) {
      setAviso({ texto: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      setMarcando(null);
    }
  }

  async function desfazer(pagamentoId: string) {
    try {
      await desfazerPagamento(pagamentoId);
      setAviso({ texto: 'Pagamento desfeito.', tipo: 'ok' });
      recarregar();
    } catch (e) {
      setAviso({ texto: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  return (
    <Tela
      aoAtualizar={recarregar}
      atualizando={atualizando}
      sobreposto={
        <BotaoFlutuante
          titulo="+ Gasto"
          aoPressionar={() => router.push({ pathname: '/grupo/[id]/gasto', params: { id: grupo.id } })}
        />
      }>
      <Stack.Screen
        options={{
          title: grupo.nome,
          headerRight: () => (
            <Linha style={{ gap: 16, paddingHorizontal: 8 }}>
              <Pressable hitSlop={10} onPress={() => router.push({ pathname: '/grupo/[id]/convite', params: { id: grupo.id } })}>
                <Texto variante="forte" cor={tema.primaria}>Convidar</Texto>
              </Pressable>
              <Pressable hitSlop={10} onPress={() => router.push({ pathname: '/grupo/[id]/configuracoes', params: { id: grupo.id } })}>
                <Texto variante="forte" cor={tema.primaria}>Ajustes</Texto>
              </Pressable>
            </Linha>
          ),
        }}
      />

      <View style={[estilos.resumo, { backgroundColor: tema.superficie, borderColor: tema.borda }]}>
        <View style={[estilos.faixa, { backgroundColor: grupo.cor }]} />
        <View style={{ flex: 1, padding: espaco.g, gap: espaco.m }}>
          {ehZero(voceDeve) && ehZero(teDevem) ? (
            <Texto variante="titulo">Tudo certo por aqui</Texto>
          ) : (
            <Linha style={{ gap: espaco.xg, flexWrap: 'wrap' }}>
              {!ehZero(voceDeve) ? (
                <View>
                  <Texto variante="rotulo" cor={tema.negativo}>Você deve</Texto>
                  <Texto variante="grande" cor={tema.negativo}>{reais(voceDeve)}</Texto>
                </View>
              ) : null}
              {!ehZero(teDevem) ? (
                <View>
                  <Texto variante="rotulo" cor={tema.positivo}>Te devem</Texto>
                  <Texto variante="grande" cor={tema.positivo}>{reais(teDevem)}</Texto>
                </View>
              ) : null}
            </Linha>
          )}
          <Texto variante="suave">
            {grupo.abatimento
              ? 'Com abatimento: dívidas entre duas pessoas se compensam.'
              : 'Sem abatimento: cada gasto é cobrado separado.'}
          </Texto>
          <Linha style={{ gap: 6, flexWrap: 'wrap' }}>
            {membros
              .filter((m) => m.ativo)
              .map((m) => (
                <Avatar key={m.usuario_id} id={m.usuario_id} nome={m.perfil.nome} tamanho={28} />
              ))}
          </Linha>
        </View>
      </View>

      <Abas
        opcoes={[
          ['dividas', 'Dívidas'],
          ['gastos', `Gastos (${gastos.length})`],
          ['historico', 'Histórico'],
        ]}
        valor={aba}
        aoMudar={(v) => setAba(v as Aba)}
      />

      {aviso ? (
        <Aviso
          texto={aviso.texto}
          tipo={aviso.tipo}
          acao={aviso.pagamentoId ? 'Desfazer' : undefined}
          aoAcionar={aviso.pagamentoId ? () => desfazer(aviso.pagamentoId!) : undefined}
        />
      ) : null}
      {erro ? <Aviso texto={erro} acao="Tentar de novo" aoAcionar={recarregar} /> : null}

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
            aoMudar={(v) => setVisao(v as Visao)}
          />
          {pendencias.length === 0 ? (
            <Vazio titulo="Ninguém deve nada" texto="Quando alguém registrar um gasto, as dívidas aparecem aqui." />
          ) : visao === 'lista' ? (
            <Cartao style={{ padding: 0, gap: 0 }}>
              {pendencias.map((p, i) => (
                <View key={p.chave}>
                  {i > 0 ? <Separador /> : null}
                  <LinhaPendencia
                    p={p}
                    nome={nome}
                    euParticipo={p.devedor === eu || p.credor === eu}
                    carregando={marcando === p.chave}
                    aoPagar={() => pagar(p)}
                  />
                </View>
              ))}
            </Cartao>
          ) : (
            <SaldosPorPessoa membros={membros} pendencias={pendencias} nome={nome} grafico={visao === 'grafico'} />
          )}
        </>
      ) : null}

      {aba === 'gastos' ? (
        <>
          {gastos.length === 0 ? (
            <Vazio titulo="Nenhum gasto ainda" texto="Toque em + Gasto para registrar o primeiro." />
          ) : (
            <>
              <Cartao style={{ padding: 0, gap: 0 }}>
                {gastos.map((g, i) => (
                  <View key={g.id}>
                    {i > 0 ? <Separador /> : null}
                    <LinhaGasto g={g} eu={eu} nome={nome} aoAbrir={() => router.push({ pathname: '/grupo/[id]/gasto', params: { id: grupo.id, gastoId: g.id } })} />
                  </View>
                ))}
              </Cartao>
              <Botao
                titulo="Exportar gastos em CSV"
                variante="secundario"
                aoPressionar={() =>
                  exportarCsv(`${grupo.nome.replace(/[^\w-]+/g, '-').toLowerCase()}-gastos.csv`, gastosEmCsv(gastos, nomes)).catch((e) =>
                    setAviso({ texto: mensagemDeErro(e), tipo: 'erro' }),
                  )
                }
              />
            </>
          )}
        </>
      ) : null}

      {aba === 'historico' ? <Historico registros={historico} nome={nome} /> : null}
    </Tela>
  );
}

function Abas({
  opcoes,
  valor,
  aoMudar,
  pequena = false,
}: {
  opcoes: [string, string][];
  valor: string;
  aoMudar: (v: string) => void;
  pequena?: boolean;
}) {
  const tema = useTema();
  return (
    <View style={[estilos.abas, { backgroundColor: tema.superficie2 }]}>
      {opcoes.map(([chave, rotulo]) => {
        const ativa = chave === valor;
        return (
          <Pressable
            key={chave}
            accessibilityRole="tab"
            accessibilityState={{ selected: ativa }}
            onPress={() => aoMudar(chave)}
            style={[estilos.aba, pequena && { paddingVertical: 6 }, ativa && { backgroundColor: tema.superficie }]}>
            <Texto variante={pequena ? 'suave' : 'forte'} cor={ativa ? tema.texto : tema.textoSuave} style={{ fontWeight: '700' }}>
              {rotulo}
            </Texto>
          </Pressable>
        );
      })}
    </View>
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
    <View style={estilos.linhaLista}>
      <Linha>
        <Avatar id={p.devedor} nome={nome(p.devedor)} />
        <Texto variante="suave">→</Texto>
        <Avatar id={p.credor} nome={nome(p.credor)} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Texto variante="forte" numberOfLines={2}>
            {nome(p.devedor)} deve a {nome(p.credor) === 'Você' ? 'você' : nome(p.credor)}
          </Texto>
          {p.descricao ? <Texto variante="suave" numberOfLines={1}>{p.descricao}{p.data ? ` · ${diaCurto(p.data)}` : ''}</Texto> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Texto variante="subtitulo">{reais(p.cobrar)}</Texto>
          {!exato ? <Texto variante="suave">exato {reais(p.valor)}…</Texto> : null}
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

function SaldosPorPessoa({
  membros,
  pendencias,
  nome,
  grafico,
}: {
  membros: Membro[];
  pendencias: Pendencia[];
  nome: (u: string) => string;
  grafico: boolean;
}) {
  const tema = useTema();
  const saldos = membros
    .map((m) => {
      let saldo = new Decimal(0);
      for (const p of pendencias) {
        if (p.credor === m.usuario_id) saldo = saldo.plus(p.cobrar);
        if (p.devedor === m.usuario_id) saldo = saldo.minus(p.cobrar);
      }
      return { id: m.usuario_id, nome: nome(m.usuario_id), saldo, ativo: m.ativo };
    })
    .filter((s) => s.ativo || !ehZero(s.saldo))
    .sort((a, b) => b.saldo.comparedTo(a.saldo));

  const maior = saldos.reduce((m, s) => Decimal.max(m, s.saldo.abs()), new Decimal(0));

  if (grafico) {
    return (
      <Cartao>
        <Linha style={{ justifyContent: 'space-between' }}>
          <Texto variante="rotulo" cor={tema.negativo}>Deve</Texto>
          <Texto variante="rotulo" cor={tema.positivo}>Recebe</Texto>
        </Linha>
        {saldos.map((s) => {
          const fracao = maior.isZero() ? 0 : Number(s.saldo.abs().div(maior).toFixed(4));
          const positivo = s.saldo.gt(0);
          return (
            <View key={s.id} style={{ gap: 4, paddingVertical: 6 }}>
              <Linha style={{ justifyContent: 'space-between' }}>
                <Texto variante="forte">{s.nome}</Texto>
                <Texto variante="forte" cor={ehZero(s.saldo) ? tema.textoSuave : positivo ? tema.positivo : tema.negativo}>
                  {ehZero(s.saldo) ? 'quite' : `${positivo ? '+' : '−'} ${reais(s.saldo.abs())}`}
                </Texto>
              </Linha>
              <View style={estilos.trilho}>
                <View style={[estilos.metade, { alignItems: 'flex-end', borderRightWidth: 1, borderColor: tema.borda }]}>
                  {!positivo && !ehZero(s.saldo) ? (
                    <View style={[estilos.barra, { width: `${Math.max(fracao * 100, 3)}%`, backgroundColor: tema.negativo }]} />
                  ) : null}
                </View>
                <View style={estilos.metade}>
                  {positivo ? (
                    <View style={[estilos.barra, { width: `${Math.max(fracao * 100, 3)}%`, backgroundColor: tema.positivo }]} />
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </Cartao>
    );
  }

  return (
    <View style={estilos.grade}>
      {saldos.map((s) => {
        const positivo = s.saldo.gt(0);
        const quite = ehZero(s.saldo);
        return (
          <Cartao key={s.id} style={estilos.cartaoPessoa}>
            <Linha>
              <Avatar id={s.id} nome={s.nome} />
              <Texto variante="forte" numberOfLines={1} style={{ flex: 1 }}>{s.nome}</Texto>
            </Linha>
            <Texto variante="rotulo" cor={quite ? tema.textoSuave : positivo ? tema.positivo : tema.negativo}>
              {quite ? 'Quite' : positivo ? 'A receber' : 'A pagar'}
            </Texto>
            <Texto variante="subtitulo" cor={quite ? tema.textoSuave : positivo ? tema.positivo : tema.negativo}>
              {reais(s.saldo.abs())}
            </Texto>
          </Cartao>
        );
      })}
    </View>
  );
}

function LinhaGasto({ g, eu, nome, aoAbrir }: { g: Gasto; eu: string; nome: (u: string) => string; aoAbrir: () => void }) {
  const tema = useTema();
  const minhaParte = g.divisoes.find((d) => d.usuario_id === eu);
  const pagou = g.pagadores.map((p) => nome(p.usuario_id)).join(' e ');
  return (
    <Pressable onPress={aoAbrir} style={({ pressed }) => [estilos.linhaLista, { opacity: pressed ? 0.7 : 1 }]}>
      <Linha>
        <View style={[estilos.data, { backgroundColor: tema.superficie2 }]}>
          <Texto variante="suave" style={{ fontWeight: '700' }}>{diaCurto(g.data)}</Texto>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Texto variante="forte" numberOfLines={1}>{g.descricao}</Texto>
          <Texto variante="suave" numberOfLines={1}>Pago por {pagou}</Texto>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Texto variante="forte">{reais(dec(g.valor_total))}</Texto>
          {minhaParte ? <Texto variante="suave">sua parte {reaisCobrar(minhaParte.valor)}</Texto> : null}
        </View>
      </Linha>
    </Pressable>
  );
}

function descreverHistorico(r: RegistroHistorico, nome: (u: string) => string): string {
  const quem = r.usuario_id ? nome(r.usuario_id) : 'Alguém';
  const depois = (r.depois ?? {}) as Record<string, unknown>;
  const antes = (r.antes ?? {}) as Record<string, unknown>;
  switch (r.entidade) {
    case 'gastos':
      if (r.acao === 'insert') return `${quem} registrou "${depois.descricao}" de ${reais(String(depois.valor_total))}`;
      if (r.acao === 'update') return `${quem} editou "${depois.descricao}"`;
      return `${quem} excluiu "${antes.descricao}" de ${reais(String(antes.valor_total))}`;
    case 'pagamentos': {
      const dados = r.acao === 'insert' ? depois : antes;
      const texto = `${nome(String(dados.de))} pagou ${reais(String(dados.valor_cobrado))} a ${nome(String(dados.para))}`;
      return r.acao === 'insert' ? `${quem} marcou: ${texto}` : `${quem} desfez: ${texto}`;
    }
    case 'membros':
      if (r.acao === 'insert') return `${nome(String(depois.usuario_id))} entrou no grupo`;
      return depois.ativo ? `${nome(String(depois.usuario_id))} voltou ao grupo` : `${nome(String(depois.usuario_id))} saiu do grupo`;
    case 'grupos':
      if (antes.abatimento !== depois.abatimento) {
        return `${quem} ${depois.abatimento ? 'ligou' : 'desligou'} o abatimento`;
      }
      return `${quem} mudou as configurações do grupo`;
    default:
      return `${quem} fez uma alteração`;
  }
}

function Historico({ registros, nome }: { registros: RegistroHistorico[]; nome: (u: string) => string }) {
  if (registros.length === 0) return <Vazio titulo="Nada por aqui ainda" />;
  return (
    <Cartao style={{ padding: 0, gap: 0 }}>
      {registros.map((r, i) => (
        <View key={r.id}>
          {i > 0 ? <Separador /> : null}
          <View style={[estilos.linhaLista, { gap: 2 }]}>
            <Texto>{descreverHistorico(r, nome)}</Texto>
            <Texto variante="suave">{momento(r.criado_em)}</Texto>
          </View>
        </View>
      ))}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  resumo: { flexDirection: 'row', borderRadius: raio.g, borderWidth: 1, overflow: 'hidden' },
  faixa: { width: 6 },
  abas: { flexDirection: 'row', borderRadius: raio.m, padding: 4, gap: 4 },
  aba: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: raio.p },
  linhaLista: { padding: espaco.g, gap: espaco.m },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.m },
  cartaoPessoa: { flexGrow: 1, flexBasis: 150, gap: 6 },
  trilho: { flexDirection: 'row', height: 14 },
  metade: { flex: 1, justifyContent: 'center' },
  barra: { height: 12, borderRadius: 6 },
  data: { width: 52, paddingVertical: 8, borderRadius: raio.p, alignItems: 'center' },
});
