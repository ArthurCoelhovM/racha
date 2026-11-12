import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Ficha, Fichas, Icone, Linha, Texto } from '@/components/ui';
import { espaco, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { hojeIso, isoParaBr } from '@/lib/formatos';

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

function iso(ano: number, mes: number, dia: number) {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// Data com atalhos: Hoje, Ontem ou um calendário, sem digitar dd/mm/aaaa
export function CampoData({ valor, aoMudar }: { valor: string; aoMudar: (iso: string) => void }) {
  const hoje = hojeIso();
  const ontem = somarDias(hoje, -1);
  const outro = valor !== hoje && valor !== ontem;
  const [aberto, setAberto] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      <Texto variante="rotulo">Data</Texto>
      <Fichas>
        <Ficha
          rotulo="Hoje"
          selecionada={valor === hoje}
          aoPressionar={() => {
            aoMudar(hoje);
            setAberto(false);
          }}
        />
        <Ficha
          rotulo="Ontem"
          selecionada={valor === ontem}
          aoPressionar={() => {
            aoMudar(ontem);
            setAberto(false);
          }}
        />
        <Ficha
          rotulo={outro ? isoParaBr(valor) : 'Outro dia'}
          selecionada={outro || aberto}
          aoPressionar={() => setAberto(!aberto)}
        />
      </Fichas>
      {aberto ? (
        <Calendario
          valor={valor}
          aoEscolher={(d) => {
            aoMudar(d);
            setAberto(false);
          }}
        />
      ) : null}
    </View>
  );
}

function Calendario({ valor, aoEscolher }: { valor: string; aoEscolher: (iso: string) => void }) {
  const tema = useTema();
  const [ano0, mes0] = valor.split('-').map(Number);
  const [ano, setAno] = useState(ano0);
  const [mes, setMes] = useState(mes0 - 1);
  const hoje = hojeIso();

  const primeiroDia = new Date(Date.UTC(ano, mes, 1)).getUTCDay();
  const diasNoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const casas: (number | null)[] = [
    ...Array.from({ length: primeiroDia }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];

  function andar(delta: number) {
    const d = new Date(Date.UTC(ano, mes + delta, 1));
    setAno(d.getUTCFullYear());
    setMes(d.getUTCMonth());
  }

  return (
    <View style={[estilos.calendario, { backgroundColor: tema.superficie, borderColor: tema.borda }]}>
      <Linha style={{ justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" onPress={() => andar(-1)} hitSlop={10}>
          <Icone nome="chevron-back" cor={tema.primaria} />
        </Pressable>
        <Texto variante="forte">
          {MESES[mes]} de {ano}
        </Texto>
        <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" onPress={() => andar(1)} hitSlop={10}>
          <Icone nome="chevron-forward" cor={tema.primaria} />
        </Pressable>
      </Linha>
      <View style={estilos.grade}>
        {DIAS.map((d, i) => (
          <View key={`c${i}`} style={estilos.casa}>
            <Texto variante="suave">{d}</Texto>
          </View>
        ))}
        {casas.map((dia, i) => {
          if (dia === null) return <View key={`v${i}`} style={estilos.casa} />;
          const data = iso(ano, mes, dia);
          const escolhido = data === valor;
          const futuro = data > hoje;
          return (
            <Pressable
              key={data}
              accessibilityRole="button"
              accessibilityLabel={isoParaBr(data)}
              accessibilityState={{ selected: escolhido }}
              onPress={() => aoEscolher(data)}
              style={estilos.casa}>
              <View
                style={[
                  estilos.dia,
                  escolhido && { backgroundColor: tema.primaria },
                  data === hoje && !escolhido && { borderWidth: 1.5, borderColor: tema.primaria },
                ]}>
                <Texto
                  cor={escolhido ? tema.sobrePrimaria : futuro ? tema.textoSuave : tema.texto}
                  style={{ fontWeight: escolhido ? '800' : '500' }}>
                  {dia}
                </Texto>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  calendario: { borderWidth: 1, borderRadius: raio.g, padding: espaco.m + 4, gap: espaco.m },
  grade: { flexDirection: 'row', flexWrap: 'wrap' },
  casa: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 },
  dia: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
