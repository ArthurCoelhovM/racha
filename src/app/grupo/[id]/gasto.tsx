import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Alteracoes } from '@/components/gasto/alteracoes';
import { ComoFica } from '@/components/gasto/como-fica';
import { DetalheDoGasto } from '@/components/gasto/detalhe-do-gasto';
import { novoItem } from '@/components/gasto/formulario-de-itens';
import { RepetirGasto } from '@/components/gasto/repetir-gasto';
import { SeletorDeDivisao, type EstadoDivisao } from '@/components/gasto/seletor-de-divisao';
import { SeletorDePagadores } from '@/components/gasto/seletor-de-pagadores';
import { CampoData } from '@/components/campo-data';
import { CampoValor } from '@/components/gasto/campo-valor';
import { Aviso, Botao, Campo, CoresDoGrupo, Esqueleto, Ficha, Fichas, Icone, Tela, Texto } from '@/components/ui';
import { espaco, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { criarRecorrente, excluirGasto, mensagemDeErro, salvarGasto } from '@/lib/api';
import {
  textoDoErro,
  useGasto,
  useGrupo,
  useHistoricoDoGasto,
  useInicio,
  useInvalidarGrupo,
  useMembros,
} from '@/lib/consultas';
import { itensDaNota, ouvirNota } from '@/lib/cupom';
import { Decimal, lerValor, paraCampo, reais } from '@/lib/dinheiro';
import { calcularDivisao, calcularPagadores, ordemDosPagadores, totalDosItens } from '@/lib/divisao';
import { hojeIso, proximaOcorrencia } from '@/lib/formatos';
import { meuPapel, pode, quemPode } from '@/lib/permissoes';
import { useSessao } from '@/lib/sessao';
import { vibrarSucesso } from '@/lib/toque';
import {
  TIPOS_DIVISAO,
  type Frequencia,
  type Gasto,
  type Grupo,
  type Membro,
  type RegistroHistorico,
  type TipoDivisao,
} from '@/lib/tipos';
import { lembrarGrupo } from '@/lib/ultimo-grupo';

export default function TelaGasto() {
  const { id, gastoId, escolher } = useLocalSearchParams<{
    id: string;
    gastoId?: string;
    escolher?: string;
  }>();
  const escolherGrupo = !gastoId && escolher === '1';
  const { usuarioId } = useSessao();
  const grupo = useGrupo(id);
  const membros = useMembros(id);
  const gasto = useGasto(gastoId);
  const historico = useHistoricoDoGasto(id, gastoId);

  const erro = textoDoErro(grupo.error ?? membros.error ?? gasto.error);
  const topo = escolherGrupo ? <EscolherGrupo atual={id} /> : null;
  if (erro) {
    return (
      <Tela>
        {topo}
        <Aviso texto={erro} />
      </Tela>
    );
  }
  if (!grupo.data || !membros.data || (gastoId && !gasto.data)) {
    return (
      <Tela>
        {topo}
        <Esqueleto comResumo={false} />
      </Tela>
    );
  }

  // quem já estava no gasto continua no formulário, mesmo que tenha saído do grupo
  const doGasto = gastoId ? gasto.data! : null;
  const noGasto = new Set<string>([
    ...(doGasto?.pagadores ?? []).map((p) => p.usuario_id),
    ...(doGasto?.divisoes ?? []).map((d) => d.usuario_id),
    ...(doGasto?.itens ?? []).flatMap((i) => i.participantes),
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
          <Alteracoes registros={registros} nome={nome} />
        </Tela>
      </CoresDoGrupo>
    );
  }

  return (
    <CoresDoGrupo membros={membros.data}>
      <Formulario
        key={doGasto?.id ?? 'novo'}
        grupo={grupo.data}
        membros={membros.data.filter((m) => m.ativo || noGasto.has(m.usuario_id))}
        gasto={doGasto}
        eu={eu}
        nome={nome}
        historico={registros}
        topo={topo}
        escolherGrupo={escolherGrupo}
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
  eu,
  nome,
  historico,
  topo,
  escolherGrupo,
}: {
  grupo: Grupo;
  membros: Membro[];
  gasto: Gasto | null;
  eu: string;
  nome: (u: string) => string;
  historico: RegistroHistorico[];
  topo: ReactNode;
  escolherGrupo: boolean;
}) {
  const tema = useTema();
  const ids = membros.map((m) => m.usuario_id);
  const ativos = membros.filter((m) => m.ativo).map((m) => m.usuario_id);
  // quem chegou até aqui pode editar este gasto, então também pode excluí-lo
  const podeExcluir = !!gasto;

  const permitidos = grupo.divisoes_permitidas;
  const tipoDoGasto = gasto?.tipo_divisao;

  const [descricao, setDescricao] = useState(gasto?.descricao ?? '');
  const [valorTexto, setValorTexto] = useState(gasto ? paraCampo(gasto.valor_total) : '');
  const [data, setData] = useState(gasto?.data ?? hojeIso());

  const variosNoInicio = (gasto?.pagadores.length ?? 0) > 1;
  const [varios, setVarios] = useState(variosNoInicio);
  const [pagadorUnico, setPagadorUnico] = useState(
    gasto?.pagadores[0]?.usuario_id ?? (ativos.includes(eu) ? eu : ativos[0]),
  );
  const [valoresPagos, setValoresPagos] = useState<Record<string, string>>(() =>
    variosNoInicio ? Object.fromEntries(gasto!.pagadores.map((p) => [p.usuario_id, paraCampo(p.valor)])) : {},
  );

  const [divisaoEstado, setDivisaoEstado] = useState<EstadoDivisao>(() => ({
    tipo: tipoDoGasto && permitidos.includes(tipoDoGasto) ? tipoDoGasto : permitidos[0],
    selecionados: tipoDoGasto === 'igual' ? gasto!.divisoes.map((d) => d.usuario_id) : ativos,
    valores: tipoDoGasto === 'exato' ? porPessoa(gasto, 'valor', true) : {},
    porcentagens: tipoDoGasto === 'porcentagem' ? porPessoa(gasto, 'parametro', false) : {},
    cotas:
      tipoDoGasto === 'cotas' ? porPessoa(gasto, 'parametro', false) : Object.fromEntries(ativos.map((u) => [u, '1'])),
    itens:
      tipoDoGasto === 'itens' && gasto?.itens?.length
        ? gasto.itens.map((i) => ({ ...i, valor: paraCampo(i.valor) }))
        : [novoItem(ativos)],
  }));
  const { tipo, itens } = divisaoEstado;
  const mudarDivisao = (mudanca: Partial<EstadoDivisao>) => setDivisaoEstado((atual) => ({ ...atual, ...mudanca }));
  const invalidar = useInvalidarGrupo();

  // detalhes (quem pagou e como dividir) começam fechados no caso comum: você pagou, igual entre todos
  const [detalhes, setDetalhes] = useState(
    () =>
      !!gasto &&
      (gasto.pagadores.length > 1 ||
        gasto.tipo_divisao !== 'igual' ||
        gasto.divisoes.length !== ativos.length ||
        gasto.pagadores[0]?.usuario_id !== eu),
  );
  const [infoNota, setInfoNota] = useState<string | null>(null);
  const [repetir, setRepetir] = useState(false);
  const [frequencia, setFrequencia] = useState<Frequencia>('mensal');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

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
      const novoId = await salvarGasto(dadosGasto);
      if (!gasto && repetir) await criarRecorrente(dadosGasto, frequencia, novoId);
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

  async function excluir() {
    if (!gasto) return;
    setSalvando(true);
    try {
      await excluirGasto(gasto.id);
      await invalidar(grupo.id);
      router.back();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  const proximaData = proximaOcorrencia(data, frequencia, Number(data.slice(8, 10)));
  const resumo = resumoDoGasto(tipo, varios, pagadorUnico, divisaoEstado.selecionados, ativos, nome);

  return (
    <Tela>
      <Stack.Screen options={{ title: gasto ? 'Editar gasto' : 'Novo gasto' }} />
      {topo}

      {infoNota ? <Aviso tipo="info" texto={infoNota} /> : null}

      <CampoValor
        valor={valorTexto}
        aoMudar={setValorTexto}
        fixo={tipo === 'itens' ? paraCampo(total) : undefined}
        focar={!gasto && !escolherGrupo}
      />

      <Campo
        rotulo="Descrição"
        value={descricao}
        onChangeText={setDescricao}
        placeholder="Mercado, luz, pizza..."
        maxLength={80}
      />

      <CampoData valor={data} aoMudar={setData} />

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

      {!gasto ? (
        <Botao
          titulo="Ler cupom fiscal (QR code)"
          variante="secundario"
          aoPressionar={() => router.push({ pathname: '/grupo/[id]/cupom', params: { id: grupo.id } })}
        />
      ) : null}

      {!gasto ? (
        <RepetirGasto
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
        <Botao
          titulo="Excluir gasto"
          variante="perigo"
          confirmar="Toque de novo para excluir"
          aoPressionar={excluir}
          desabilitado={salvando}
        />
      ) : null}
      <Alteracoes registros={historico} nome={nome} />
    </Tela>
  );
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
