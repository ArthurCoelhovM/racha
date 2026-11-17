import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Cartao, Icone, Linha, Separador, Texto, Vazio } from '@/components/ui';
import { espaco, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { Decimal, reais } from '@/lib/dinheiro';
import { diaCurto } from '@/lib/formatos';
import type { Pendencia } from '@/lib/saldos';

// "acertar tudo" de um par: uma pendência só, sem gasto, com a soma de todas
export function pendenciaDoPar(lista: Pendencia[]): Pendencia {
  const total = lista.reduce((s, p) => s.plus(p.cobrar), new Decimal(0));
  const { devedor, credor } = lista[0];
  return {
    chave: `tudo|${devedor}|${credor}`,
    devedor,
    credor,
    valor: total,
    cobrar: total,
    gasto_id: null,
    descricao: null,
    data: null,
  };
}

export function ListaDeDividas({
  pendencias,
  eu,
  nome,
  abatimento,
  marcando,
  aoPagar,
  aoCobrar,
  aoPix,
  aoVerExtrato,
}: {
  pendencias: Pendencia[];
  eu: string;
  nome: (u: string) => string;
  abatimento: boolean;
  marcando: string | null;
  aoPagar: (p: Pendencia) => void;
  aoCobrar: (devedor: string) => void;
  aoPix: (p: Pendencia) => void;
  aoVerExtrato: (outro: string) => void;
}) {
  const tema = useTema();
  if (pendencias.length === 0) {
    return <Vazio titulo="Ninguém deve nada" texto="Quando alguém registrar um gasto, as dívidas aparecem aqui." />;
  }

  // sem abatimento, cada gasto é uma dívida: quem tem várias com a mesma pessoa acerta tudo de uma vez
  const pares = new Map<string, Pendencia[]>();
  if (!abatimento) {
    for (const p of pendencias) {
      if (p.devedor !== eu && p.credor !== eu) continue;
      const chave = `${p.devedor}|${p.credor}`;
      pares.set(chave, [...(pares.get(chave) ?? []), p]);
    }
  }
  const acertos = [...pares.values()].filter((l) => l.length > 1).map(pendenciaDoPar);

  return (
    <>
      {acertos.length > 0 ? (
        <Cartao style={{ padding: 0, gap: 0, borderColor: tema.primaria }}>
          {acertos.map((p, i) => {
            const outro = p.devedor === eu ? p.credor : p.devedor;
            return (
              <View key={p.chave}>
                {i > 0 ? <Separador /> : null}
                <Linha style={estilos.linha}>
                  <Avatar id={outro} nome={nome(outro)} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Texto variante="forte">Acertar tudo com {nome(outro)}</Texto>
                    <Texto variante="suave">
                      {p.devedor === eu ? 'Você deve' : 'Te deve'} {reais(p.cobrar)} somando{' '}
                      {pares.get(`${p.devedor}|${p.credor}`)!.length} gastos
                    </Texto>
                  </View>
                  {p.devedor === eu ? (
                    <BotaoPix rotulo={`Pagar com Pix a ${nome(outro)}`} aoPressionar={() => aoPix(p)} />
                  ) : null}
                  <BotaoPagar
                    titulo={p.devedor === eu ? 'Paguei' : 'Recebi'}
                    rotulo={`Acertar tudo com ${nome(outro)}`}
                    carregando={marcando === p.chave}
                    aoPressionar={() => aoPagar(p)}
                  />
                </Linha>
              </View>
            );
          })}
        </Cartao>
      ) : null}

      <Cartao style={{ padding: 0, gap: 0 }}>
        {pendencias.map((p, i) => (
          <View key={p.chave}>
            {i > 0 ? <Separador /> : null}
            <LinhaPendencia
              p={p}
              nome={nome}
              eu={eu}
              carregando={marcando === p.chave}
              aoPagar={() => aoPagar(p)}
              aoCobrar={() => aoCobrar(p.devedor)}
              aoPix={() => aoPix(p)}
              aoVerExtrato={() => aoVerExtrato(p.devedor === eu ? p.credor : p.devedor)}
            />
          </View>
        ))}
      </Cartao>
    </>
  );
}

function LinhaPendencia({
  p,
  nome,
  eu,
  carregando,
  aoPagar,
  aoCobrar,
  aoPix,
  aoVerExtrato,
}: {
  p: Pendencia;
  nome: (u: string) => string;
  eu: string;
  carregando: boolean;
  aoPagar: () => void;
  aoCobrar: () => void;
  aoPix: () => void;
  aoVerExtrato: () => void;
}) {
  const tema = useTema();
  const devo = p.devedor === eu;
  const recebo = p.credor === eu;
  // tocar na linha abre o extrato com a outra pessoa
  return (
    <Pressable
      onPress={devo || recebo ? aoVerExtrato : undefined}
      disabled={!devo && !recebo}
      accessibilityLabel={
        devo || recebo
          ? `Extrato com ${nome(devo ? p.credor : p.devedor)}: ${nome(p.devedor)} deve ${reais(p.cobrar)}`
          : undefined
      }
      style={({ pressed }) => [estilos.linha, estilos.linhaToque, { opacity: pressed ? 0.85 : 1 }]}>
      <View style={estilos.avatares}>
        <Avatar id={p.devedor} nome={nome(p.devedor)} tamanho={30} />
        <View style={[estilos.segundo, { borderColor: tema.superficie }]}>
          <Avatar id={p.credor} nome={nome(p.credor)} tamanho={30} />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Texto variante="forte" numberOfLines={2}>
          {nome(p.devedor)} deve a {nome(p.credor) === 'Você' ? 'você' : nome(p.credor)}
        </Texto>
        <Texto variante="subtitulo" cor={devo ? tema.negativo : recebo ? tema.positivo : tema.texto}>
          {reais(p.cobrar)}
        </Texto>
        {p.descricao ? (
          <Texto variante="suave" numberOfLines={1}>
            {p.descricao}
            {p.data ? ` · ${diaCurto(p.data)}` : ''}
          </Texto>
        ) : null}
      </View>
      {recebo ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Cobrar ${nome(p.devedor)}`}
          onPress={aoCobrar}
          hitSlop={6}
          style={({ pressed }) => [estilos.cobrar, { backgroundColor: tema.superficie2, opacity: pressed ? 0.7 : 1 }]}>
          <Icone nome="megaphone-outline" tamanho={18} cor={tema.primaria} />
        </Pressable>
      ) : null}
      {devo ? <BotaoPix rotulo={`Pagar com Pix a ${nome(p.credor)}`} aoPressionar={aoPix} /> : null}
      {devo || recebo ? (
        <BotaoPagar
          titulo={devo ? 'Paguei' : 'Recebi'}
          rotulo={devo ? 'Marcar que paguei' : 'Marcar que recebi'}
          carregando={carregando}
          aoPressionar={aoPagar}
        />
      ) : null}
    </Pressable>
  );
}

function BotaoPix({ rotulo, aoPressionar }: { rotulo: string; aoPressionar: () => void }) {
  const tema = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={aoPressionar}
      hitSlop={6}
      style={({ pressed }) => [estilos.pix, { backgroundColor: tema.superficie2, opacity: pressed ? 0.7 : 1 }]}>
      <Icone nome="qr-code-outline" tamanho={18} cor={tema.primaria} />
    </Pressable>
  );
}

// botão compacto à direita do valor
function BotaoPagar({
  titulo,
  rotulo,
  carregando,
  aoPressionar,
}: {
  titulo: string;
  rotulo: string;
  carregando: boolean;
  aoPressionar: () => void;
}) {
  const tema = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      disabled={carregando}
      onPress={aoPressionar}
      style={({ pressed }) => [
        estilos.pagar,
        { backgroundColor: tema.fundoPositivo, opacity: carregando ? 0.5 : pressed ? 0.7 : 1 },
      ]}>
      <Icone nome="checkmark" tamanho={16} cor={tema.positivo} />
      <Texto variante="forte" cor={tema.positivo} style={{ fontSize: 14 }}>
        {titulo}
      </Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  linha: { padding: espaco.g, gap: espaco.m + 4, alignItems: 'center' },
  avatares: { flexDirection: 'row', width: 54 },
  segundo: { marginLeft: -6, borderWidth: 2, borderRadius: 17 },
  pagar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: raio.total,
  },
  linhaToque: { flexDirection: 'row' },
  pix: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cobrar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
