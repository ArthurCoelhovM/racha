import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Aviso as Faixa, Carregando, Cartao, Separador, Tela, Texto, Vazio } from '@/components/ui';
import { espaco } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { useQueryClient } from '@tanstack/react-query';

import { marcarAvisosLidos } from '@/lib/api';
import { chaves, textoDoErro, useAtualizarAoFocar, useAvisos, usePuxar } from '@/lib/consultas';
import { momento } from '@/lib/formatos';
import type { Aviso } from '@/lib/tipos';

export default function Avisos() {
  const tema = useTema();
  const consulta = useAvisos();
  const cliente = useQueryClient();
  const dados = consulta.data;
  const erro = textoDoErro(consulta.error);
  const carregando = consulta.isPending && !erro;
  const recarregar = consulta.refetch;
  const { puxando: atualizando, puxar } = usePuxar(recarregar);
  useAtualizarAoFocar(recarregar);

  // depois de mostrar, marca tudo como lido (o destaque continua até sair da tela)
  useEffect(() => {
    if (dados?.some((a) => !a.lido)) {
      marcarAvisosLidos()
        .then(() => cliente.invalidateQueries({ queryKey: chaves.inicio }))
        .catch(() => {});
    }
  }, [dados, cliente]);

  const corDoTipo: Record<Aviso['tipo'], string> = {
    gasto_novo: tema.primaria,
    gasto_editado: tema.aviso,
    gasto_excluido: tema.negativo,
    pagamento: tema.positivo,
    grupo: tema.aviso,
    membro: tema.textoSuave,
    lembrete: tema.aviso,
    recorrente_parado: tema.negativo,
    cobranca: tema.negativo,
    falta_valor: tema.aviso,
    comentario: tema.primaria,
  };

  // comentário abre o gasto; o resto abre o grupo
  function abrir(a: Aviso) {
    if (!a.grupo_id) return;
    const gastoId = a.dados && typeof a.dados.gasto_id === 'string' ? a.dados.gasto_id : null;
    if (a.tipo === 'comentario' && gastoId) {
      router.push({ pathname: '/grupo/[id]/gasto', params: { id: a.grupo_id, gastoId } });
    } else {
      router.push({ pathname: '/grupo/[id]', params: { id: a.grupo_id } });
    }
  }

  if (carregando) return <Carregando />;

  return (
    <Tela aoAtualizar={puxar} atualizando={atualizando}>
      {erro ? <Faixa texto={erro} acao="Tentar de novo" aoAcionar={() => recarregar()} /> : null}
      {dados && dados.length === 0 ? (
        <Vazio
          desenho="sino"
          titulo="Nenhum aviso"
          texto="Gastos novos, pagamentos e lembretes de dívida aparecem aqui."
        />
      ) : null}
      {dados && dados.length > 0 ? (
        <Cartao style={{ padding: 0, gap: 0 }}>
          {dados.map((a, i) => (
            <View key={a.id}>
              {i > 0 ? <Separador /> : null}
              <Pressable
                disabled={!a.grupo_id}
                onPress={() => abrir(a)}
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
