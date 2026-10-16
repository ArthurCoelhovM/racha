import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { FormularioGrupo } from '@/components/formulario-grupo';
import { Aviso, Botao, Carregando, Separador, Tela, Texto } from '@/components/ui';
import { useCarregar } from '@/hooks/use-carregar';
import { atualizarGrupo, buscarGrupo, mensagemDeErro, sairDoGrupo } from '@/lib/api';

export default function Configuracoes() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dados: grupo, erro, carregando } = useCarregar(() => buscarGrupo(id), id);
  const [erroSair, setErroSair] = useState<string | null>(null);

  async function sair() {
    try {
      await sairDoGrupo(id);
      router.dismissTo('/');
    } catch (e) {
      setErroSair(mensagemDeErro(e));
    }
  }

  if (carregando) return <Carregando />;

  return (
    <Tela>
      {erro ? <Aviso texto={erro} /> : null}
      {grupo ? (
        <FormularioGrupo
          tituloBotao="Salvar configurações"
          inicial={{
            nome: grupo.nome,
            cor: grupo.cor,
            abatimento: grupo.abatimento,
            divisoes: grupo.divisoes_permitidas,
            lembreteDias: grupo.lembrete_dias,
          }}
          aoSalvar={async (g) => {
            await atualizarGrupo(id, g);
            router.back();
          }}
        />
      ) : null}

      <Separador />
      <Texto variante="suave">
        Ao sair, o grupo some da sua lista. Dívidas em aberto continuam registradas para os outros membros.
      </Texto>
      {erroSair ? <Aviso texto={erroSair} /> : null}
      <Botao titulo="Sair do grupo" variante="perigo" confirmar="Toque de novo para sair do grupo" aoPressionar={sair} />
    </Tela>
  );
}
