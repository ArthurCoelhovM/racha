import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { coresGrupo, corDaPessoa, espaco, larguraMaxima, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { mascaraDinheiro } from '@/lib/dinheiro';

// ---------- Texto ----------

type VarianteTexto = 'titulo' | 'subtitulo' | 'corpo' | 'forte' | 'suave' | 'rotulo' | 'grande';

export function Texto({
  variante = 'corpo',
  cor,
  style,
  children,
  numberOfLines,
  aoPressionar,
}: {
  variante?: VarianteTexto;
  cor?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  aoPressionar?: () => void;
}) {
  const tema = useTema();
  const corPadrao = variante === 'suave' || variante === 'rotulo' ? tema.textoSuave : tema.texto;
  return (
    <Text
      numberOfLines={numberOfLines}
      onPress={aoPressionar}
      accessibilityRole={aoPressionar ? 'link' : undefined}
      style={[estilosTexto[variante], { color: cor ?? corPadrao }, style]}>
      {children}
    </Text>
  );
}

const estilosTexto = StyleSheet.create({
  grande: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  titulo: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  subtitulo: { fontSize: 17, fontWeight: '700' },
  corpo: { fontSize: 15, lineHeight: 21 },
  forte: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  suave: { fontSize: 13, lineHeight: 18 },
  rotulo: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
});

// ---------- Tela ----------

export function Tela({
  children,
  aoAtualizar,
  atualizando = false,
  sobreposto,
  rolar = true,
}: {
  children: ReactNode;
  aoAtualizar?: () => void;
  atualizando?: boolean;
  sobreposto?: ReactNode;
  rolar?: boolean;
}) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  const conteudo = <View style={estilos.coluna}>{children}</View>;

  return (
    <View style={[estilos.tela, { backgroundColor: tema.fundo }]}>
      {rolar ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
          refreshControl={
            aoAtualizar ? (
              <RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} tintColor={tema.primaria} />
            ) : undefined
          }>
          {conteudo}
        </ScrollView>
      ) : (
        conteudo
      )}
      {sobreposto}
    </View>
  );
}

// ---------- Botão ----------

type VarianteBotao = 'primario' | 'secundario' | 'perigo' | 'texto';

export function Botao({
  titulo,
  aoPressionar,
  variante = 'primario',
  carregando = false,
  desabilitado = false,
  confirmar,
  pequeno = false,
  style,
}: {
  titulo: string;
  aoPressionar: () => void;
  variante?: VarianteBotao;
  carregando?: boolean;
  desabilitado?: boolean;
  confirmar?: string;
  pequeno?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const tema = useTema();
  const [pedindoConfirmacao, setPedindoConfirmacao] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );

  const fundo = {
    primario: tema.primaria,
    secundario: tema.superficie2,
    perigo: pedindoConfirmacao ? tema.negativo : tema.fundoNegativo,
    texto: 'transparent',
  }[variante];
  const corTexto = {
    primario: tema.sobrePrimaria,
    secundario: tema.texto,
    perigo: pedindoConfirmacao ? '#FFFFFF' : tema.negativo,
    texto: tema.primaria,
  }[variante];

  function pressionar() {
    if (confirmar && !pedindoConfirmacao) {
      setPedindoConfirmacao(true);
      temporizador.current = setTimeout(() => setPedindoConfirmacao(false), 4000);
      return;
    }
    if (temporizador.current) clearTimeout(temporizador.current);
    setPedindoConfirmacao(false);
    aoPressionar();
  }

  const inativo = desabilitado || carregando;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={pressionar}
      disabled={inativo}
      style={({ pressed }) => [
        estilos.botao,
        pequeno && estilos.botaoPequeno,
        { backgroundColor: fundo, opacity: inativo ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}>
      {carregando ? (
        <ActivityIndicator color={corTexto} />
      ) : (
        <Text style={[estilos.textoBotao, pequeno && estilos.textoBotaoPequeno, { color: corTexto }]}>
          {pedindoConfirmacao && confirmar ? confirmar : titulo}
        </Text>
      )}
    </Pressable>
  );
}

// ---------- Campo ----------

export function Campo({
  rotulo,
  erro,
  dica,
  style,
  ...props
}: TextInputProps & { rotulo?: string; erro?: string | null; dica?: string }) {
  const tema = useTema();
  const [focado, setFocado] = useState(false);
  return (
    <View style={estilos.campo}>
      {rotulo ? <Texto variante="rotulo">{rotulo}</Texto> : null}
      <TextInput
        placeholderTextColor={tema.textoSuave}
        accessibilityLabel={rotulo}
        {...props}
        onFocus={(e) => {
          setFocado(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocado(false);
          props.onBlur?.(e);
        }}
        style={[
          estilos.entrada,
          {
            color: tema.texto,
            backgroundColor: tema.superficie,
            borderColor: erro ? tema.negativo : focado ? tema.primaria : tema.borda,
          },
          style,
        ]}
      />
      {erro ? (
        <Texto variante="suave" cor={tema.negativo}>
          {erro}
        </Texto>
      ) : null}
      {!erro && dica ? <Texto variante="suave">{dica}</Texto> : null}
    </View>
  );
}

// Campo de dinheiro com máscara: a pessoa digita só números e os centavos entram sozinhos
export function CampoDinheiro({
  value,
  onChangeText,
  ...props
}: Omit<TextInputProps, 'keyboardType' | 'inputMode'> & { rotulo?: string; erro?: string | null; dica?: string }) {
  return (
    <Campo
      placeholder="0,00"
      {...props}
      value={value}
      onChangeText={(texto) => onChangeText?.(mascaraDinheiro(texto))}
      keyboardType="number-pad"
      inputMode="numeric"
    />
  );
}

// ---------- Cartão ----------

export function Cartao({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const tema = useTema();
  return (
    <View style={[estilos.cartao, { backgroundColor: tema.superficie, borderColor: tema.borda }, style]}>
      {children}
    </View>
  );
}

// ---------- Avatar ----------

// dentro de um grupo, cada pessoa ganha uma cor diferente, pela ordem de entrada
// e a inicial vem do nome de verdade, mesmo quando a tela mostra "Você"
type Pessoa = { cor: string; nome: string | null };
const ContextoCores = createContext<Map<string, Pessoa>>(new Map());

export function CoresDoGrupo({
  membros,
  children,
}: {
  membros: { usuario_id: string; perfil?: { nome: string } }[];
  children: ReactNode;
}) {
  const mapa = new Map(
    membros.map((m, i) => [m.usuario_id, { cor: coresGrupo[i % coresGrupo.length], nome: m.perfil?.nome ?? null }]),
  );
  return <ContextoCores.Provider value={mapa}>{children}</ContextoCores.Provider>;
}

export function Avatar({ id, nome, tamanho = 32 }: { id: string; nome: string; tamanho?: number }) {
  const pessoa = useContext(ContextoCores).get(id);
  const inicial = ((pessoa?.nome || nome).trim()[0] ?? '?').toUpperCase();
  return (
    <View
      style={[
        estilos.avatar,
        {
          width: tamanho,
          height: tamanho,
          borderRadius: tamanho / 2,
          backgroundColor: pessoa?.cor ?? corDaPessoa(id),
        },
      ]}>
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: tamanho * 0.42 }}>{inicial}</Text>
    </View>
  );
}

// ---------- Fichas (seleção) ----------

export function Ficha({
  rotulo,
  selecionada,
  aoPressionar,
  cor,
}: {
  rotulo: string;
  selecionada: boolean;
  aoPressionar: () => void;
  cor?: string;
}) {
  const tema = useTema();
  const destaque = cor ?? tema.primaria;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selecionada }}
      onPress={aoPressionar}
      style={[
        estilos.ficha,
        {
          backgroundColor: selecionada ? destaque : tema.superficie,
          borderColor: selecionada ? destaque : tema.borda,
        },
      ]}>
      <Text style={{ color: selecionada ? '#FFFFFF' : tema.texto, fontWeight: '600', fontSize: 14 }}>{rotulo}</Text>
    </Pressable>
  );
}

export function Fichas({ children }: { children: ReactNode }) {
  return <View style={estilos.fichas}>{children}</View>;
}

// ---------- Interruptor ----------

export function Interruptor({
  titulo,
  descricao,
  valor,
  aoMudar,
}: {
  titulo: string;
  descricao?: string;
  valor: boolean;
  aoMudar: (v: boolean) => void;
}) {
  const tema = useTema();
  return (
    <Pressable onPress={() => aoMudar(!valor)} style={estilos.interruptor}>
      <View style={{ flex: 1, gap: 2 }}>
        <Texto variante="forte">{titulo}</Texto>
        {descricao ? <Texto variante="suave">{descricao}</Texto> : null}
      </View>
      <Switch
        value={valor}
        onValueChange={aoMudar}
        trackColor={{ true: tema.primaria, false: tema.borda }}
        thumbColor="#FFFFFF"
        {...somenteWeb}
      />
    </Pressable>
  );
}

// no navegador a bolinha ligada tem cor própria
const somenteWeb = Platform.OS === 'web' ? ({ activeThumbColor: '#FFFFFF' } as object) : {};

// ---------- Aviso ----------

export function Aviso({
  texto,
  tipo = 'erro',
  acao,
  aoAcionar,
}: {
  texto: string;
  tipo?: 'erro' | 'ok' | 'info';
  acao?: string;
  aoAcionar?: () => void;
}) {
  const tema = useTema();
  const fundo = tipo === 'erro' ? tema.fundoNegativo : tipo === 'ok' ? tema.fundoPositivo : tema.superficie2;
  const cor = tipo === 'erro' ? tema.negativo : tipo === 'ok' ? tema.positivo : tema.texto;
  return (
    <View style={[estilos.aviso, { backgroundColor: fundo }]}>
      <Text style={{ color: cor, flex: 1, fontSize: 14, fontWeight: '600' }}>{texto}</Text>
      {acao && aoAcionar ? (
        <Pressable onPress={aoAcionar} hitSlop={8}>
          <Text style={{ color: cor, fontWeight: '800', fontSize: 14 }}>{acao}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------- Botão flutuante ----------

export function BotaoFlutuante({ titulo, aoPressionar }: { titulo: string; aoPressionar: () => void }) {
  const tema = useTema();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={aoPressionar}
      style={({ pressed }) => [
        estilos.flutuante,
        {
          backgroundColor: tema.primaria,
          bottom: insets.bottom + espaco.xg,
          right: Math.max(insets.right, 0) + espaco.xg,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}>
      <Text style={{ color: tema.sobrePrimaria, fontSize: 17, fontWeight: '800' }}>{titulo}</Text>
    </Pressable>
  );
}

// ---------- Estados ----------

export function Carregando() {
  const tema = useTema();
  return (
    <View style={estilos.centro}>
      <ActivityIndicator color={tema.primaria} size="large" />
    </View>
  );
}

export function Vazio({ titulo, texto, children }: { titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <View style={estilos.vazio}>
      <Texto variante="subtitulo" style={{ textAlign: 'center' }}>
        {titulo}
      </Texto>
      {texto ? (
        <Texto variante="suave" style={{ textAlign: 'center' }}>
          {texto}
        </Texto>
      ) : null}
      {children}
    </View>
  );
}

export function Separador() {
  const tema = useTema();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: tema.borda }} />;
}

export function Linha({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[estilos.linha, style]}>{children}</View>;
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  coluna: {
    width: '100%',
    maxWidth: larguraMaxima,
    alignSelf: 'center',
    padding: espaco.g,
    gap: espaco.g,
  },
  botao: {
    minHeight: 50,
    paddingHorizontal: espaco.g,
    borderRadius: raio.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoPequeno: { minHeight: 36, paddingHorizontal: espaco.m + 4, borderRadius: raio.p },
  textoBotao: { fontSize: 16, fontWeight: '700' },
  textoBotaoPequeno: { fontSize: 14 },
  campo: { gap: 6 },
  entrada: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: raio.m,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  cartao: { borderRadius: raio.g, borderWidth: 1, padding: espaco.g, gap: espaco.m },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  fichas: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.m },
  ficha: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: raio.total, borderWidth: 1.5 },
  interruptor: { flexDirection: 'row', alignItems: 'center', gap: espaco.m, paddingVertical: 4 },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: espaco.m, padding: 14, borderRadius: raio.m },
  flutuante: {
    position: 'absolute',
    paddingHorizontal: 22,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espaco.xxg },
  vazio: { alignItems: 'center', gap: espaco.m, paddingVertical: espaco.xxg, paddingHorizontal: espaco.g },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
});
