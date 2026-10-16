import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Marca } from '@/components/marca';
import { Aviso, Botao, Carregando, Tela, Texto } from '@/components/ui';
import { entrarNoGrupo, mensagemDeErro } from '@/lib/api';
import { guardarCodigoPendente, useSessao } from '@/lib/sessao';

export default function AbrirConvite() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const { sessao } = useSessao();
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!sessao || !codigo) return;
    entrarNoGrupo(codigo)
      .then((id) => router.replace({ pathname: '/grupo/[id]', params: { id } }))
      .catch((e) => setErro(mensagemDeErro(e)));
  }, [sessao, codigo]);

  if (sessao && !erro) return <Carregando />;

  if (erro) {
    return (
      <Tela>
        <Aviso texto={erro} />
        <Botao titulo="Ir para os grupos" aoPressionar={() => router.replace('/')} />
      </Tela>
    );
  }

  function seguir(destino: '/entrar' | '/cadastro') {
    guardarCodigoPendente(codigo ?? null);
    router.replace(destino);
  }

  return (
    <Tela>
      <Marca tamanho={28} />
      <Texto variante="subtitulo">Te chamaram para um grupo</Texto>
      <Texto>Entre ou crie sua conta. Depois disso você já cai direto no grupo.</Texto>
      <Botao titulo="Já tenho conta" aoPressionar={() => seguir('/entrar')} />
      <Botao titulo="Criar conta" variante="secundario" aoPressionar={() => seguir('/cadastro')} />
    </Tela>
  );
}
