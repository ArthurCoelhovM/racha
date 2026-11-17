import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Icone, Linha, Texto } from '@/components/ui';
import { espaco, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { usePrimeirosPassos } from '@/lib/consultas';
import { situacaoPush } from '@/lib/push';
import type { ResumoGrupo } from '@/lib/tipos';
import { pularPrimeirosPassos, pulouPrimeirosPassos } from '@/lib/tutorial';

type Passo = { titulo: string; feito: boolean; acao: () => void };

function ehIphoneNoNavegador(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const instalado = nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  return /iPhone|iPad|iPod/i.test(nav.userAgent) && !instalado;
}

// Cartão na tela inicial com cinco tarefas que se marcam sozinhas; some quando tudo estiver feito
export function PrimeirosPassos({ grupos, aoNovoGasto }: { grupos: ResumoGrupo[]; aoNovoGasto: () => void }) {
  const tema = useTema();
  const [pulou, setPulou] = useState(pulouPrimeirosPassos);
  const passos = usePrimeirosPassos(!pulou);
  const [push, setPush] = useState<{ disponivel: boolean; ativo: boolean } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (pulou) return;
      situacaoPush()
        .then(setPush)
        .catch(() => setPush(null));
    }, [pulou]),
  );

  if (pulou || !passos.data) return null;
  const p = passos.data;
  const primeiro = grupos[0]?.grupo_id;

  const lista: Passo[] = [
    { titulo: 'Criar ou entrar num grupo', feito: p.tem_grupo, acao: () => router.push('/grupo/novo') },
    {
      titulo: 'Convidar alguém',
      feito: p.convidou,
      acao: () =>
        primeiro
          ? router.push({ pathname: '/grupo/[id]/convite', params: { id: primeiro } })
          : router.push('/grupo/novo'),
    },
    { titulo: 'Registrar o primeiro gasto', feito: p.registrou_gasto, acao: aoNovoGasto },
    {
      titulo: 'Marcar um pagamento',
      feito: p.marcou_pagamento,
      acao: () => (primeiro ? router.push({ pathname: '/grupo/[id]', params: { id: primeiro } }) : undefined),
    },
  ];
  if (ehIphoneNoNavegador()) {
    // a dica de como instalar fica logo acima, na tela inicial
    lista.push({ titulo: 'No iPhone: adicionar à Tela de Início', feito: false, acao: () => {} });
  } else if (push?.disponivel) {
    lista.push({ titulo: 'Ligar as notificações', feito: push.ativo, acao: () => router.push('/conta') });
  }

  const feitos = lista.filter((x) => x.feito).length;
  if (feitos === lista.length) return null;

  function pular() {
    pularPrimeirosPassos();
    setPulou(true);
  }

  return (
    <View style={[estilos.cartao, { backgroundColor: tema.superficie, borderColor: tema.borda }]}>
      <Linha style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Texto variante="subtitulo">Primeiros passos</Texto>
          <Texto variante="suave">
            {feitos} de {lista.length} feitos
          </Texto>
        </View>
        <Pressable onPress={pular} hitSlop={10} accessibilityRole="button">
          <Texto variante="forte" cor={tema.textoSuave}>
            Pular
          </Texto>
        </Pressable>
      </Linha>
      <View style={[estilos.barra, { backgroundColor: tema.superficie2 }]}>
        <View
          style={{
            width: `${(feitos / lista.length) * 100}%`,
            height: '100%',
            backgroundColor: tema.positivo,
            borderRadius: 3,
          }}
        />
      </View>
      {lista.map((x, i) => (
        <Pressable
          key={x.titulo}
          disabled={x.feito}
          onPress={x.acao}
          accessibilityRole="button"
          accessibilityState={{ checked: x.feito, disabled: x.feito }}
          style={({ pressed }) => [estilos.passo, { opacity: pressed ? 0.7 : 1 }]}>
          <View
            style={[
              estilos.marca,
              x.feito
                ? { backgroundColor: tema.positivo, borderColor: tema.positivo }
                : { borderColor: tema.borda, backgroundColor: tema.superficie },
            ]}>
            {x.feito ? (
              <Icone nome="checkmark" cor="#FFFFFF" tamanho={14} />
            ) : (
              <Texto variante="suave" style={{ fontWeight: '700', fontSize: 12, lineHeight: 14 }}>
                {i + 1}
              </Texto>
            )}
          </View>
          <Texto
            variante={x.feito ? 'suave' : 'forte'}
            style={[{ flex: 1 }, x.feito && { textDecorationLine: 'line-through' }]}>
            {x.titulo}
          </Texto>
          {!x.feito ? <Icone nome="chevron-forward" cor={tema.textoSuave} tamanho={18} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderRadius: raio.g, borderWidth: 1, padding: espaco.g, gap: espaco.m },
  barra: { height: 6, borderRadius: 3, overflow: 'hidden' },
  passo: { flexDirection: 'row', alignItems: 'center', gap: espaco.m + 4, paddingVertical: 6 },
  marca: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
