import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Aviso as Faixa, Carregando, Cartao, Separador, Tela, Texto, Vazio } from '@/components/ui';
import { espaco } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import { useTema } from '@/hooks/use-tema';
import { listarAvisos, marcarAvisosLidos } from '@/lib/api';
import { momento } from '@/lib/formatos';
import type { Aviso } from '@/lib/tipos';

export default function Avisos() {
  const tema = useTema();
  const { dados, erro, carregando, atualizando, recarregar } = useCarregar(listarAvisos);

  // depois de mostrar, marca tudo como lido (o destaque continua até sair da tela)
  useEffect(() => {
    if (dados?.some((a) => !a.lido)) marcarAvisosLidos().catch(() => {});
  }, [dados]);

  const corDoTipo: Record<Aviso['tipo'], string> = {
    gasto_novo: tema.primaria,
    gasto_editado: tema.aviso,
    gasto_excluido: tema.negativo,
    pagamento: tema.positivo,
    grupo: tema.aviso,
    membro: tema.textoSuave,
    lembrete: tema.aviso,
    recorrente_parado: tema.negativo,
  };

  if (carregando) return <Carregando />;

  return (
    <Tela aoAtualizar={recarregar} atualizando={atualizando}>
      {erro ? <Faixa texto={erro} acao="Tentar de novo" aoAcionar={recarregar} /> : null}
      {dados && dados.length === 0 ? (
        <Vazio titulo="Nenhum aviso" texto="Gastos novos, pagamentos e lembretes de dívida aparecem aqui." />
      ) : null}
      {dados && dados.length > 0 ? (
        <Cartao style={{ padding: 0, gap: 0 }}>
          {dados.map((a, i) => (
            <View key={a.id}>
              {i > 0 ? <Separador /> : null}
              <Pressable
                disabled={!a.grupo_id}
                onPress={() => a.grupo_id && router.push({ pathname: '/grupo/[id]', params: { id: a.grupo_id } })}
                style={({ pressed }) => [
                  estilos.linha,
                  !a.lido && { backgroundColor: tema.superficie2 },
                  { opacity: pressed ? 0.7 : 1 },
                ]}>
                <View style={[estilos.marca, { backgroundColor: corDoTipo[a.tipo] }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Texto variante="forte">{a.titulo}</Texto>
                  <Texto>{a.corpo}</Texto>
                  <Texto variante="suave">{momento(a.criado_em)}</Texto>
                </View>
              </Pressable>
            </View>
          ))}
        </Cartao>
      ) : null}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', gap: espaco.m + 4, padding: espaco.g },
  marca: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
});
