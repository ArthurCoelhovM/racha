import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Aviso, Botao, Campo, Cartao, Ficha, Fichas, Interruptor, Texto } from '@/components/ui';
import { coresGrupo, espaco } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import type { NovoGrupo } from '@/lib/api';
import { textoLembrete } from '@/lib/formatos';
import { TIPOS_DIVISAO, type TipoDivisao } from '@/lib/tipos';

const OPCOES_LEMBRETE = [0, 1, 3, 7, 15, 30];

export function FormularioGrupo({
  inicial,
  tituloBotao,
  aoSalvar,
  previaAbatimento,
}: {
  inicial?: NovoGrupo;
  tituloBotao: string;
  aoSalvar: (g: NovoGrupo) => Promise<void>;
  // num grupo que já existe, mostra como os saldos ficam antes de trocar o abatimento
  previaAbatimento?: (abatimento: boolean) => ReactNode;
}) {
  const tema = useTema();
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [cor, setCor] = useState(inicial?.cor ?? coresGrupo[0]);
  const [abatimento, setAbatimento] = useState(inicial?.abatimento ?? true);
  const [divisoes, setDivisoes] = useState<TipoDivisao[]>(inicial?.divisoes ?? TIPOS_DIVISAO.map((t) => t.tipo));
  const [lembreteDias, setLembreteDias] = useState(inicial?.lembreteDias ?? 7);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function alternarDivisao(tipo: TipoDivisao) {
    setDivisoes((atual) => (atual.includes(tipo) ? atual.filter((t) => t !== tipo) : [...atual, tipo]));
  }

  async function salvar() {
    if (!nome.trim()) return setErro('Dê um nome ao grupo.');
    if (divisoes.length === 0) return setErro('Escolha pelo menos uma forma de dividir.');
    setErro(null);
    setSalvando(true);
    try {
      const ordenadas = TIPOS_DIVISAO.map((t) => t.tipo).filter((t) => divisoes.includes(t));
      await aoSalvar({ nome: nome.trim(), cor, abatimento, divisoes: ordenadas, lembreteDias });
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <View style={{ gap: espaco.g }}>
      <Campo
        rotulo="Nome do grupo"
        value={nome}
        onChangeText={setNome}
        placeholder="Casa, Mercado, Viagem..."
        maxLength={60}
      />

      <View style={{ gap: espaco.m }}>
        <Texto variante="rotulo">Cor</Texto>
        <View style={estilos.cores}>
          {coresGrupo.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityState={{ selected: c === cor }}
              onPress={() => setCor(c)}
              style={[estilos.cor, { backgroundColor: c, borderColor: c === cor ? tema.texto : 'transparent' }]}
            />
          ))}
        </View>
      </View>

      <Cartao>
        <Interruptor
          titulo="Abater dívidas entre duas pessoas"
          descricao={
            abatimento
              ? 'Se A deve a B e B deve a A, só a diferença é cobrada. Nunca passa por uma terceira pessoa.'
              : 'Cada gasto é cobrado separado, sem compensar nada. Bom para luz, aluguel e contas fixas.'
          }
          valor={abatimento}
          aoMudar={setAbatimento}
        />
        {inicial && previaAbatimento && abatimento !== inicial.abatimento ? previaAbatimento(abatimento) : null}
      </Cartao>

      <View style={{ gap: espaco.m }}>
        <Texto variante="rotulo">Formas de dividir permitidas</Texto>
        <Fichas>
          {TIPOS_DIVISAO.map((t) => (
            <Ficha
              key={t.tipo}
              rotulo={t.nome}
              selecionada={divisoes.includes(t.tipo)}
              aoPressionar={() => alternarDivisao(t.tipo)}
            />
          ))}
        </Fichas>
      </View>

      <View style={{ gap: espaco.m }}>
        <Texto variante="rotulo">Lembrete de dívida</Texto>
        <Fichas>
          {OPCOES_LEMBRETE.map((dias) => (
            <Ficha
              key={dias}
              rotulo={textoLembrete(dias)}
              selecionada={lembreteDias === dias}
              aoPressionar={() => setLembreteDias(dias)}
            />
          ))}
        </Fichas>
      </View>

      {erro ? <Aviso texto={erro} /> : null}
      <Botao titulo={tituloBotao} aoPressionar={salvar} carregando={salvando} />
    </View>
  );
}

const estilos = StyleSheet.create({
  cores: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cor: { width: 36, height: 36, borderRadius: 18, borderWidth: 3 },
});
