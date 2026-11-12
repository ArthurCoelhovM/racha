import { Pressable, StyleSheet, View } from 'react-native';

import { Botao, Cartao, Linha, Separador, Texto, Vazio } from '@/components/ui';
import { espaco, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { dec, reais, reaisCobrar } from '@/lib/dinheiro';
import { diaCurto, isoParaBr } from '@/lib/formatos';
import type { Pendencia } from '@/lib/saldos';
import type { Gasto, Recorrente } from '@/lib/tipos';

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
              {r.frequencia === 'mensal' ? 'Todo mês' : 'Toda semana'}, próximo em {isoParaBr(r.proxima_data)}
            </Texto>
          </View>
          <Botao pequeno variante="perigo" titulo="Parar" confirmar="Parar?" aoPressionar={() => aoParar(r)} />
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
}: {
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
    return <Vazio titulo="Nenhum gasto ainda" texto="Toque em + Gasto para registrar o primeiro." />;
  }
  return (
    <>
      <Cartao style={{ padding: 0, gap: 0 }}>
        {gastos.map((g, i) => (
          <View key={g.id}>
            {i > 0 ? <Separador /> : null}
            <LinhaGasto g={g} eu={eu} nome={nome} pago={gastoPago(g, pendencias)} aoAbrir={() => aoAbrir(g)} />
          </View>
        ))}
      </Cartao>
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

function LinhaGasto({
  g,
  eu,
  nome,
  pago,
  aoAbrir,
}: {
  g: Gasto;
  eu: string;
  nome: (u: string) => string;
  pago: boolean;
  aoAbrir: () => void;
}) {
  const tema = useTema();
  const minhaParte = g.divisoes.find((d) => d.usuario_id === eu);
  const pagou = g.pagadores.map((p) => nome(p.usuario_id)).join(' e ');
  return (
    <Pressable onPress={aoAbrir} style={({ pressed }) => [estilos.linha, { opacity: pressed ? 0.7 : 1 }]}>
      <Linha>
        <View style={[estilos.data, { backgroundColor: tema.superficie2 }]}>
          <Texto variante="suave" style={{ fontWeight: '700' }}>
            {diaCurto(g.data)}
          </Texto>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Texto variante="forte" numberOfLines={1}>
            {g.descricao}
          </Texto>
          <Texto variante="suave" numberOfLines={1}>
            Pago por {pagou}
            {g.recorrente_id ? ' ↻' : ''}
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
          {minhaParte ? <Texto variante="suave">sua parte {reaisCobrar(minhaParte.valor)}</Texto> : null}
        </View>
      </Linha>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  linha: { padding: espaco.g, gap: espaco.m },
  data: { width: 52, paddingVertical: 8, borderRadius: raio.p, alignItems: 'center' },
  selo: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
});
