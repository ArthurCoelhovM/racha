import { StyleSheet, View } from 'react-native';

import { Avatar, Linha, Texto } from '@/components/ui';
import { espaco, raio, tomClaro } from '@/constants/tema';
import { useEscuro, useTema } from '@/hooks/use-tema';
import { ehZero, reais, type Decimal } from '@/lib/dinheiro';
import type { Grupo, Membro } from '@/lib/tipos';

export function ResumoDoGrupo({
  grupo,
  membros,
  voceDeve,
  teDevem,
}: {
  grupo: Grupo;
  membros: Membro[];
  voceDeve: Decimal;
  teDevem: Decimal;
}) {
  const tema = useTema();
  const escuro = useEscuro();
  return (
    <View style={[estilos.resumo, { backgroundColor: tema.superficie, borderColor: tema.borda }]}>
      {/* um tom claro da cor do grupo no fundo, para saber em qual grupo você está */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tomClaro(grupo.cor, escuro) }]} />
      <View style={[estilos.faixa, { backgroundColor: grupo.cor }]} />
      <View style={{ flex: 1, padding: espaco.g, gap: espaco.m }}>
        {ehZero(voceDeve) && ehZero(teDevem) ? (
          <Texto variante="titulo">Tudo certo por aqui</Texto>
        ) : (
          <Linha style={{ gap: espaco.xg, flexWrap: 'wrap' }}>
            {!ehZero(voceDeve) ? (
              <View>
                <Texto variante="rotulo" cor={tema.negativo}>
                  Você deve
                </Texto>
                <Texto variante="grande" cor={tema.negativo}>
                  {reais(voceDeve)}
                </Texto>
              </View>
            ) : null}
            {!ehZero(teDevem) ? (
              <View>
                <Texto variante="rotulo" cor={tema.positivo}>
                  Te devem
                </Texto>
                <Texto variante="grande" cor={tema.positivo}>
                  {reais(teDevem)}
                </Texto>
              </View>
            ) : null}
          </Linha>
        )}
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
