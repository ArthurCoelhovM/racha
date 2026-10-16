import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { mensagemDeErro } from '@/lib/api';

// carrega os dados toda vez que a tela ganha foco, e permite puxar para atualizar
export function useCarregar<T>(buscar: () => Promise<T>, chave = '') {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const buscarRef = useRef(buscar);

  useEffect(() => {
    buscarRef.current = buscar;
  });

  const carregar = useCallback(async (puxou = false, _chave?: string) => {
    if (puxou) setAtualizando(true);
    try {
      const resultado = await buscarRef.current();
      setDados(resultado);
      setErro(null);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar(false, chave);
    }, [carregar, chave]),
  );

  return { dados, erro, carregando, atualizando, recarregar: () => carregar(true), setDados };
}
