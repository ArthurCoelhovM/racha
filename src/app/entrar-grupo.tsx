import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Aviso, Botao, Campo, Tela, Texto } from '@/components/ui';
import { entrarNoGrupo, mensagemDeErro } from '@/lib/api';

export default function EntrarGrupo() {
  const { codigo: codigoInicial } = useLocalSearchParams<{ codigo?: string }>();
  const [codigo, setCodigo] = useState((codigoInicial ?? '').toUpperCase());
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar() {
    const limpo = codigo.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (limpo.length !== 6) return setErro('O código tem 6 letras e números.');
    setEntrando(true);
    setErro(null);
    try {
      const id = await entrarNoGrupo(limpo);
      router.replace({ pathname: '/grupo/[id]', params: { id } });
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEntrando(false);
    }
  }

  return (
    <Tela>
      <Texto>Peça o código para alguém do grupo. Ele fica em Convidar pessoas, dentro do grupo.</Texto>
      <Campo
        rotulo="Código"
        value={codigo}
        onChangeText={(t) => setCodigo(t.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={8}
        placeholder="EX: K7P2QA"
        style={{ fontSize: 24, letterSpacing: 4, fontWeight: '800' }}
        onSubmitEditing={entrar}
      />
      {erro ? <Aviso texto={erro} /> : null}
      <Botao titulo="Entrar no grupo" aoPressionar={entrar} carregando={entrando} />
    </Tela>
  );
}
