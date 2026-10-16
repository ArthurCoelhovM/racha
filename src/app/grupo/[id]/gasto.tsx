import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Aviso, Avatar, Botao, Campo, Carregando, Cartao, Ficha, Fichas, Interruptor, Linha, Separador, Tela, Texto } from '@/components/ui';
import { espaco, raio } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import { useTema } from '@/hooks/use-tema';
import { buscarGasto, buscarGrupo, criarRecorrente, excluirGasto, listarMembros, mensagemDeErro, salvarGasto } from '@/lib/api';
import { Decimal, ehExato, lerValor, paraCampo, reais } from '@/lib/dinheiro';
import { calcularDivisao, calcularPagadores, totalDosItens } from '@/lib/divisao';
import { brParaIso, hojeIso, isoParaBr, proximaOcorrencia } from '@/lib/formatos';
import { useSessao } from '@/lib/sessao';
import { TIPOS_DIVISAO, type Frequencia, type Gasto, type Grupo, type Item, type Membro, type TipoDivisao } from '@/lib/tipos';

export default function TelaGasto() {
  const { id, gastoId } = useLocalSearchParams<{ id: string; gastoId?: string }>();
  const { usuarioId } = useSessao();
  const { dados, erro, carregando } = useCarregar(async () => {
    const [grupo, membros, gasto] = await Promise.all([
      buscarGrupo(id),
      listarMembros(id),
      gastoId ? buscarGasto(gastoId) : Promise.resolve(null),
    ]);
    return { grupo, membros: membros.filter((m) => m.ativo), gasto };
  }, `${id}|${gastoId ?? ''}`);

  if (carregando) return <Carregando />;
  if (!dados) return <Tela>{erro ? <Aviso texto={erro} /> : null}</Tela>;

  return (
    <Formulario
      key={dados.gasto?.id ?? 'novo'}
      grupo={dados.grupo}
      membros={dados.membros}
      gasto={dados.gasto}
      eu={usuarioId ?? ''}
    />
  );
}

function novoItem(membros: string[]): Item {
  return { descricao: '', valor: '', participantes: membros };
}

function porPessoa(gasto: Gasto | null, campo: 'parametro' | 'valor', dinheiro: boolean): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const d of gasto?.divisoes ?? []) {
    const bruto = d[campo] ?? d.valor;
    mapa[d.usuario_id] = dinheiro ? paraCampo(bruto) : String(Number(bruto)).replace('.', ',');
  }
  return mapa;
}

function Formulario({ grupo, membros, gasto, eu }: { grupo: Grupo; membros: Membro[]; gasto: Gasto | null; eu: string }) {
  const tema = useTema();
  const ids = membros.map((m) => m.usuario_id);
  const nome = (u: string) => (u === eu ? 'Você' : membros.find((m) => m.usuario_id === u)?.perfil.nome ?? 'Alguém');
  const permitidos = grupo.divisoes_permitidas;
  const tipoDoGasto = gasto?.tipo_divisao;

  const [descricao, setDescricao] = useState(gasto?.descricao ?? '');
  const [valorTexto, setValorTexto] = useState(gasto ? paraCampo(gasto.valor_total) : '');
  const [dataTexto, setDataTexto] = useState(isoParaBr(gasto?.data ?? hojeIso()));

  const variosNoInicio = (gasto?.pagadores.length ?? 0) > 1;
  const [varios, setVarios] = useState(variosNoInicio);
  const [pagadorUnico, setPagadorUnico] = useState(gasto?.pagadores[0]?.usuario_id ?? (ids.includes(eu) ? eu : ids[0]));
  const [valoresPagos, setValoresPagos] = useState<Record<string, string>>(() =>
    variosNoInicio ? Object.fromEntries(gasto!.pagadores.map((p) => [p.usuario_id, paraCampo(p.valor)])) : {},
  );

  const [tipo, setTipo] = useState<TipoDivisao>(tipoDoGasto && permitidos.includes(tipoDoGasto) ? tipoDoGasto : permitidos[0]);
  const [selecionados, setSelecionados] = useState<string[]>(
    tipoDoGasto === 'igual' ? gasto!.divisoes.map((d) => d.usuario_id) : ids,
  );
  const [valores, setValores] = useState<Record<string, string>>(tipoDoGasto === 'exato' ? porPessoa(gasto, 'valor', true) : {});
  const [porcentagens, setPorcentagens] = useState<Record<string, string>>(
    tipoDoGasto === 'porcentagem' ? porPessoa(gasto, 'parametro', false) : {},
  );
  const [cotas, setCotas] = useState<Record<string, string>>(
    tipoDoGasto === 'cotas' ? porPessoa(gasto, 'parametro', false) : Object.fromEntries(ids.map((u) => [u, '1'])),
  );
  const [itens, setItens] = useState<Item[]>(
    tipoDoGasto === 'itens' && gasto?.itens?.length
      ? gasto.itens.map((i) => ({ ...i, valor: paraCampo(i.valor) }))
      : [novoItem(ids)],
  );

  const [repetir, setRepetir] = useState(false);
  const [frequencia, setFrequencia] = useState<Frequencia>('mensal');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const total = tipo === 'itens' ? totalDosItens(itens) : lerValor(valorTexto) ?? new Decimal(0);
  const divisao = calcularDivisao(tipo, total, ids, { selecionados, valores, porcentagens, cotas, itens });
  const pagadores = calcularPagadores(total, varios ? null : pagadorUnico, varios ? valoresPagos : null);

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
            : pagadores.erro ?? divisao.erro;
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
            ? itens.map((i) => ({ ...i, descricao: i.descricao.trim(), valor: (lerValor(i.valor) ?? new Decimal(0)).toFixed(2) }))
            : null,
        pagadores: pagadores.pagadores,
        partes: divisao.partes,
      };
      const novoId = await salvarGasto(dadosGasto);
      if (!gasto && repetir) await criarRecorrente(dadosGasto, frequencia, novoId);
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
      router.back();
    } catch (e) {
      setErro(mensagemDeErro(e));
      setSalvando(false);
    }
  }

  function alternar(lista: string[], u: string) {
    return lista.includes(u) ? lista.filter((x) => x !== u) : [...lista, u];
  }

  function mudarItem(indice: number, mudanca: Partial<Item>) {
    setItens((atual) => atual.map((item, i) => (i === indice ? { ...item, ...mudanca } : item)));
  }

  function mudarCota(u: string, delta: number) {
    const atual = lerValor(cotas[u] ?? '0') ?? new Decimal(0);
    const novo = Decimal.max(0, atual.plus(delta));
    setCotas({ ...cotas, [u]: novo.toString().replace('.', ',') });
  }

  const dicaTipo = TIPOS_DIVISAO.find((t) => t.tipo === tipo)?.dica;
  const dataEscolhida = brParaIso(dataTexto);
  const proximaData = dataEscolhida ? proximaOcorrencia(dataEscolhida, frequencia, Number(dataEscolhida.slice(8, 10))) : null;

  return (
    <Tela>
      <Stack.Screen options={{ title: gasto ? 'Editar gasto' : 'Novo gasto' }} />

      <Campo rotulo="Descrição" value={descricao} onChangeText={setDescricao} placeholder="Mercado, luz, pizza..." maxLength={80} />

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
            <Campo rotulo="Valor (R$)" value={valorTexto} onChangeText={setValorTexto} keyboardType="decimal-pad" placeholder="0,00" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Campo rotulo="Data" value={dataTexto} onChangeText={setDataTexto} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" maxLength={10} />
        </View>
      </View>

      <Secao titulo="Quem pagou">
        <Fichas>
          {membros.map((m) => (
            <Ficha
              key={m.usuario_id}
              rotulo={nome(m.usuario_id)}
              selecionada={!varios && pagadorUnico === m.usuario_id}
              aoPressionar={() => {
                setVarios(false);
                setPagadorUnico(m.usuario_id);
              }}
            />
          ))}
          <Ficha rotulo="Mais de um" selecionada={varios} aoPressionar={() => setVarios(!varios)} />
        </Fichas>
        {varios ? (
          <Cartao>
            {membros.map((m) => (
              <LinhaPessoa key={m.usuario_id} id={m.usuario_id} nome={nome(m.usuario_id)}>
                <Campo
                  value={valoresPagos[m.usuario_id] ?? ''}
                  onChangeText={(t) => setValoresPagos({ ...valoresPagos, [m.usuario_id]: t })}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  style={estilos.campoPequeno}
                />
              </LinhaPessoa>
            ))}
            <Texto variante="suave" cor={pagadores.erro ? tema.negativo : tema.positivo}>
              {pagadores.erro ?? 'Os pagamentos fecham o total.'}
            </Texto>
          </Cartao>
        ) : null}
      </Secao>

      <Secao titulo="Como dividir">
        <Fichas>
          {TIPOS_DIVISAO.filter((t) => permitidos.includes(t.tipo)).map((t) => (
            <Ficha key={t.tipo} rotulo={t.nome} selecionada={tipo === t.tipo} aoPressionar={() => setTipo(t.tipo)} cor={grupo.cor} />
          ))}
        </Fichas>
        {dicaTipo ? <Texto variante="suave">{dicaTipo}</Texto> : null}

        {tipo === 'igual' ? (
          <Fichas>
            {membros.map((m) => (
              <Ficha
                key={m.usuario_id}
                rotulo={nome(m.usuario_id)}
                selecionada={selecionados.includes(m.usuario_id)}
                aoPressionar={() => setSelecionados(alternar(selecionados, m.usuario_id))}
              />
            ))}
            <Ficha
              rotulo="Todos"
              selecionada={selecionados.length === ids.length}
              aoPressionar={() => setSelecionados(selecionados.length === ids.length ? [] : ids)}
            />
          </Fichas>
        ) : null}

        {tipo === 'exato' || tipo === 'porcentagem' ? (
          <Cartao>
            {membros.map((m) => {
              const mapa = tipo === 'exato' ? valores : porcentagens;
              const setMapa = tipo === 'exato' ? setValores : setPorcentagens;
              return (
                <LinhaPessoa key={m.usuario_id} id={m.usuario_id} nome={nome(m.usuario_id)}>
                  <Campo
                    value={mapa[m.usuario_id] ?? ''}
                    onChangeText={(t) => setMapa({ ...mapa, [m.usuario_id]: t })}
                    keyboardType="decimal-pad"
                    placeholder={tipo === 'exato' ? '0,00' : '0 %'}
                    style={estilos.campoPequeno}
                  />
                </LinhaPessoa>
              );
            })}
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
                    onChangeText={(t) => setCotas({ ...cotas, [m.usuario_id]: t })}
                    keyboardType="decimal-pad"
                    style={[estilos.campoPequeno, { width: 64, textAlign: 'center' }]}
                  />
                  <BotaoRedondo rotulo="+" aoPressionar={() => mudarCota(m.usuario_id, 1)} />
                </Linha>
              </LinhaPessoa>
            ))}
          </Cartao>
        ) : null}

        {tipo === 'itens' ? (
          <View style={{ gap: espaco.m }}>
            {itens.map((item, i) => (
              <Cartao key={i}>
                <View style={estilos.duasColunas}>
                  <View style={{ flex: 2 }}>
                    <Campo value={item.descricao} onChangeText={(t) => mudarItem(i, { descricao: t })} placeholder={`Item ${i + 1}`} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Campo value={item.valor} onChangeText={(t) => mudarItem(i, { valor: t })} keyboardType="decimal-pad" placeholder="0,00" />
                  </View>
                </View>
                <Fichas>
                  {membros.map((m) => (
                    <Ficha
                      key={m.usuario_id}
                      rotulo={nome(m.usuario_id)}
                      selecionada={item.participantes.includes(m.usuario_id)}
                      aoPressionar={() => mudarItem(i, { participantes: alternar(item.participantes, m.usuario_id) })}
                    />
                  ))}
                </Fichas>
                {itens.length > 1 ? (
                  <Botao titulo="Remover item" variante="texto" pequeno aoPressionar={() => setItens(itens.filter((_, j) => j !== i))} style={{ alignSelf: 'flex-start' }} />
                ) : null}
              </Cartao>
            ))}
            <Botao titulo="+ Adicionar item" variante="secundario" aoPressionar={() => setItens([...itens, novoItem(ids)])} />
          </View>
        ) : null}
      </Secao>

      <Secao titulo="Como fica">
        <Cartao>
          {divisao.partes.length === 0 ? (
            <Texto variante="suave">Preencha o valor e escolha quem divide.</Texto>
          ) : (
            divisao.partes.map((p, i) => (
              <View key={p.usuario_id} style={{ gap: espaco.m }}>
                {i > 0 ? <Separador /> : null}
                <LinhaPessoa id={p.usuario_id} nome={nome(p.usuario_id)}>
                  <Texto variante="forte">
                    {ehExato(p.valor) ? '' : '≈ '}
                    {reais(p.valor)}
                  </Texto>
                </LinhaPessoa>
              </View>
            ))
          )}
          {divisao.erro ? <Texto variante="suave" cor={tema.negativo}>{divisao.erro}</Texto> : null}
        </Cartao>
        <Texto variante="suave">
          As contas guardam os centavos exatos. Na hora de cobrar, o valor é arredondado para cima.
        </Texto>
      </Secao>

      {!gasto ? (
        <Cartao>
          <Interruptor
            titulo="Repetir este gasto"
            descricao="Bom para aluguel, luz e internet. Dá para editar o valor de cada lançamento depois."
            valor={repetir}
            aoMudar={setRepetir}
          />
          {repetir ? (
            <>
              <Fichas>
                <Ficha rotulo="Todo mês" selecionada={frequencia === 'mensal'} aoPressionar={() => setFrequencia('mensal')} />
                <Ficha rotulo="Toda semana" selecionada={frequencia === 'semanal'} aoPressionar={() => setFrequencia('semanal')} />
              </Fichas>
              {proximaData ? <Texto variante="suave">Próximo lançamento em {isoParaBr(proximaData)}.</Texto> : null}
            </>
          ) : null}
        </Cartao>
      ) : null}

      {erro ? <Aviso texto={erro} /> : null}
      <Botao titulo={gasto ? 'Salvar alterações' : 'Registrar gasto'} aoPressionar={salvar} carregando={salvando} />
      {gasto ? (
        <Botao titulo="Excluir gasto" variante="perigo" confirmar="Toque de novo para excluir" aoPressionar={excluir} desabilitado={salvando} />
      ) : null}
    </Tela>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={{ gap: espaco.m }}>
      <Texto variante="rotulo">{titulo}</Texto>
      {children}
    </View>
  );
}

function LinhaPessoa({ id, nome, children }: { id: string; nome: string; children: ReactNode }) {
  return (
    <Linha>
      <Avatar id={id} nome={nome} tamanho={28} />
      <Texto variante="forte" numberOfLines={1} style={{ flex: 1 }}>{nome}</Texto>
      {children}
    </Linha>
  );
}

function BotaoRedondo({ rotulo, aoPressionar }: { rotulo: string; aoPressionar: () => void }) {
  const tema = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={aoPressionar}
      style={({ pressed }) => [estilos.redondo, { backgroundColor: tema.superficie2, opacity: pressed ? 0.7 : 1 }]}>
      <Texto variante="subtitulo">{rotulo}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  duasColunas: { flexDirection: 'row', gap: espaco.m },
  campoPequeno: { width: 110, minHeight: 42, paddingVertical: 6, textAlign: 'right' },
  valorFixo: { minHeight: 48, borderRadius: raio.m, paddingHorizontal: 14, justifyContent: 'center' },
  redondo: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
