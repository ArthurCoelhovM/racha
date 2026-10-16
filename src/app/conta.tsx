import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Aviso, Botao, Campo, Cartao, Tela, Texto } from '@/components/ui';
import { atualizarMeuNome, buscarMeuPerfil, mensagemDeErro } from '@/lib/api';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';

export default function Conta() {
  const { usuarioId, sessao } = useSessao();
  const [nome, setNome] = useState('');
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'erro' | 'ok' } | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!usuarioId) return;
    buscarMeuPerfil(usuarioId)
      .then((p) => setNome(p.nome))
      .catch((e) => setAviso({ texto: mensagemDeErro(e), tipo: 'erro' }));
  }, [usuarioId]);

  async function salvar() {
    if (!usuarioId || !nome.trim()) return;
    setSalvando(true);
    try {
      await atualizarMeuNome(usuarioId, nome.trim());
      setAviso({ texto: 'Nome salvo.', tipo: 'ok' });
    } catch (e) {
      setAviso({ texto: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Tela>
      <Cartao>
        <Texto variante="rotulo">E-mail</Texto>
        <Texto variante="forte">{sessao?.user.email}</Texto>
      </Cartao>
      <Campo rotulo="Seu nome no grupo" value={nome} onChangeText={setNome} onSubmitEditing={salvar} />
      {aviso ? <Aviso texto={aviso.texto} tipo={aviso.tipo} /> : null}
      <Botao titulo="Salvar nome" aoPressionar={salvar} carregando={salvando} />
      <Botao titulo="Trocar senha" variante="secundario" aoPressionar={() => router.push('/nova-senha')} />
      <Botao titulo="Sair da conta" variante="perigo" confirmar="Toque de novo para sair" aoPressionar={() => supabase.auth.signOut()} />
    </Tela>
  );
}
