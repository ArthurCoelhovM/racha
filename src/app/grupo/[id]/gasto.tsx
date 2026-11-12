import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Alteracoes } from '@/components/gasto/alteracoes';
import { ComoFica } from '@/components/gasto/como-fica';
import { DetalheDoGasto } from '@/components/gasto/detalhe-do-gasto';
import { novoItem } from '@/components/gasto/formulario-de-itens';
import { RepetirGasto } from '@/components/gasto/repetir-gasto';
import { SeletorDeDivisao, type EstadoDivisao } from '@/components/gasto/seletor-de-divisao';
import { SeletorDePagadores } from '@/components/gasto/seletor-de-pagadores';
import { Aviso, Botao, Campo, CampoDinheiro, Carregando, CoresDoGrupo, Tela, Texto } from '@/components/ui';
import { espaco, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { criarRecorrente, excluirGasto, mensagemDeErro, salvarGasto } from '@/lib/api';
import {
  textoDoErro,
  useGasto,
  useGrupo,
  useHistoricoDoGasto,
  useInvalidarGrupo,
  useMembros,
} from '@/lib/consultas';
import { itensDaNota, ouvirNota } from '@/lib/cupom';
import { Decimal, lerValor, paraCampo, reais } from '@/lib/dinheiro';
import { calcularDivisao, calcularPagadores, ordemDosPagadores, totalDosItens } from '@/lib/divisao';
import { brParaIso, hojeIso, isoParaBr, proximaOcorrencia } from '@/lib/formatos';
import { meuPapel, pode, quemPode } from '@/lib/permissoes';
import { useSessao } from '@/lib/sessao';
import type { Frequencia, Gasto, Grupo, Membro, RegistroHistorico } from '@/lib/tipos';

export default function TelaGasto() {
  const { id, gastoId } = useLocalSearchParams<{
    id: string;
    gastoId?: string;
  }>();
  const { usuarioId } = useSessao();
  const grupo = useGrupo(id);
  const membros = useMembros(id);
  const gasto = useGasto(gastoId);
  const historico = useHistoricoDoGasto(id, gastoId);

  const erro = textoDoErro(grupo.error ?? membros.error ?? gasto.error);
  if (erro) return <Tela>{<Aviso texto={erro} />}</Tela>;
  if (!grupo.data || !membros.data || (gastoId && !gasto.data)) return <Carregando />;

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
}: {
  grupo: Grupo;
  membros: Membro[];
  gasto: Gasto | null;
  eu: string;
  nome: (u: string) => string;
  historico: RegistroHistorico[];
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
  const [dataTexto, setDataTexto] = useState(isoParaBr(gasto?.data ?? hojeIso()));

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
        if (nota.data) setDataTexto(isoParaBr(nota.data));
        setValorTexto(paraCampo(totalNota));
        const desconto =
          nota.desconto > 0 ? ` O desconto de ${reais(nota.desconto)} foi distribuído entre os itens.` : '';
        if (grupo.divisoes_permitidas.includes('itens')) {
          mudarDivisao({ tipo: 'itens', itens: daNota });
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
    const dataIso = brParaIso(dataTexto);
    const problema = !descricao.trim()
      ? 'Dê um nome ao gasto.'
      : total.lte(0)
        ? 'Informe o valor do gasto.'
        : total.decimalPlaces() > 2
          ? 'Use no máximo 2 casas decimais no valor.'
          : !dataIso
            ? 'Data inválida. Use dia/mês/ano, como 16/10/2026.'
            : (pagadores.erro ?? divisao.erro);
    if (problema) {
      setErro(problema);
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
        data: dataIso!,
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

  const dataEscolhida = brParaIso(dataTexto);
  const proximaData = dataEscolhida
    ? proximaOcorrencia(dataEscolhida, frequencia, Number(dataEscolhida.slice(8, 10)))
    : null;

  return (
    <Tela>
      <Stack.Screen options={{ title: gasto ? 'Editar gasto' : 'Novo gasto' }} />

      {!gasto ? (
        <Botao
          titulo="Ler cupom fiscal (QR code)"
          variante="secundario"
          aoPressionar={() =>
            router.push({
              pathname: '/grupo/[id]/cupom',
              params: { id: grupo.id },
            })
          }
        />
      ) : null}
      {infoNota ? <Aviso tipo="info" texto={infoNota} /> : null}

      <Campo
        rotulo="Descrição"
        value={descricao}
        onChangeText={setDescricao}
        placeholder="Mercado, luz, pizza..."
        maxLength={80}
      />

      <View style={estilos.duasColunas}>
        <View style={{ flex: 1 }}>
          {tipo === 'itens' ? (
            <View style={{ gap: 6 }}>
              <Texto variante="rotulo">Valor</Texto>
              <View style={[estilos.valorFixo, { backgroundColor: tema.superficie2 }]}>
                <Texto variante="forte">{reais(total)}</Texto>
              </View>
            </View>
          ) : (
            <CampoDinheiro rotulo="Valor (R$)" value={valorTexto} onChangeText={setValorTexto} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Campo
            rotulo="Data"
            value={dataTexto}
            onChangeText={setDataTexto}
            placeholder="dd/mm/aaaa"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
        </View>
      </View>

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

      <ComoFica partes={divisao.partes} erro={divisao.erro} nome={nome} />

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

const estilos = StyleSheet.create({
  duasColunas: { flexDirection: 'row', gap: espaco.m },
  valorFixo: {
    minHeight: 48,
    borderRadius: raio.m,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
});
