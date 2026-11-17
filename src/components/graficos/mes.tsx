import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GraficoDeLinhas, Legenda } from '@/components/graficos/linhas';
import {
  Aviso,
  Botao,
  CampoDinheiro,
  Cartao,
  Icone,
  Linha,
  Texto,
  useCorDaPessoa,
  type NomeIcone,
} from '@/components/ui';
import { raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { definirMetas, mensagemDeErro, type Metas } from '@/lib/api';
import { Decimal, lerValor, paraCampo, reais } from '@/lib/dinheiro';
import { isoParaBr } from '@/lib/formatos';
import { custoPorPessoa, gastoPorDia, metasDoMes, nomeDoMes, previsaoDoMes } from '@/lib/graficos';
import {
  CATEGORIAS,
  infoCategoria,
  type Categoria,
  type Gasto,
  type LancamentoPendente,
  type Recorrente,
} from '@/lib/tipos';

function Titulo({ titulo, dica }: { titulo: string; dica?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Texto variante="forte">{titulo}</Texto>
      {dica ? <Texto variante="suave">{dica}</Texto> : null}
    </View>
  );
}

const pct = (v: Decimal, de: Decimal) =>
  `${de.isZero() ? 0 : Math.min(Number(v.div(de).times(100).toFixed(1)), 100)}%` as const;

// Previsão do mês: barra do que já saiu e do que ainda vem dos gastos que se repetem
export function Previsao({
  gastos,
  recorrentes,
  pendentes,
  mes,
}: {
  gastos: Gasto[];
  recorrentes: Recorrente[];
  pendentes: LancamentoPendente[];
  mes: string;
}) {
  const tema = useTema();
  const p = previsaoDoMes(gastos, recorrentes, pendentes, mes);
  if (p.previsto.isZero()) return null;
  return (
    <Cartao>
      <Titulo
        titulo={`${nomeDoMes(mes)} deve fechar em uns ${reais(p.total).replace(/,\d\d$/, '')}`}
        dica="O que já foi gasto mais o que ainda vem das contas que se repetem."
      />
      <View style={[estilos.trilhoGrosso, { backgroundColor: tema.superficie2 }]}>
        <View style={{ width: pct(p.gasto, p.total), backgroundColor: tema.primaria }} />
        <View style={{ width: pct(p.previsto, p.total), backgroundColor: `${tema.primaria}55` }} />
      </View>
      <Legenda
        itens={[
          { nome: `Já gasto ${reais(p.gasto)}`, cor: tema.primaria },
          { nome: `Ainda vem ${reais(p.previsto)}`, cor: `${tema.primaria}55` },
        ]}
      />
      {p.porVir.map((x, i) => (
        <Linha key={`${x.descricao}-${x.data}-${i}`} style={{ justifyContent: 'space-between' }}>
          <Texto variante="suave" style={{ flex: 1 }} numberOfLines={1}>
            {isoParaBr(x.data).slice(0, 5)} · {x.descricao}
          </Texto>
          <Texto variante="suave">{reais(x.valor)}</Texto>
        </Linha>
      ))}
    </Cartao>
  );
}

// Meta por categoria: quanto do orçamento do mês já foi, com o editor das metas para quem pode mudar o grupo
export function MetasDoMes({
  gastos,
  metas,
  grupoId,
  podeMudar,
  aoMudar,
}: {
  gastos: Gasto[];
  metas: Metas;
  grupoId: string;
  podeMudar: boolean;
  aoMudar: () => Promise<unknown>;
}) {
  const tema = useTema();
  const [editando, setEditando] = useState(false);
  const lista = metasDoMes(gastos, metas);

  if (editando)
    return <EditarMetas metas={metas} grupoId={grupoId} aoFechar={() => setEditando(false)} aoMudar={aoMudar} />;
  if (lista.length === 0) {
    if (!podeMudar) return null;
    return (
      <Cartao>
        <Titulo
          titulo="Metas do mês"
          dica="Diga quanto o grupo quer gastar por mês no mercado, nas contas e no resto."
        />
        <Botao titulo="Definir metas" variante="secundario" aoPressionar={() => setEditando(true)} />
      </Cartao>
    );
  }

  return (
    <Cartao>
      <Linha style={{ justifyContent: 'space-between' }}>
        <Titulo titulo="Metas do mês" />
        {podeMudar ? (
          <Texto variante="forte" cor={tema.primaria} aoPressionar={() => setEditando(true)}>
            Editar
          </Texto>
        ) : null}
      </Linha>
      {lista.map((m) => {
        const info = infoCategoria(m.categoria);
        const passou = m.gasto.gt(m.meta);
        const cor = passou ? tema.negativo : m.porcento >= 85 ? tema.aviso : info.cor;
        const resta = m.meta.minus(m.gasto);
        return (
          <View key={m.categoria} style={{ gap: 4 }}>
            <Linha>
              <Icone nome={info.icone as NomeIcone} tamanho={18} cor={info.cor} />
              <Texto style={{ flex: 1 }}>{info.nome}</Texto>
              <Texto variante="forte">
                {reais(m.gasto).replace(/,\d\d$/, '')} de {reais(m.meta).replace(/,\d\d$/, '')}
              </Texto>
            </Linha>
            <View style={[estilos.trilho, { backgroundColor: tema.superficie2 }]}>
              <View style={[estilos.barra, { width: pct(m.gasto, m.meta), backgroundColor: cor }]} />
            </View>
            <Texto variante="suave" cor={passou ? tema.negativo : undefined}>
              {passou ? `Passou ${reais(resta.neg())} da meta` : `Ainda cabem ${reais(resta)} (${m.porcento}% usado)`}
            </Texto>
          </View>
        );
      })}
    </Cartao>
  );
}

function EditarMetas({
  metas,
  grupoId,
  aoFechar,
  aoMudar,
}: {
  metas: Metas;
  grupoId: string;
  aoFechar: () => void;
  aoMudar: () => Promise<unknown>;
}) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(CATEGORIAS.map((c) => [c.categoria, metas[c.categoria] ? paraCampo(metas[c.categoria]!) : ''])),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const novas: Metas = {};
    for (const c of CATEGORIAS) {
      const v = lerValor(valores[c.categoria] ?? '');
      if (v && v.gt(0)) novas[c.categoria as Categoria] = Number(v.toFixed(2));
    }
    setSalvando(true);
    setErro(null);
    try {
      await definirMetas(grupoId, novas);
      await aoMudar();
      aoFechar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Cartao>
      <Titulo titulo="Metas do mês" dica="Deixe em branco a categoria sem meta. Vale para todo o grupo." />
      {CATEGORIAS.map((c) => (
        <Linha key={c.categoria}>
          <Icone nome={c.icone as NomeIcone} tamanho={18} cor={c.cor} />
          <Texto style={{ width: 110 }}>{c.nome}</Texto>
          <View style={{ flex: 1 }}>
            <CampoDinheiro
              value={valores[c.categoria]}
              onChangeText={(t) => setValores({ ...valores, [c.categoria]: t })}
              accessibilityLabel={`Meta de ${c.nome}`}
              placeholder="sem meta"
            />
          </View>
        </Linha>
      ))}
      {erro ? <Aviso texto={erro} /> : null}
      <Botao titulo="Salvar metas" aoPressionar={salvar} carregando={salvando} />
      <Botao titulo="Cancelar" variante="texto" aoPressionar={aoFechar} />
    </Cartao>
  );
}

const DIAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

// Calendário: cada dia mais escuro quanto mais saiu; tocar mostra o valor
export function Calendario({ gastos, mes }: { gastos: Gasto[]; mes: string }) {
  const tema = useTema();
  const { valores, primeiro } = gastoPorDia(gastos, mes);
  const [dia, setDia] = useState<number | null>(null);
  const maior = valores.reduce((m, v) => Decimal.max(m, v), new Decimal(0));
  if (maior.isZero()) return null;
  const celulas: (number | null)[] = [...Array.from({ length: primeiro }, () => null), ...valores.map((_, i) => i)];
  while (celulas.length % 7) celulas.push(null);

  const escolhido = dia ?? valores.findIndex((v) => v.eq(maior));
  return (
    <Cartao>
      <Titulo titulo="Em que dias o dinheiro saiu" dica="Quanto mais escuro, mais se gastou no dia. Toque num dia." />
      <View style={estilos.semana}>
        {DIAS.map((d, i) => (
          <Texto key={i} variante="suave" style={estilos.celulaTexto}>
            {d}
          </Texto>
        ))}
      </View>
      {Array.from({ length: celulas.length / 7 }, (_, s) => (
        <View key={s} style={estilos.semana}>
          {celulas.slice(s * 7, s * 7 + 7).map((c, i) => {
            if (c === null) return <View key={i} style={estilos.celula} />;
            const v = valores[c];
            const forca = v.isZero() ? 0 : 0.18 + 0.82 * Number(v.div(maior).toFixed(3));
            const ativo = c === escolhido;
            return (
              <Pressable
                key={i}
                onPress={() => setDia(c)}
                accessibilityRole="button"
                accessibilityLabel={`Dia ${c + 1}: ${reais(v)}`}
                style={[
                  estilos.celula,
                  {
                    backgroundColor: v.isZero() ? tema.superficie2 : tema.primaria,
                    opacity: v.isZero() ? 1 : forca,
                    borderWidth: ativo ? 2 : 0,
                    borderColor: tema.texto,
                  },
                ]}>
                <Texto
                  variante="suave"
                  cor={forca > 0.55 ? tema.sobrePrimaria : tema.texto}
                  style={{ fontSize: 11, fontWeight: '700' }}>
                  {c + 1}
                </Texto>
              </Pressable>
            );
          })}
        </View>
      ))}
      <Texto variante="forte">
        Dia {escolhido + 1}: {reais(valores[escolhido])}
      </Texto>
    </Cartao>
  );
}

// Quanto custa morar na casa: a parte de cada pessoa por mês, uma linha por pessoa
export function CustoPorPessoa({
  gastos,
  meses,
  nome,
}: {
  gastos: Gasto[];
  meses: string[];
  nome: (u: string) => string;
}) {
  const cor = useCorDaPessoa();
  const pessoas = custoPorPessoa(gastos, meses).slice(0, 6);
  if (pessoas.length === 0) return null;
  return (
    <Cartao>
      <Titulo titulo="Quanto custa morar aqui" dica="A parte de cada pessoa nos gastos, mês a mês." />
      <GraficoDeLinhas
        rotulos={meses.map(nomeDoMes)}
        series={pessoas.map((p) => ({ nome: p.usuario_id, cor: cor(p.usuario_id), valores: p.valores }))}
      />
      <Legenda
        itens={pessoas.map((p) => ({
          nome: `${nome(p.usuario_id)} ${reais(p.valores[p.valores.length - 1]).replace(/,\d\d$/, '')}`,
          cor: cor(p.usuario_id),
        }))}
      />
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  trilho: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barra: { height: 8, borderRadius: 4 },
  trilhoGrosso: { height: 16, borderRadius: 8, overflow: 'hidden', flexDirection: 'row' },
  semana: { flexDirection: 'row', gap: 4 },
  celula: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 44,
    borderRadius: raio.p,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celulaTexto: { flex: 1, textAlign: 'center', fontWeight: '700' },
});
