import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as TextoSvg } from 'react-native-svg';

import { ultimosMeses } from '@/components/grupo/filtros-de-gastos';
import { Dica } from '@/components/tutorial/dica';
import { Avatar, Cartao, Ficha, Icone, Linha, Texto, Vazio, type NomeIcone } from '@/components/ui';
import { espaco, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { dec, Decimal, reais } from '@/lib/dinheiro';
import { diaCurto } from '@/lib/formatos';
import {
  categoriasDoMes,
  comparacao,
  contasFixas,
  itensMaisComprados,
  mesDe,
  mesesAte,
  nomeDoMes,
  precoDoItem,
  quemPagou,
  totaisPorMes,
} from '@/lib/graficos';
import { infoCategoria, type Gasto } from '@/lib/tipos';

const CORES_LINHAS = ['#5B4CF0', '#C2410C', '#0E7C3F', '#D92657'];

// Aba "Resumo": o mês escolhido, a evolução ao longo do tempo e as compras do mercado
export function AbaResumo({ gastos, eu, nome }: { gastos: Gasto[]; eu: string; nome: (u: string) => string }) {
  const meses = ultimosMeses(6);
  const [mes, setMes] = useState(meses[0].valor.slice(0, 7));
  if (gastos.length === 0) {
    return <Vazio titulo="Nada para resumir ainda" texto="Os gráficos aparecem quando o grupo tiver gastos." />;
  }
  const doMes = gastos.filter((g) => mesDe(g.data) === mes);

  return (
    <View style={{ gap: espaco.g }}>
      <Dica
        id="resumo-mes"
        titulo="Escolha o mês aqui embaixo"
        texto="Os números e gráficos da primeira parte são do mês escolhido. Mais para baixo vêm os meses lado a lado e as compras do mercado."
      />
      <Texto variante="subtitulo">Mês</Texto>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {meses.map((m) => (
          <Ficha
            key={m.valor}
            rotulo={m.nome}
            selecionada={mes === m.valor.slice(0, 7)}
            aoPressionar={() => setMes(m.valor.slice(0, 7))}
          />
        ))}
      </ScrollView>
      <Comparacao gastos={gastos} mes={mes} eu={eu} />
      <Categorias gastos={doMes} />
      <QuemPagou gastos={doMes} nome={nome} />

      <Texto variante="subtitulo">Ao longo do tempo</Texto>
      <PorMes gastos={gastos} ate={mes} />
      <ContasFixas gastos={gastos} ate={mes} />

      <Texto variante="subtitulo">Mercado</Texto>
      <ItensDoMercado gastos={gastos} />
    </View>
  );
}

function Titulo({ titulo, dica }: { titulo: string; dica?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Texto variante="forte">{titulo}</Texto>
      {dica ? <Texto variante="suave">{dica}</Texto> : null}
    </View>
  );
}

// 7. este mês contra a média dos três anteriores, e a sua parte
function Comparacao({ gastos, mes, eu }: { gastos: Gasto[]; mes: string; eu: string }) {
  const tema = useTema();
  const { atual, media, variacao, mesesNaMedia } = comparacao(gastos, mes);
  const minhaParte = gastos
    .filter((g) => mesDe(g.data) === mes)
    .reduce((s, g) => s.plus(dec(g.divisoes.find((d) => d.usuario_id === eu)?.valor ?? 0)), new Decimal(0));
  const subiu = (variacao ?? 0) > 0;
  return (
    <Cartao>
      <Texto variante="rotulo">Gasto do grupo em {nomeDoMes(mes)}</Texto>
      <Texto variante="grande">{reais(atual)}</Texto>
      {variacao !== null && media ? (
        <Linha style={{ gap: 6 }}>
          <Icone
            nome={variacao === 0 ? 'remove' : subiu ? 'arrow-up' : 'arrow-down'}
            tamanho={18}
            cor={subiu ? tema.negativo : tema.positivo}
          />
          <Texto cor={subiu ? tema.negativo : tema.positivo} style={{ flex: 1 }}>
            {variacao === 0
              ? 'Igual à média'
              : `${Math.abs(variacao)}% ${subiu ? 'acima' : 'abaixo'} da média dos ${mesesNaMedia === 1 ? 'último mês' : `últimos ${mesesNaMedia} meses`}`}{' '}
            ({reais(media)})
          </Texto>
        </Linha>
      ) : (
        <Texto variante="suave">Ainda não há meses anteriores para comparar.</Texto>
      )}
      <Texto variante="suave">Sua parte: {reais(minhaParte)}</Texto>
    </Cartao>
  );
}

// 4. categorias do mês com a porcentagem
function Categorias({ gastos }: { gastos: Gasto[] }) {
  const tema = useTema();
  const lista = categoriasDoMes(gastos);
  if (lista.length === 0) return null;
  const maior = lista[0].total;
  return (
    <Cartao>
      <Titulo titulo="Em que o grupo gastou" />
      {lista.map((c) => {
        const info = infoCategoria(c.categoria);
        return (
          <View key={c.categoria} style={{ gap: 4 }}>
            <Linha>
              <Icone nome={info.icone as NomeIcone} tamanho={18} cor={info.cor} />
              <Texto style={{ flex: 1 }}>{info.nome}</Texto>
              <Texto variante="forte">{reais(c.total)}</Texto>
              <Texto variante="suave" style={{ width: 52, textAlign: 'right' }}>
                {String(c.porcento).replace('.', ',')}%
              </Texto>
            </Linha>
            <View style={[estilos.trilho, { backgroundColor: tema.superficie2 }]}>
              <View
                style={[
                  estilos.barra,
                  {
                    width: `${Math.max(Number(c.total.div(maior).times(100).toFixed(1)), 2)}%`,
                    backgroundColor: info.cor,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </Cartao>
  );
}

// 3. quem adiantou o dinheiro e qual era a parte de cada um
function QuemPagou({ gastos, nome }: { gastos: Gasto[]; nome: (u: string) => string }) {
  const tema = useTema();
  const lista = quemPagou(gastos);
  if (lista.length === 0) return null;
  const maior = lista.reduce((m, p) => Decimal.max(m, p.pago, p.parte), new Decimal(0));
  const largura = (v: Decimal) =>
    `${maior.isZero() ? 0 : Math.max(Number(v.div(maior).times(100).toFixed(1)), 1)}%` as const;
  return (
    <Cartao>
      <Titulo titulo="Quem pagou o quê" dica="Barra cheia: quanto a pessoa pagou. Barra clara: a parte dela." />
      {lista.map((p) => (
        <View key={p.usuario_id} style={{ gap: 4 }}>
          <Linha>
            <Avatar id={p.usuario_id} nome={nome(p.usuario_id)} tamanho={24} />
            <Texto style={{ flex: 1 }}>{nome(p.usuario_id)}</Texto>
            <Texto variante="suave">
              pagou {reais(p.pago)} · parte {reais(p.parte)}
            </Texto>
          </Linha>
          <View style={[estilos.trilho, { backgroundColor: tema.superficie2 }]}>
            <View style={[estilos.barra, { width: largura(p.pago), backgroundColor: tema.primaria }]} />
          </View>
          <View style={[estilos.trilho, { backgroundColor: tema.superficie2 }]}>
            <View style={[estilos.barra, { width: largura(p.parte), backgroundColor: `${tema.primaria}55` }]} />
          </View>
        </View>
      ))}
    </Cartao>
  );
}

// 1. gasto por mês, empilhado por categoria
function PorMes({ gastos, ate }: { gastos: Gasto[]; ate: string }) {
  const tema = useTema();
  const dados = totaisPorMes(gastos, mesesAte(ate, 6));
  const maior = dados.reduce((m, d) => Decimal.max(m, d.total), new Decimal(0));
  if (maior.isZero()) return null;
  const categorias = [...new Set(dados.flatMap((d) => d.porCategoria.map((c) => c.categoria)))];
  return (
    <Cartao>
      <Titulo titulo="Gasto por mês" dica="Cada cor é uma categoria." />
      <View style={estilos.colunas}>
        {dados.map((d) => (
          <View key={d.mes} style={estilos.coluna}>
            <Texto variante="suave" style={{ fontSize: 11 }} numberOfLines={1}>
              {d.total.gt(0)
                ? reais(d.total)
                    .replace('R$ ', '')
                    .replace(/,\d\d$/, '')
                : ''}
            </Texto>
            <View style={[estilos.pilha, { height: 140 }]}>
              <View
                style={{ height: `${Number(d.total.div(maior).times(100).toFixed(1))}%`, justifyContent: 'flex-end' }}>
                {d.porCategoria.map((c) => (
                  <View
                    key={c.categoria}
                    style={{
                      flex: Number(c.total.toFixed(2)),
                      backgroundColor: infoCategoria(c.categoria).cor,
                      minHeight: 2,
                    }}
                  />
                ))}
              </View>
            </View>
            <Texto
              variante="suave"
              cor={d.mes === ate ? tema.texto : tema.textoSuave}
              style={{ fontWeight: d.mes === ate ? '800' : '500' }}>
              {nomeDoMes(d.mes)}
            </Texto>
          </View>
        ))}
      </View>
      <Legenda itens={categorias.map((c) => ({ nome: infoCategoria(c).nome, cor: infoCategoria(c).cor }))} />
    </Cartao>
  );
}

// 2. contas fixas ao longo de 12 meses, uma linha por conta
function ContasFixas({ gastos, ate }: { gastos: Gasto[]; ate: string }) {
  const meses = mesesAte(ate, 12);
  const contas = contasFixas(gastos, meses);
  if (contas.length === 0) {
    return (
      <Cartao>
        <Titulo
          titulo="Contas fixas no ano"
          dica='Use a categoria "Contas" (luz, água, internet) para ver como cada uma muda.'
        />
      </Cartao>
    );
  }
  return (
    <Cartao>
      <Titulo titulo="Contas fixas no ano" dica="Luz, água, internet e outras contas, mês a mês." />
      <GraficoDeLinhas
        rotulos={meses.map(nomeDoMes)}
        series={contas.map((c, i) => ({ nome: c.nome, cor: CORES_LINHAS[i], valores: c.valores }))}
      />
      <Legenda itens={contas.map((c, i) => ({ nome: c.nome, cor: CORES_LINHAS[i] }))} />
    </Cartao>
  );
}

// 5 e 6. itens que mais pesam no mercado e o preço de um item em cada compra
function ItensDoMercado({ gastos }: { gastos: Gasto[] }) {
  const tema = useTema();
  const itens = itensMaisComprados(gastos);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  if (itens.length === 0) {
    return (
      <Cartao>
        <Titulo
          titulo="Itens mais comprados"
          dica='Aparecem aqui os itens das compras divididas "Por item" e dos cupons fiscais lidos pelo QR code.'
        />
      </Cartao>
    );
  }
  const chave = escolhido && itens.some((i) => i.chave === escolhido) ? escolhido : itens[0].chave;
  const precos = precoDoItem(gastos, chave);
  const maior = itens[0].total;
  return (
    <>
      <Cartao>
        <Titulo
          titulo="Itens mais comprados"
          dica="Quanto cada item já custou ao grupo, quantas vezes e o preço médio."
        />
        {itens.map((i) => (
          <View key={i.chave} style={{ gap: 4 }}>
            <Linha>
              <Texto style={{ flex: 1 }} numberOfLines={1}>
                {i.nome}
              </Texto>
              <Texto variante="forte">{reais(i.total)}</Texto>
            </Linha>
            <View style={[estilos.trilho, { backgroundColor: tema.superficie2 }]}>
              <View
                style={[
                  estilos.barra,
                  {
                    width: `${Math.max(Number(i.total.div(maior).times(100).toFixed(1)), 2)}%`,
                    backgroundColor: '#0E7C3F',
                  },
                ]}
              />
            </View>
            <Texto variante="suave">
              {i.vezes} {i.vezes === 1 ? 'compra' : 'compras'} · média {reais(i.medio)}
            </Texto>
          </View>
        ))}
      </Cartao>
      <Cartao>
        <Titulo titulo="Preço ao longo do tempo" dica="Escolha um item para ver quanto ele custou em cada compra." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {itens.map((i) => (
            <Ficha
              key={i.chave}
              rotulo={i.nome}
              selecionada={i.chave === chave}
              aoPressionar={() => setEscolhido(i.chave)}
            />
          ))}
        </ScrollView>
        {precos.length < 2 ? (
          <Texto variante="suave">Esse item só foi comprado uma vez ({reais(precos[0]?.valor ?? 0)}).</Texto>
        ) : (
          <GraficoDeLinhas
            rotulos={precos.map((p) => diaCurto(p.data))}
            series={[{ nome: 'Preço', cor: '#0E7C3F', valores: precos.map((p) => p.valor) }]}
            comValores
          />
        )}
      </Cartao>
    </>
  );
}

function Legenda({ itens }: { itens: { nome: string; cor: string }[] }) {
  return (
    <Linha style={{ flexWrap: 'wrap', gap: 10 }}>
      {itens.map((i) => (
        <Linha key={i.nome} style={{ gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: i.cor }} />
          <Texto variante="suave">{i.nome}</Texto>
        </Linha>
      ))}
    </Linha>
  );
}

// linhas em SVG; valores ausentes quebram a linha
function GraficoDeLinhas({
  rotulos,
  series,
  comValores = false,
}: {
  rotulos: string[];
  series: { nome: string; cor: string; valores: (Decimal | null)[] }[];
  comValores?: boolean;
}) {
  const tema = useTema();
  const [largura, setLargura] = useState(300);
  const altura = 170;
  const margem = {
    esquerda: comValores ? 22 : 10,
    direita: comValores ? 22 : 10,
    cima: comValores ? 22 : 12,
    baixo: 22,
  };
  const todos = series.flatMap((s) => s.valores.filter((v): v is Decimal => v !== null));
  const maximo = todos.reduce((m, v) => Decimal.max(m, v), new Decimal(0));
  const minimo = todos.reduce((m, v) => Decimal.min(m, v), maximo);
  const faixa = maximo.minus(minimo).isZero() ? new Decimal(1) : maximo.minus(minimo);
  const x = (i: number) =>
    margem.esquerda +
    (rotulos.length === 1 ? 0 : (i * (largura - margem.esquerda - margem.direita)) / (rotulos.length - 1));
  const y = (v: Decimal) =>
    margem.cima +
    (altura - margem.cima - margem.baixo) * (1 - Number(v.minus(minimo).div(faixa).toFixed(4)) * 0.9 - 0.05);
  const passo = Math.ceil(rotulos.length / 6);

  return (
    <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)} accessibilityRole="image">
      <Svg width={largura} height={altura}>
        <Line
          x1={margem.esquerda}
          x2={largura - margem.direita}
          y1={altura - margem.baixo}
          y2={altura - margem.baixo}
          stroke={tema.borda}
        />
        {series.map((s) => {
          const trechos: { i: number; v: Decimal }[][] = [[]];
          s.valores.forEach((v, i) => (v === null ? trechos.push([]) : trechos[trechos.length - 1].push({ i, v })));
          return (
            <G key={s.nome}>
              {trechos
                .filter((t) => t.length > 1)
                .map((t, k) => (
                  <Polyline
                    key={k}
                    points={t.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')}
                    fill="none"
                    stroke={s.cor}
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                  />
                ))}
              {s.valores.map((v, i) =>
                v === null ? null : (
                  <Circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={s.cor} stroke={tema.superficie} strokeWidth={1.5} />
                ),
              )}
              {comValores
                ? s.valores.map((v, i) =>
                    v === null ? null : (
                      <TextoSvg
                        key={`t${i}`}
                        x={x(i)}
                        y={y(v) - 8}
                        fontSize={10}
                        fontFamily="sans-serif"
                        fill={tema.texto}
                        textAnchor="middle">
                        {v.toFixed(2).replace('.', ',')}
                      </TextoSvg>
                    ),
                  )
                : null}
            </G>
          );
        })}
        {rotulos.map((r, i) =>
          i % passo === 0 || i === rotulos.length - 1 ? (
            <TextoSvg
              key={`r${i}`}
              x={x(i)}
              y={altura - 6}
              fontSize={10}
              fontFamily="sans-serif"
              fill={tema.textoSuave}
              textAnchor={i === 0 ? 'start' : i === rotulos.length - 1 ? 'end' : 'middle'}>
              {r}
            </TextoSvg>
          ) : null,
        )}
      </Svg>
    </View>
  );
}

const estilos = StyleSheet.create({
  trilho: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barra: { height: 8, borderRadius: 4 },
  colunas: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  coluna: { flex: 1, alignItems: 'center', gap: 4 },
  pilha: { width: '100%', justifyContent: 'flex-end', borderRadius: raio.p, overflow: 'hidden' },
});
