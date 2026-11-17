import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Botao, Cartao, Icone, Linha, Separador, Texto, Vazio, type NomeIcone } from '@/components/ui';
import { espaco, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import {
  foiToqueLongo,
  LinhaDeslizavel,
  marcarToqueLongo,
  MenuDeAcoes,
  soltouToque,
  type Acao,
} from '@/components/acoes';
import { agruparPorData } from '@/lib/agrupar';
import { useCompacto } from '@/lib/preferencias';
import { dec, reais, reaisCobrar } from '@/lib/dinheiro';
import { diaCurto, hojeIso, isoParaBr } from '@/lib/formatos';
import type { Pendencia } from '@/lib/saldos';
import { infoCategoria, type Gasto, type LancamentoPendente, type Recorrente } from '@/lib/tipos';

// Um gasto está pago quando nenhuma das dívidas que ele criou continua em aberto.
// Sem abatimento, a pendência aponta para o gasto; com abatimento, para o par de pessoas.
export function gastoPago(g: Gasto, pendencias: Pendencia[]): boolean {
  if (g.dividas.length === 0) return true;
  return !g.dividas.some((d) =>
    pendencias.some(
      (p) => p.devedor === d.devedor && p.credor === d.credor && (p.gasto_id === null || p.gasto_id === g.id),
    ),
  );
}

// contas de valor variável esperando alguém preencher o valor do mês
export function ContasSemValor({
  pendentes,
  eu,
  nome,
  aoPreencher,
}: {
  pendentes: LancamentoPendente[];
  eu: string;
  nome: (u: string) => string;
  aoPreencher: (p: LancamentoPendente) => void;
}) {
  const tema = useTema();
  if (pendentes.length === 0) return null;
  return (
    <Cartao style={{ borderColor: tema.aviso }}>
      <Texto variante="rotulo" cor={tema.aviso}>
        Falta o valor
      </Texto>
      {pendentes.map((p) => (
        <Linha key={p.id} style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Texto variante="forte" numberOfLines={1}>
              {p.recorrente?.descricao ?? 'Conta'} · {isoParaBr(p.data)}
            </Texto>
            <Texto variante="suave">
              {p.responsavel === eu ? 'Você preenche' : `${nome(p.responsavel)} preenche`} o valor desta conta
            </Texto>
          </View>
          <Botao pequeno titulo="Preencher" aoPressionar={() => aoPreencher(p)} />
        </Linha>
      ))}
    </Cartao>
  );
}

export function ListaDeRecorrentes({
  recorrentes,
  aoParar,
}: {
  recorrentes: Recorrente[];
  aoParar: (r: Recorrente) => void;
}) {
  if (recorrentes.length === 0) return null;
  return (
    <Cartao>
      <Texto variante="rotulo">Repetem sozinhos</Texto>
      {recorrentes.map((r) => (
        <Linha key={r.id} style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Texto variante="forte" numberOfLines={1}>
              {r.descricao} · {reais(dec(r.valor_total))}
            </Texto>
            <Texto variante="suave">
              {r.frequencia === 'mensal' ? 'Todo mês' : 'Toda semana'}
              {r.valor_variavel ? ', valor muda' : ''}, próximo em {isoParaBr(r.proxima_data)}
            </Texto>
          </View>
          <Botao pequeno variante="perigo" titulo="Parar" aoPressionar={() => aoParar(r)} />
        </Linha>
      ))}
    </Cartao>
  );
}

export function ListaDeGastos({
  gastos,
  pendencias,
  total,
  eu,
  nome,
  carregandoMais,
  aoAbrir,
  aoCarregarMais,
  aoRegistrar,
}: {
  aoRegistrar?: () => void;
  gastos: Gasto[];
  pendencias: Pendencia[];
  total: number;
  eu: string;
  nome: (u: string) => string;
  carregandoMais: boolean;
  aoAbrir: (g: Gasto) => void;
  aoCarregarMais: () => void;
}) {
  if (gastos.length === 0) {
    return (
      <Vazio
        desenho="sacola"
        titulo="Nenhum gasto ainda"
        texto="Mercado, luz, pizza: tudo o que o grupo dividir aparece aqui."
        acao={aoRegistrar ? 'Registrar o primeiro gasto' : undefined}
        aoAcionar={aoRegistrar}
      />
    );
  }
  return (
    <>
      <GastosPorData
        gastos={gastos}
        linha={(g) => (
          <LinhaGastoComAcoes g={g} eu={eu} nome={nome} pago={gastoPago(g, pendencias)} aoAbrir={() => aoAbrir(g)} />
        )}
      />
      {gastos.length < total ? (
        <Botao
          titulo={`Ver mais gastos (${total - gastos.length})`}
          variante="texto"
          carregando={carregandoMais}
          aoPressionar={aoCarregarMais}
        />
      ) : null}
    </>
  );
}

// "Hoje", "Ontem", "Esta semana", depois cada mês, com o subtotal à direita
export function GastosPorData<T extends Gasto>({ gastos, linha }: { gastos: T[]; linha: (g: T) => ReactNode }) {
  const blocos = agruparPorData(gastos, hojeIso());
  return (
    <>
      {blocos.map((b) => (
        <View key={b.titulo} style={{ gap: 6 }}>
          <Linha style={estilos.titulo}>
            <Texto variante="rotulo" style={{ flex: 1 }}>
              {b.titulo}
            </Texto>
            <Texto variante="suave" style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {reais(b.total)}
            </Texto>
          </Linha>
          <Cartao style={{ padding: 0, gap: 0 }}>
            {b.itens.map((g, i) => (
              <View key={g.id}>
                {i > 0 ? <Separador /> : null}
                {linha(g)}
              </View>
            ))}
          </Cartao>
        </View>
      ))}
    </>
  );
}

// a linha do gasto com deslizar para o lado e toque longo: editar, duplicar ou comentar
export function LinhaGastoComAcoes(props: Parameters<typeof LinhaGasto>[0]) {
  const [menu, setMenu] = useState(false);
  const g = props.g;
  const acoes: Acao[] = [
    {
      titulo: 'Editar',
      icone: 'create-outline',
      acao: () => router.push({ pathname: '/grupo/[id]/gasto', params: { id: g.grupo_id, gastoId: g.id } }),
    },
    {
      titulo: 'Duplicar',
      icone: 'copy-outline',
      acao: () => router.push({ pathname: '/grupo/[id]/gasto', params: { id: g.grupo_id, copiar: g.id } }),
    },
    {
      titulo: 'Comentar',
      icone: 'chatbubble-outline',
      acao: () =>
        router.push({ pathname: '/grupo/[id]/gasto', params: { id: g.grupo_id, gastoId: g.id, comentar: '1' } }),
    },
  ];
  return (
    <>
      <LinhaDeslizavel acoes={acoes}>
        <LinhaGasto {...props} aoSegurar={() => setMenu(true)} />
      </LinhaDeslizavel>
      <MenuDeAcoes titulo={menu ? g.descricao : null} acoes={acoes} aoFechar={() => setMenu(false)} />
    </>
  );
}

export function LinhaGasto({
  g,
  eu,
  nome,
  pago,
  aoAbrir,
  aoSegurar,
  grupo,
}: {
  aoSegurar?: () => void;
  g: Gasto;
  eu: string;
  nome: (u: string) => string;
  pago: boolean;
  aoAbrir: () => void;
  grupo?: { nome: string; cor: string };
}) {
  const tema = useTema();
  const minhaParte = g.divisoes.find((d) => d.usuario_id === eu);
  const pagou = g.pagadores.map((p) => nome(p.usuario_id).replace(/^Você$/, 'você')).join(' e ');
  const categoria = infoCategoria(g.categoria);
  const compacto = useCompacto();
  return (
    <Pressable
      onPress={() => {
        if (!foiToqueLongo()) aoAbrir();
      }}
      onPressOut={soltouToque}
      onLongPress={
        aoSegurar
          ? () => {
              marcarToqueLongo();
              aoSegurar();
            }
          : undefined
      }
      delayLongPress={350}
      accessibilityHint={aoSegurar ? 'Segure para editar, duplicar ou comentar' : undefined}
      style={({ pressed }) => [estilos.linha, compacto && estilos.linhaCompacta, { opacity: pressed ? 0.7 : 1 }]}>
      <Linha>
        <View style={[estilos.icone, compacto && estilos.iconeCompacto, { backgroundColor: `${categoria.cor}1F` }]}>
          <Icone nome={categoria.icone as NomeIcone} tamanho={compacto ? 16 : 20} cor={categoria.cor} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Texto variante="forte" numberOfLines={1}>
            {g.descricao}
          </Texto>
          {grupo ? (
            <Linha style={{ gap: 6 }}>
              <View style={[estilos.bolinha, { backgroundColor: grupo.cor }]} />
              <Texto variante="suave" numberOfLines={1} style={{ flexShrink: 1, fontWeight: '600' }}>
                {grupo.nome}
              </Texto>
            </Linha>
          ) : null}
          <Texto variante="suave" numberOfLines={1}>
            {compacto ? '' : `${diaCurto(g.data)} · `}pago por {pagou}
            {g.recorrente_id ? ' ↻' : ''}
            {g.comprovante ? ' 📎' : ''}
          </Texto>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Linha style={{ gap: 6 }}>
            {pago && g.dividas.length > 0 ? (
              <View style={[estilos.selo, { backgroundColor: tema.fundoPositivo }]}>
                <Texto variante="suave" cor={tema.positivo} style={{ fontWeight: '800', fontSize: 11 }}>
                  PAGO
                </Texto>
              </View>
            ) : null}
            <Texto variante="forte">{reais(dec(g.valor_total))}</Texto>
          </Linha>
          {minhaParte && !compacto ? <Texto variante="suave">sua parte {reaisCobrar(minhaParte.valor)}</Texto> : null}
        </View>
      </Linha>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  linha: { padding: espaco.g, gap: espaco.m },
  linhaCompacta: { paddingVertical: 9 },
  iconeCompacto: { width: 30, height: 30 },
  icone: { width: 40, height: 40, borderRadius: raio.m, alignItems: 'center', justifyContent: 'center' },
  titulo: { paddingHorizontal: 4, paddingTop: espaco.m },
  bolinha: { width: 8, height: 8, borderRadius: 4 },
  selo: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
});
