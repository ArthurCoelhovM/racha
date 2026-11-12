import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { Aviso, Avatar, Botao, Campo, Cartao, Linha, Separador, Texto } from '@/components/ui';
import { espaco } from '@/constants/tema';
import { apagarComentario, comentar, listarComentarios, mensagemDeErro } from '@/lib/api';
import { momento } from '@/lib/formatos';

import { Secao } from './partes';

// conversa sobre um gasto, para tirar dúvida sem sair do app
export function Comentarios({ gastoId, eu, nome }: { gastoId: string; eu: string; nome: (u: string) => string }) {
  const cliente = useQueryClient();
  const chave = ['gasto', gastoId, 'comentarios'];
  const consulta = useQuery({ queryKey: chave, queryFn: () => listarComentarios(gastoId) });
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      await comentar(gastoId, texto);
      setTexto('');
      await cliente.invalidateQueries({ queryKey: chave });
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  async function apagar(id: number) {
    try {
      await apagarComentario(id);
      await cliente.invalidateQueries({ queryKey: chave });
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  const lista = consulta.data ?? [];
  return (
    <Secao titulo={`Comentários${lista.length ? ` (${lista.length})` : ''}`}>
      {lista.length > 0 ? (
        <Cartao style={{ padding: 0, gap: 0 }}>
          {lista.map((c, i) => (
            <View key={c.id}>
              {i > 0 ? <Separador /> : null}
              <Linha style={{ padding: espaco.g, alignItems: 'flex-start' }}>
                <Avatar id={c.usuario_id ?? '?'} nome={c.usuario_id ? nome(c.usuario_id) : '?'} tamanho={28} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Texto variante="forte">{c.usuario_id ? nome(c.usuario_id) : 'Conta excluída'}</Texto>
                  <Texto>{c.texto}</Texto>
                  <Texto variante="suave">{momento(c.criado_em)}</Texto>
                </View>
                {c.usuario_id === eu ? (
                  <Botao
                    pequeno
                    variante="texto"
                    titulo="Apagar"
                    confirmar="Apagar?"
                    aoPressionar={() => apagar(c.id)}
                  />
                ) : null}
              </Linha>
            </View>
          ))}
        </Cartao>
      ) : null}
      {erro ? <Aviso texto={erro} /> : null}
      <Campo
        value={texto}
        onChangeText={setTexto}
        placeholder="Escreva uma dúvida ou observação"
        accessibilityLabel="Comentário"
        maxLength={500}
        multiline
      />
      <Botao
        titulo="Comentar"
        variante="secundario"
        carregando={enviando}
        desabilitado={!texto.trim()}
        aoPressionar={enviar}
      />
    </Secao>
  );
}
