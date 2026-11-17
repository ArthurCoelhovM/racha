import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { useDesfazer } from '@/components/desfazer';
import { Aviso, Botao, Campo, Cartao, Interruptor, Texto } from '@/components/ui';
import { espaco } from '@/constants/tema';
import { arquivarGrupo, definirApelido, mensagemDeErro } from '@/lib/api';
import { chaves, useInicio } from '@/lib/consultas';

// apelido neste grupo e arquivar: só mexem no que você vê ou no seu nome aqui
export function SoParaVoce({
  grupoId,
  apelido,
  aoMudar,
}: {
  grupoId: string;
  apelido: string | null;
  aoMudar: () => Promise<unknown>;
}) {
  const inicio = useInicio();
  const cliente = useQueryClient();
  const arquivado = inicio.data?.grupos.find((g) => g.grupo_id === grupoId)?.arquivado ?? false;
  const [texto, setTexto] = useState(apelido ?? '');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);
  const desfazer = useDesfazer();

  async function salvarApelido() {
    setSalvando(true);
    setMensagem(null);
    try {
      await definirApelido(grupoId, texto);
      await aoMudar();
      setMensagem({ texto: texto.trim() ? 'Apelido salvo.' : 'Apelido removido: vale o seu nome.', tipo: 'ok' });
    } catch (e) {
      setMensagem({ texto: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      setSalvando(false);
    }
  }

  async function arquivar(valor: boolean) {
    setMensagem(null);
    try {
      await arquivarGrupo(grupoId, valor);
      await cliente.invalidateQueries({ queryKey: chaves.inicio });
      desfazer({
        texto: valor ? 'Grupo arquivado: ele fica em "Arquivados" na tela inicial.' : 'Grupo de volta na lista.',
        desfazer: async () => {
          await arquivarGrupo(grupoId, !valor);
          await cliente.invalidateQueries({ queryKey: chaves.inicio });
          await aoMudar();
        },
      });
      await aoMudar();
    } catch (e) {
      setMensagem({ texto: mensagemDeErro(e), tipo: 'erro' });
    }
  }

  return (
    <View style={{ gap: espaco.m }}>
      <Texto variante="rotulo">Só para você</Texto>
      {mensagem ? <Aviso texto={mensagem.texto} tipo={mensagem.tipo} /> : null}
      <Cartao>
        <Campo
          rotulo="Seu apelido neste grupo"
          value={texto}
          onChangeText={setTexto}
          placeholder="Como o grupo te chama"
          maxLength={40}
          dica="Aparece no lugar do seu nome só neste grupo. Deixe vazio para usar o nome."
        />
        <Botao
          titulo="Salvar apelido"
          variante="secundario"
          pequeno
          carregando={salvando}
          aoPressionar={salvarApelido}
        />
      </Cartao>
      <Cartao>
        <Interruptor
          titulo="Arquivar grupo"
          descricao="Tira o grupo da sua lista sem perder nada. Os outros continuam vendo normalmente."
          valor={arquivado}
          aoMudar={arquivar}
        />
      </Cartao>
    </View>
  );
}
