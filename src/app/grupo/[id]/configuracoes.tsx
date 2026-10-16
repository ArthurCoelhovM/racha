import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { FormularioGrupo } from '@/components/formulario-grupo';
import { Aviso, Botao, Carregando, Linha, Separador, Tela, Texto } from '@/components/ui';
import { espaco } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import { useTema } from '@/hooks/use-tema';
import { atualizarGrupo, buscarGrupo, listarPendencias, mensagemDeErro, sairDoGrupo } from '@/lib/api';
import { reais } from '@/lib/dinheiro';
import { resumoDoUsuario, type Pendencia } from '@/lib/saldos';
import { useSessao } from '@/lib/sessao';

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
          previaAbatimento={(novo) => <PreviaAbatimento grupoId={id} novo={novo} />}
          aoSalvar={async (g) => {
            await atualizarGrupo(id, g);
            router.back();
          }}
        />
      ) : null}

      <Separador />
      <Texto variante="suave">
        Ao sair, o grupo some da sua lista. Dívidas em aberto continuam registradas para os outros membros. Se você for
        o dono, o membro mais antigo passa a ser o dono.
      </Texto>
      {erroSair ? <Aviso texto={erroSair} /> : null}
      <Botao
        titulo="Sair do grupo"
        variante="perigo"
        confirmar="Toque de novo para sair do grupo"
        aoPressionar={sair}
      />
    </Tela>
  );
}

// saldos de hoje e como ficam com o abatimento trocado, calculados pelo banco sem mudar nada
function PreviaAbatimento({ grupoId, novo }: { grupoId: string; novo: boolean }) {
  const tema = useTema();
  const { usuarioId } = useSessao();
  const [contas, setContas] = useState<{ hoje: Pendencia[]; depois: Pendencia[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let valendo = true;
    Promise.all([listarPendencias(grupoId), listarPendencias(grupoId, novo)])
      .then(([hoje, depois]) => {
        if (valendo) setContas({ hoje, depois });
      })
      .catch((e) => {
        if (valendo) setErro(mensagemDeErro(e));
      });
    return () => {
      valendo = false;
    };
  }, [grupoId, novo]);

  if (erro) return <Aviso texto={erro} />;
  if (!contas) return <Texto variante="suave">Calculando como ficam as contas…</Texto>;

  const coluna = (titulo: string, lista: Pendencia[]) => {
    const { voceDeve, teDevem } = resumoDoUsuario(lista, usuarioId ?? '');
    return (
      <View style={{ flex: 1, gap: 2 }}>
        <Texto variante="rotulo">{titulo}</Texto>
        <Texto cor={voceDeve.isZero() ? undefined : tema.negativo}>Você deve {reais(voceDeve)}</Texto>
        <Texto cor={teDevem.isZero() ? undefined : tema.positivo}>Te devem {reais(teDevem)}</Texto>
        <Texto variante="suave">
          {lista.length} {lista.length === 1 ? 'dívida' : 'dívidas'} no grupo
        </Texto>
      </View>
    );
  };

  return (
    <View style={{ gap: espaco.m }}>
      <Linha style={{ alignItems: 'flex-start' }}>
        {coluna('Hoje', contas.hoje)}
        {coluna(novo ? 'Com abatimento' : 'Sem abatimento', contas.depois)}
      </Linha>
      <Texto variante="suave">
        A mudança vale para todos os gastos do grupo, inclusive os antigos. Todo mundo do grupo recebe um aviso.
      </Texto>
    </View>
  );
}
