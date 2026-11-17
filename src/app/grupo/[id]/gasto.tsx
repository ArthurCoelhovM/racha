import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Alteracoes } from '@/components/gasto/alteracoes';
import { Comentarios } from '@/components/gasto/comentarios';
import { Comprovante } from '@/components/gasto/comprovante';
import { SeletorDeCategoria } from '@/components/gasto/seletor-de-categoria';
import { ComoFica } from '@/components/gasto/como-fica';
import { DetalheDoGasto } from '@/components/gasto/detalhe-do-gasto';
import { novoItem } from '@/components/gasto/formulario-de-itens';
import { RepetirGasto } from '@/components/gasto/repetir-gasto';
import { SeletorDeDivisao, type EstadoDivisao } from '@/components/gasto/seletor-de-divisao';
import { SeletorDePagadores } from '@/components/gasto/seletor-de-pagadores';
import { CampoData } from '@/components/campo-data';
import { CampoValor } from '@/components/gasto/campo-valor';
import { SugestoesDeDescricao } from '@/components/gasto/sugestoes';
import { Dica } from '@/components/tutorial/dica';
import { Aviso, Botao, Campo, CoresDoGrupo, Esqueleto, Ficha, Fichas, Icone, Tela, Texto } from '@/components/ui';
import { espaco, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { useDesfazer } from '@/components/desfazer';
import {
  criarRecorrente,
  excluirGasto,
  gastoParaSalvar,
  mensagemDeErro,
  preencherLancamento,
  salvarGasto,
} from '@/lib/api';
import {
  textoDoErro,
  useGasto,
  useGastosRecentes,
  useGrupo,
  useHistoricoDoGasto,
  useInicio,
  useInvalidarGrupo,
  useMembros,
  usePendentes,
} from '@/lib/consultas';
import { itensDaNota, ouvirNota } from '@/lib/cupom';
import { Decimal, lerValor, paraCampo, reais } from '@/lib/dinheiro';
import { calcularDivisao, calcularPagadores, ordemDosPagadores, totalDosItens } from '@/lib/divisao';
import { hojeIso, isoParaBr, proximaOcorrencia } from '@/lib/formatos';
import { meuPapel, pode, quemPode } from '@/lib/permissoes';
import { useSessao } from '@/lib/sessao';
import { vibrarSucesso } from '@/lib/toque';
import {
  TIPOS_DIVISAO,
  type Categoria,
  type Frequencia,
  type Gasto,
  type Grupo,
  type LancamentoPendente,
  type Membro,
  type RegistroHistorico,
  type TipoDivisao,
} from '@/lib/tipos';
import { lembrarGrupo } from '@/lib/ultimo-grupo';

export default function TelaGasto() {
  const { id, gastoId, escolher, pendente, cupom, copiar, comentar } = useLocalSearchParams<{
    id: string;
    gastoId?: string;
    escolher?: string;
    pendente?: string;
    cupom?: string;
    copiar?: string;
    comentar?: string;
  }>();
  // "Duplicar": o formulário vem com tudo do gasto escolhido, como gasto novo e com a data de hoje
  const original = useGasto(gastoId ? undefined : copiar);
  const pendentes = usePendentes(id);
  const escolherGrupo = !gastoId && escolher === '1';
  const { usuarioId } = useSessao();
  const grupo = useGrupo(id);
  const membros = useMembros(id);
  const gasto = useGasto(gastoId);
  const historico = useHistoricoDoGasto(id, gastoId);

  const erro = textoDoErro(grupo.error ?? membros.error ?? gasto.error ?? original.error);
  const topo = escolherGrupo ? <EscolherGrupo atual={id} /> : null;
  if (erro) {
    return (
      <Tela>
        {topo}
        <Aviso texto={erro} />
      </Tela>
    );
  }
  if (
    !grupo.data ||
    !membros.data ||
    (gastoId && !gasto.data) ||
    (pendente && !pendentes.data) ||
    (copiar && !gastoId && !original.data)
  ) {
    return (
      <Tela>
        {topo}
        <Esqueleto comResumo={false} />
      </Tela>
    );
  }

  // quem já estava no gasto continua no formulário, mesmo que tenha saído do grupo
  const doGasto = gastoId ? gasto.data! : null;
  // conta de valor variável: o formulário já vem com o que foi usado da última vez, menos o valor
  const doPendente = pendente ? (pendentes.data ?? []).find((p) => p.id === pendente) : undefined;
  const copia = !gastoId && original.data ? { ...original.data, data: hojeIso(), comprovante: null } : null;
  const inicial = doGasto ?? (doPendente ? gastoDoModelo(doPendente) : copia);
  const noGasto = new Set<string>([
    ...(inicial?.pagadores ?? []).map((p) => p.usuario_id),
    ...(inicial?.divisoes ?? []).map((d) => d.usuario_id),
    ...(inicial?.itens ?? []).flatMap((i) => i.participantes),
  ]);

  const eu = usuarioId ?? '';
  const papel = meuPapel(membros.data, eu);
  const podeEditar = doGasto
    ? doGasto.criado_por === eu || pode(grupo.data, papel, 'editar_gastos_de_outros')
    : pode(grupo.data, papel, 'registrar_gastos');
  const registros = historico.data ?? [];
  const nome = (u: string) => {
    if (u === eu) return 'Você';
    const membro = membros.data.find((m) => m.usuario_id === u);
    const base = membro?.perfil.nome || 'Alguém';
    return membro && !membro.ativo ? `${base} (saiu)` : base;
  };

  if (!podeEditar) {
    return (
      <CoresDoGrupo membros={membros.data}>
        <Tela>
          <Stack.Screen options={{ title: doGasto ? 'Gasto' : 'Novo gasto' }} />
          {topo}
          <Aviso
            tipo="info"
            texto={
              doGasto
                ? `Neste grupo, editar gastos de outras pessoas é com ${quemPode(grupo.data, 'editar_gastos_de_outros')}.`
                : `Neste grupo, registrar gastos é com ${quemPode(grupo.data, 'registrar_gastos')}.`
            }
          />
          {doGasto ? <DetalheDoGasto gasto={doGasto} nome={nome} /> : null}
          {doGasto?.comprovante ? (
            <Comprovante
              grupoId={doGasto.grupo_id}
              caminho={doGasto.comprovante}
              podeMudar={false}
              aoMudar={() => {}}
            />
          ) : null}
          <Alteracoes registros={registros} nome={nome} />
          {doGasto ? <Comentarios gastoId={doGasto.id} eu={eu} nome={nome} focar={comentar === '1'} /> : null}
        </Tela>
      </CoresDoGrupo>
    );
  }

  return (
    <CoresDoGrupo membros={membros.data}>
      <Formulario
        key={doGasto?.id ?? pendente ?? (copia ? `copia-${copia.id}` : 'novo')}
        grupo={grupo.data}
        membros={membros.data.filter((m) => m.ativo || noGasto.has(m.usuario_id))}
        gasto={doGasto}
        inicial={inicial}
        pendenteId={doPendente?.id ?? null}
        eu={eu}
        nome={nome}
        historico={registros}
        topo={topo}
        escolherGrupo={escolherGrupo}
        abrirCupom={cupom === '1'}
        valorInicial={copia ? paraCampo(copia.valor_total) : ''}
        focarComentario={comentar === '1'}
      />
    </CoresDoGrupo>
  );
}

function porPessoa(gasto: Gasto | null, campo: 'parametro' | 'valor', dinheiro: boolean): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const d of gasto?.divisoes ?? []) {
    const bruto = d[campo] ?? d.valor;
    mapa[d.usuario_id] = dinheiro ? paraCampo(bruto) : String(Number(bruto)).replace('.', ',');
  }
  return mapa;
}

function Formulario({
  grupo,
  membros,
  gasto,
  inicial,
  pendenteId,
  eu,
  nome,
  historico,
  topo,
  escolherGrupo,
  abrirCupom,
  valorInicial,
  focarComentario,
}: {
  valorInicial: string;
  focarComentario: boolean;
  grupo: Grupo;
  membros: Membro[];
  gasto: Gasto | null;
  inicial: Gasto | null;
  pendenteId: string | null;
  eu: string;
  nome: (u: string) => string;
  historico: RegistroHistorico[];
  topo: ReactNode;
  escolherGrupo: boolean;
  abrirCupom: boolean;
}) {
  const tema = useTema();
  const ids = membros.map((m) => m.usuario_id);
  const ativos = membros.filter((m) => m.ativo).map((m) => m.usuario_id);
  // quem chegou até aqui pode editar este gasto, então também pode excluí-lo
  const podeExcluir = !!gasto;

  const permitidos = grupo.divisoes_permitidas;
  const tipoDoGasto = inicial?.tipo_divisao;

  const [descricao, setDescricao] = useState(inicial?.descricao ?? '');
  const [valorTexto, setValorTexto] = useState(gasto ? paraCampo(gasto.valor_total) : valorInicial);
  const [data, setData] = useState(inicial?.data ?? hojeIso());

  const variosNoInicio = (inicial?.pagadores.length ?? 0) > 1;
  const [varios, setVarios] = useState(variosNoInicio);
  const [pagadorUnico, setPagadorUnico] = useState(
    inicial?.pagadores[0]?.usuario_id ?? (ativos.includes(eu) ? eu : ativos[0]),
  );
  const [valoresPagos, setValoresPagos] = useState<Record<string, string>>(() =>
    variosNoInicio ? Object.fromEntries(inicial!.pagadores.map((p) => [p.usuario_id, paraCampo(p.valor)])) : {},
  );

  const [divisaoEstado, setDivisaoEstado] = useState<EstadoDivisao>(() => ({
    tipo: tipoDoGasto && permitidos.includes(tipoDoGasto) ? tipoDoGasto : permitidos[0],
    selecionados: tipoDoGasto === 'igual' ? inicial!.divisoes.map((d) => d.usuario_id) : ativos,
    valores: tipoDoGasto === 'exato' ? porPessoa(inicial, 'valor', true) : {},
    porcentagens: tipoDoGasto === 'porcentagem' ? porPessoa(inicial, 'parametro', false) : {},
    cotas:
      tipoDoGasto === 'cotas'
        ? porPessoa(inicial, 'parametro', false)
        : Object.fromEntries(ativos.map((u) => [u, '1'])),
    itens:
      tipoDoGasto === 'itens' && inicial?.itens?.length
        ? inicial.itens.map((i) => ({ ...i, valor: paraCampo(i.valor) }))
        : [novoItem(ativos)],
  }));
  const { tipo, itens } = divisaoEstado;
  const mudarDivisao = (mudanca: Partial<EstadoDivisao>) => setDivisaoEstado((atual) => ({ ...atual, ...mudanca }));
  const invalidar = useInvalidarGrupo();
  const desfazer = useDesfazer();

  // detalhes (quem pagou e como dividir) começam fechados no caso comum: você pagou, igual entre todos
  const [detalhes, setDetalhes] = useState(
    () =>
      !!inicial &&
      (inicial.pagadores.length > 1 ||
        inicial.tipo_divisao !== 'igual' ||
        inicial.divisoes.length !== ativos.length ||
        inicial.pagadores[0]?.usuario_id !== eu),
  );
  const [categoria, setCategoria] = useState<Categoria>(inicial?.categoria ?? 'outros');
  const [comprovante, setComprovante] = useState<string | null>(gasto?.comprovante ?? null);
  const [valorVariavel, setValorVariavel] = useState(false);
  const [infoNota, setInfoNota] = useState<string | null>(null);
  const [repetir, setRepetir] = useState(false);
  const [frequencia, setFrequencia] = useState<Frequencia>('mensal');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const novo = !gasto && !pendenteId;
  const recentes = useGastosRecentes(grupo.id, novo);
  const [sugestaoEscolhida, setSugestaoEscolhida] = useState<string | null>(null);

  // "Ler cupom" do menu +: o leitor abre por cima deste formulário, que recebe a nota quando ele fecha
  const cupomAberto = useRef(false);
  useEffect(() => {
    if (!abrirCupom || cupomAberto.current) return;
    cupomAberto.current = true;
    router.push({ pathname: '/grupo/[id]/cupom', params: { id: grupo.id } });
  }, [abrirCupom, grupo.id]);

  // escolher uma descrição usada antes traz a categoria, quem pagou e a divisão daquela vez
  function usarSugestao(g: Gasto) {
    setDescricao(g.descricao);
    setSugestaoEscolhida(g.descricao);
    setCategoria(g.categoria);
    if (g.pagadores.length === 1 && ativos.includes(g.pagadores[0].usuario_id)) {
      setVarios(false);
      setPagadorUnico(g.pagadores[0].usuario_id);
    }
    const pessoas = g.divisoes.map((d) => d.usuario_id);
    const todosAqui = pessoas.every((u) => ativos.includes(u));
    if (!todosAqui || !permitidos.includes(g.tipo_divisao)) return;
    if (g.tipo_divisao === 'igual') mudarDivisao({ tipo: 'igual', selecionados: pessoas });
    else if (g.tipo_divisao === 'porcentagem')
      mudarDivisao({ tipo: 'porcentagem', porcentagens: porPessoa(g, 'parametro', false) });
    else if (g.tipo_divisao === 'cotas') mudarDivisao({ tipo: 'cotas', cotas: porPessoa(g, 'parametro', false) });
  }

  // recebe a nota quando a tela do leitor termina
  useEffect(
    () =>
      ouvirNota((nota) => {
        const { itens: daNota, total: totalNota } = itensDaNota(
          nota,
          membros.filter((m) => m.ativo).map((m) => m.usuario_id),
        );
        const loja = nota.estabelecimento?.slice(0, 80) ?? 'Compra';
        setDescricao((atual) => (atual.trim() ? atual : loja));
        setCategoria('mercado');
        if (nota.data) setData(nota.data);
        setValorTexto(paraCampo(totalNota));
        const desconto =
          nota.desconto > 0 ? ` O desconto de ${reais(nota.desconto)} foi distribuído entre os itens.` : '';
        if (grupo.divisoes_permitidas.includes('itens')) {
          mudarDivisao({ tipo: 'itens', itens: daNota });
          setDetalhes(true);
          setInfoNota(
            `Nota lida: ${daNota.length} itens, total ${reais(totalNota)}.${desconto} Desmarque quem não participou de cada item.`,
          );
        } else {
          setInfoNota(
            `Nota lida: total ${reais(totalNota)}. Este grupo não permite dividir por item, então usei só o total.`,
          );
        }
      }),
    [membros, grupo.divisoes_permitidas],
  );

  const total = tipo === 'itens' ? totalDosItens(itens) : (lerValor(valorTexto) ?? new Decimal(0));
  const pagadores = calcularPagadores(total, varios ? null : pagadorUnico, varios ? valoresPagos : null);
  const divisao = calcularDivisao(tipo, total, ids, divisaoEstado, ordemDosPagadores(pagadores.pagadores));

  async function salvar() {
    const problema = !descricao.trim()
      ? 'Dê um nome ao gasto.'
      : total.lte(0)
        ? 'Informe o valor do gasto.'
        : total.decimalPlaces() > 2
          ? 'Use no máximo 2 casas decimais no valor.'
          : (pagadores.erro ?? divisao.erro);
    if (problema) {
      setErro(problema);
      if (pagadores.erro || divisao.erro) setDetalhes(true);
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      const dadosGasto = {
        id: gasto?.id,
        grupoId: grupo.id,
        descricao: descricao.trim(),
        categoria,
        comprovante,
        total,
        data,
        tipo,
        itens:
          tipo === 'itens'
            ? itens.map((i) => ({
                ...i,
                descricao: i.descricao.trim(),
                valor: (lerValor(i.valor) ?? new Decimal(0)).toFixed(2),
              }))
            : null,
        pagadores: pagadores.pagadores,
        partes: divisao.partes,
      };
      const novoId = pendenteId ? await preencherLancamento(pendenteId, dadosGasto) : await salvarGasto(dadosGasto);
      if (!gasto && !pendenteId && repetir) await criarRecorrente(dadosGasto, frequencia, novoId, valorVariavel);
      lembrarGrupo(grupo.id);
      vibrarSucesso();
      await invalidar(grupo.id);
      router.back();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  // sem "toque de novo": a exclusão pode ser desfeita pela barra de baixo
  async function excluir() {
    if (!gasto) return;
    setSalvando(true);
    try {
      await excluirGasto(gasto.id);
      await invalidar(grupo.id);
      router.back();
      const copia = gastoParaSalvar(gasto);
      desfazer({
        texto: `"${gasto.descricao}" foi excluído.`,
        desfazer: async () => {
          await salvarGasto(copia);
          await invalidar(copia.grupoId);
        },
      });
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  const proximaData = proximaOcorrencia(data, frequencia, Number(data.slice(8, 10)));
  const resumo = resumoDoGasto(tipo, varios, pagadorUnico, divisaoEstado.selecionados, ativos, nome);

  return (
    <Tela>
      <Stack.Screen options={{ title: gasto ? 'Editar gasto' : pendenteId ? 'Preencher o valor' : 'Novo gasto' }} />
      {topo}
      {pendenteId ? (
        <Aviso tipo="info" texto={`Conta de ${descricao} de ${isoParaBr(data)}: só falta o valor deste mês.`} />
      ) : null}

      {infoNota ? <Aviso tipo="info" texto={infoNota} /> : null}

      <CampoValor
        valor={valorTexto}
        aoMudar={setValorTexto}
        fixo={tipo === 'itens' ? paraCampo(total) : undefined}
        focar={(!gasto && !escolherGrupo) || !!pendenteId}
      />

      <Campo
        rotulo="Descrição"
        value={descricao}
        onChangeText={setDescricao}
        placeholder="Mercado, luz, pizza..."
        maxLength={80}
      />
      {novo && descricao !== sugestaoEscolhida ? (
        <SugestoesDeDescricao gastos={recentes.data ?? []} texto={descricao} nome={nome} aoEscolher={usarSugestao} />
      ) : null}

      <SeletorDeCategoria valor={categoria} aoMudar={setCategoria} />

      <CampoData valor={data} aoMudar={setData} />

      {novo ? (
        <Dica
          id="gasto-mudar"
          titulo="Dividir diferente"
          texto="Sem mexer, fica: você pagou e dividiu igual entre todos. Toque em Mudar para escolher quem pagou e como dividir."
        />
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: detalhes }}
        onPress={() => setDetalhes(!detalhes)}
        style={({ pressed }) => [estilos.resumo, { backgroundColor: tema.superficie2, opacity: pressed ? 0.8 : 1 }]}>
        <Icone nome="people-outline" cor={tema.textoSuave} tamanho={20} />
        <Texto variante="forte" style={{ flex: 1 }} numberOfLines={2}>
          {resumo}
        </Texto>
        <Texto variante="forte" cor={tema.primaria}>
          {detalhes ? 'Fechar' : 'Mudar'}
        </Texto>
      </Pressable>

      {detalhes ? (
        <>
          <SeletorDePagadores
            membros={membros}
            nome={nome}
            varios={varios}
            pagadorUnico={pagadorUnico}
            valoresPagos={valoresPagos}
            erro={pagadores.erro}
            aoEscolherUm={(u) => {
              setVarios(false);
              setPagadorUnico(u);
            }}
            aoAlternarVarios={() => setVarios(!varios)}
            aoMudarValor={(u, t) => setValoresPagos({ ...valoresPagos, [u]: t })}
          />

          <SeletorDeDivisao
            estado={divisaoEstado}
            permitidos={permitidos}
            cor={grupo.cor}
            membros={membros}
            ativos={ativos}
            nome={nome}
            aoMudar={mudarDivisao}
          />
        </>
      ) : null}

      <ComoFica partes={divisao.partes} erro={total.gt(0) ? divisao.erro : null} nome={nome} />

      <Comprovante grupoId={grupo.id} caminho={comprovante} podeMudar aoMudar={setComprovante} />

      {!gasto && !pendenteId ? (
        <Botao
          titulo="Ler cupom fiscal (QR code)"
          variante="secundario"
          aoPressionar={() => router.push({ pathname: '/grupo/[id]/cupom', params: { id: grupo.id } })}
        />
      ) : null}

      {!gasto && !pendenteId ? (
        <RepetirGasto
          valorVariavel={valorVariavel}
          aoMudarVariavel={setValorVariavel}
          repetir={repetir}
          frequencia={frequencia}
          proximaData={proximaData}
          aoMudarRepetir={setRepetir}
          aoMudarFrequencia={setFrequencia}
        />
      ) : null}

      {erro ? <Aviso texto={erro} /> : null}
      <Botao titulo={gasto ? 'Salvar alterações' : 'Registrar gasto'} aoPressionar={salvar} carregando={salvando} />
      {podeExcluir ? (
        <Botao titulo="Excluir gasto" variante="perigo" aoPressionar={excluir} desabilitado={salvando} />
      ) : null}
      <Alteracoes registros={historico} nome={nome} />
      {gasto ? <Comentarios gastoId={gasto.id} eu={eu} nome={nome} focar={focarComentario} /> : null}
    </Tela>
  );
}

// um gasto "de mentira" montado com o modelo do recorrente, para preencher o formulário
function gastoDoModelo(p: LancamentoPendente): Gasto {
  const m = (p.recorrente?.modelo ?? {}) as Partial<{
    descricao: string;
    tipo_divisao: TipoDivisao;
    categoria: Categoria;
    itens: Gasto['itens'];
    pagadores: { usuario_id: string; valor: string }[];
    divisoes: { usuario_id: string; parametro: string | null; valor: string }[];
  }>;
  return {
    id: '',
    grupo_id: '',
    descricao: m.descricao ?? p.recorrente?.descricao ?? '',
    valor_total: '',
    data: p.data,
    tipo_divisao: m.tipo_divisao ?? 'igual',
    itens: null,
    criado_por: '',
    criado_em: '',
    recorrente_id: p.recorrente_id,
    categoria: m.categoria ?? 'contas',
    comprovante: null,
    pagadores: m.pagadores ?? [],
    divisoes: m.divisoes ?? [],
    dividas: [],
  };
}

// vindo do "+ Gasto" da tela inicial: dá para trocar o grupo sem voltar
function EscolherGrupo({ atual }: { atual: string }) {
  const inicio = useInicio();
  const grupos = inicio.data?.grupos ?? [];
  if (grupos.length < 2) return null;
  return (
    <View style={{ gap: 6 }}>
      <Texto variante="rotulo">Grupo</Texto>
      <Fichas>
        {grupos.map((g) => (
          <Ficha
            key={g.grupo_id}
            rotulo={g.nome}
            cor={g.cor}
            selecionada={g.grupo_id === atual}
            aoPressionar={() => router.setParams({ id: g.grupo_id })}
          />
        ))}
      </Fichas>
    </View>
  );
}

// "Você pagou · igual entre 3"
function resumoDoGasto(
  tipo: TipoDivisao,
  varios: boolean,
  pagador: string,
  selecionados: string[],
  ativos: string[],
  nome: (u: string) => string,
): string {
  const quem = varios ? 'Mais de um pagou' : nome(pagador) === 'Você' ? 'Você pagou' : `${nome(pagador)} pagou`;
  const como =
    tipo === 'igual'
      ? selecionados.length === ativos.length && ativos.every((u) => selecionados.includes(u))
        ? `igual entre ${selecionados.length === 1 ? '1 pessoa' : `todos (${selecionados.length})`}`
        : `igual entre ${selecionados.length}`
      : (TIPOS_DIVISAO.find((t) => t.tipo === tipo)?.nome.toLowerCase() ?? tipo);
  return `${quem} · ${como}`;
}

const estilos = StyleSheet.create({
  resumo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingHorizontal: espaco.g,
    paddingVertical: 14,
    borderRadius: raio.m,
  },
});
