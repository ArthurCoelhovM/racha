import {
  focusManager,
  QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import {
  buscarGasto,
  buscarGrupo,
  contarAvisosNaoLidos,
  contarGastos,
  desfazerPagamento,
  lancarMeusRecorrentes,
  listarAvisos,
  listarHistorico,
  listarMembros,
  listarMeusGrupos,
  listarPendencias,
  listarRecorrentes,
  marcarPago,
  mensagemDeErro,
  paginaDeGastos,
} from './api';
import type { Pendencia } from './saldos';

export const POR_PAGINA = 30;

export const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      gcTime: 10 * 60_000,
      retry: (falhas, erro) => falhas < 2 && !/permissão|não participa|não encontrei/i.test(String(erro)),
    },
  },
});

// no celular, "voltar para o app" conta como foco da janela
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (estado) => focusManager.setFocused(estado === 'active'));
}

export const chaves = {
  inicio: ['inicio'] as const,
  avisos: ['avisos'] as const,
  grupo: (id: string) => ['grupo', id] as const,
  membros: (id: string) => ['grupo', id, 'membros'] as const,
  pendencias: (id: string) => ['grupo', id, 'pendencias'] as const,
  gastos: (id: string) => ['grupo', id, 'gastos'] as const,
  totalGastos: (id: string) => ['grupo', id, 'total-gastos'] as const,
  historico: (id: string) => ['grupo', id, 'historico'] as const,
  recorrentes: (id: string) => ['grupo', id, 'recorrentes'] as const,
  gasto: (id: string) => ['gasto', id] as const,
};

// ao voltar para uma tela, atualiza o que estiver velho (não na primeira abertura)
export function useAtualizarAoFocar(atualizar: () => unknown) {
  const primeira = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (primeira.current) {
        primeira.current = false;
        return;
      }
      atualizar();
    }, [atualizar]),
  );
}

export function useInicio() {
  return useQuery({
    queryKey: chaves.inicio,
    queryFn: async () => {
      await lancarMeusRecorrentes();
      const [grupos, naoLidos] = await Promise.all([listarMeusGrupos(), contarAvisosNaoLidos().catch(() => 0)]);
      return { grupos, naoLidos };
    },
  });
}

export function useAvisos() {
  return useQuery({ queryKey: chaves.avisos, queryFn: listarAvisos });
}

export function useGrupo(id: string) {
  return useQuery({
    queryKey: chaves.grupo(id),
    queryFn: async () => {
      // recorrentes vencidos entram antes de mostrar o grupo
      await lancarMeusRecorrentes();
      return buscarGrupo(id);
    },
  });
}

export function useMembros(id: string) {
  return useQuery({ queryKey: chaves.membros(id), queryFn: () => listarMembros(id) });
}

export function usePendencias(id: string) {
  return useQuery({ queryKey: chaves.pendencias(id), queryFn: () => listarPendencias(id) });
}

export function useGastos(id: string) {
  return useInfiniteQuery({
    queryKey: chaves.gastos(id),
    queryFn: ({ pageParam }) => paginaDeGastos(id, pageParam, POR_PAGINA),
    initialPageParam: 0,
    getNextPageParam: (ultima, todas) => (ultima.length < POR_PAGINA ? undefined : todas.length * POR_PAGINA),
  });
}

export function useTotalGastos(id: string) {
  return useQuery({ queryKey: chaves.totalGastos(id), queryFn: () => contarGastos(id) });
}

export function useHistorico(id: string) {
  return useQuery({ queryKey: chaves.historico(id), queryFn: () => listarHistorico(id) });
}

export function useRecorrentes(id: string) {
  return useQuery({ queryKey: chaves.recorrentes(id), queryFn: () => listarRecorrentes(id) });
}

export function useGasto(id: string | undefined) {
  return useQuery({
    queryKey: chaves.gasto(id ?? ''),
    queryFn: () => buscarGasto(id!),
    enabled: !!id,
  });
}

// depois de qualquer mudança num grupo, tudo dele (e a tela inicial) fica velho
export function useInvalidarGrupo() {
  const cliente = useQueryClient();
  return useCallback(
    (grupoId: string) =>
      Promise.all([
        cliente.invalidateQueries({ queryKey: ['grupo', grupoId] }),
        cliente.invalidateQueries({ queryKey: chaves.inicio }),
      ]),
    [cliente],
  );
}

// "marcar como pago" some da lista na hora; se o banco recusar, a lista volta
export function useMarcarPago(grupoId: string) {
  const cliente = useQueryClient();
  const invalidar = useInvalidarGrupo();
  return useMutation({
    mutationFn: (p: Pendencia) => marcarPago(grupoId, p.devedor, p.credor, p.valor, p.gasto_id),
    onMutate: async (p) => {
      await cliente.cancelQueries({ queryKey: chaves.pendencias(grupoId) });
      const antes = cliente.getQueryData<Pendencia[]>(chaves.pendencias(grupoId));
      cliente.setQueryData<Pendencia[]>(chaves.pendencias(grupoId), (lista) =>
        (lista ?? []).filter((x) => x.chave !== p.chave),
      );
      return { antes };
    },
    onError: (_erro, _p, contexto) => {
      if (contexto?.antes) cliente.setQueryData(chaves.pendencias(grupoId), contexto.antes);
    },
    onSettled: () => invalidar(grupoId),
  });
}

export function useDesfazerPagamento(grupoId: string) {
  const invalidar = useInvalidarGrupo();
  return useMutation({
    mutationFn: (pagamentoId: string) => desfazerPagamento(pagamentoId),
    onSettled: () => invalidar(grupoId),
  });
}

// puxar para atualizar: mostra o indicador até as consultas voltarem
export function usePuxar(atualizar: () => Promise<unknown>) {
  const [puxando, setPuxando] = useState(false);
  const puxar = useCallback(async () => {
    setPuxando(true);
    try {
      await atualizar();
    } finally {
      setPuxando(false);
    }
  }, [atualizar]);
  return { puxando, puxar };
}

export function textoDoErro(erro: unknown): string | null {
  return erro ? mensagemDeErro(erro) : null;
}
