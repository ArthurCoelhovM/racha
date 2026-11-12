import { StyleSheet, View } from 'react-native';

import { Avatar, Cartao, Linha, Texto } from '@/components/ui';
import { espaco } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { Decimal, ehZero, reais } from '@/lib/dinheiro';
import { saldoDaPessoa, type Pendencia } from '@/lib/saldos';
import type { Membro } from '@/lib/tipos';

export function SaldosPorPessoa({
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
    .map((m) => ({
      id: m.usuario_id,
      nome: nome(m.usuario_id),
      saldo: saldoDaPessoa(pendencias, m.usuario_id),
      ativo: m.ativo,
    }))
    .filter((s) => s.ativo || !ehZero(s.saldo))
    .sort((a, b) => b.saldo.comparedTo(a.saldo));

  const maior = saldos.reduce((m, s) => Decimal.max(m, s.saldo.abs()), new Decimal(0));

  if (grafico) {
    return (
      <Cartao>
        <Linha style={{ justifyContent: 'space-between' }}>
          <Texto variante="rotulo" cor={tema.negativo}>
            Deve
          </Texto>
          <Texto variante="rotulo" cor={tema.positivo}>
            Recebe
          </Texto>
        </Linha>
        {saldos.map((s) => {
          const fracao = maior.isZero() ? 0 : Number(s.saldo.abs().div(maior).toFixed(4));
          const positivo = s.saldo.gt(0);
          return (
            <View key={s.id} style={{ gap: 4, paddingVertical: 6 }}>
              <Linha style={{ justifyContent: 'space-between' }}>
                <Texto variante="forte">{s.nome}</Texto>
                <Texto
                  variante="forte"
                  cor={ehZero(s.saldo) ? tema.textoSuave : positivo ? tema.positivo : tema.negativo}>
                  {ehZero(s.saldo) ? 'quite' : `${positivo ? '+' : '−'} ${reais(s.saldo.abs())}`}
                </Texto>
              </Linha>
              <View style={estilos.trilho}>
                <View
                  style={[estilos.metade, { alignItems: 'flex-end', borderRightWidth: 1, borderColor: tema.borda }]}>
                  {!positivo && !ehZero(s.saldo) ? (
                    <View
                      style={[
                        estilos.barra,
                        { width: `${Math.max(fracao * 100, 3)}%`, backgroundColor: tema.negativo },
                      ]}
                    />
                  ) : null}
                </View>
                <View style={estilos.metade}>
                  {positivo ? (
                    <View
                      style={[
                        estilos.barra,
                        { width: `${Math.max(fracao * 100, 3)}%`, backgroundColor: tema.positivo },
                      ]}
                    />
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
              <Texto variante="forte" numberOfLines={1} style={{ flex: 1 }}>
                {s.nome}
              </Texto>
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

const estilos = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.m },
  cartaoPessoa: { flexGrow: 1, flexBasis: 150, gap: 6 },
  trilho: { flexDirection: 'row', height: 14 },
  metade: { flex: 1, justifyContent: 'center' },
  barra: { height: 12, borderRadius: 6 },
});
