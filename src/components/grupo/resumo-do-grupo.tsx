import { StyleSheet, View } from 'react-native';

import { Avatar, Linha, Texto, Valor } from '@/components/ui';
import { espaco, raio, tomClaro } from '@/constants/tema';
import { useEscuro, useTema } from '@/hooks/use-tema';
import { Decimal, ehZero, reaisCobrar } from '@/lib/dinheiro';
import type { Pendencia } from '@/lib/saldos';
import type { Grupo, Membro } from '@/lib/tipos';

// a frase que abre o grupo: "Você paga R$ 42,00 à Bia" ou "Tudo certo neste grupo"
export function fraseDoGrupo(pendencias: Pendencia[], eu: string, nome: (u: string) => string): string {
  const somar = (lista: Pendencia[], quem: (p: Pendencia) => string) => {
    const mapa = new Map<string, Decimal>();
    for (const p of lista) mapa.set(quem(p), (mapa.get(quem(p)) ?? new Decimal(0)).plus(p.cobrar));
    return [...mapa].filter(([, v]) => !ehZero(v));
  };
  const pago = somar(
    pendencias.filter((p) => p.devedor === eu),
    (p) => p.credor,
  );
  const recebo = somar(
    pendencias.filter((p) => p.credor === eu),
    (p) => p.devedor,
  );
  const total = (l: [string, Decimal][]) => l.reduce((s, [, v]) => s.plus(v), new Decimal(0));
  // "paga R$ 42,00 para Bia" / "recebe R$ 90,00 de 2 pessoas"
  const parte = (l: [string, Decimal][], verbo: string, prep: string) =>
    l.length === 1
      ? `${verbo} ${reaisCobrar(l[0][1])} ${prep} ${nome(l[0][0])}`
      : `${verbo} ${reaisCobrar(total(l))} ${prep} ${l.length} pessoas`;

  if (pago.length === 0 && recebo.length === 0) return 'Tudo certo neste grupo';
  if (recebo.length === 0) return `Você ${parte(pago, 'paga', 'para')}`;
  if (pago.length === 0) return `Você ${parte(recebo, 'recebe', 'de')}`;
  return `Você ${parte(pago, 'paga', 'para')} e ${parte(recebo, 'recebe', 'de')}`;
}

export function ResumoDoGrupo({
  grupo,
  membros,
  voceDeve,
  teDevem,
  frase,
}: {
  grupo: Grupo;
  membros: Membro[];
  voceDeve: Decimal;
  teDevem: Decimal;
  frase: string;
}) {
  const tema = useTema();
  const escuro = useEscuro();
  const zerado = ehZero(voceDeve) && ehZero(teDevem);
  return (
    <View style={[estilos.resumo, { backgroundColor: tema.superficie, borderColor: tema.borda }]}>
      {/* um tom claro da cor do grupo no fundo, para saber em qual grupo você está */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tomClaro(grupo.cor, escuro) }]} />
      <View style={[estilos.faixa, { backgroundColor: grupo.cor }]} />
      <View style={{ flex: 1, padding: espaco.g, gap: espaco.m }}>
        <Texto variante="titulo">{frase}</Texto>
        {!zerado ? (
          <Linha style={{ gap: espaco.xg, flexWrap: 'wrap' }}>
            {!ehZero(voceDeve) ? (
              <View>
                <Texto variante="rotulo" cor={tema.negativo}>
                  ↓ Você paga
                </Texto>
                <Valor valor={voceDeve} cor={tema.negativo} tamanho={22} />
              </View>
            ) : null}
            {!ehZero(teDevem) ? (
              <View>
                <Texto variante="rotulo" cor={tema.positivo}>
                  ↑ Você recebe
                </Texto>
                <Valor valor={teDevem} cor={tema.positivo} tamanho={22} />
              </View>
            ) : null}
          </Linha>
        ) : null}
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
  );
}

const estilos = StyleSheet.create({
  resumo: { flexDirection: 'row', borderRadius: raio.g, borderWidth: 1, overflow: 'hidden' },
  faixa: { width: 6 },
});
