import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { Aviso, Botao, Cartao, Linha, Separador, Texto } from '@/components/ui';
import { espaco } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { marcarPago, mensagemDeErro } from '@/lib/api';
import { chaves, useAtualizarAoFocar, usePendenciasFora } from '@/lib/consultas';
import { dec, reais } from '@/lib/dinheiro';
import { diaCurto } from '@/lib/formatos';
import type { PendenciaFora } from '@/lib/tipos';

// O que ficou em aberto nos grupos que a pessoa deixou: ela continua vendo e pode marcar como pago.
export function GruposQueDeixei({ eu }: { eu: string }) {
  const tema = useTema();
  const consulta = usePendenciasFora();
  const cliente = useQueryClient();
  const [marcando, setMarcando] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);
  useAtualizarAoFocar(consulta.refetch);
  const lista = consulta.data ?? [];
  if (lista.length === 0) return null;

  const grupos = new Map<string, PendenciaFora[]>();
  for (const p of lista) grupos.set(p.grupo_id, [...(grupos.get(p.grupo_id) ?? []), p]);

  async function pagar(p: PendenciaFora, chave: string) {
    setMarcando(chave);
    setMensagem(null);
    try {
      await marcarPago(p.grupo_id, p.devedor, p.credor, dec(p.valor), p.gasto_id);
      setMensagem({ texto: `Pagamento de ${reais(p.valor)} marcado.`, tipo: 'ok' });
      await Promise.all([
        cliente.invalidateQueries({ queryKey: chaves.fora }),
        cliente.invalidateQueries({ queryKey: chaves.inicio }),
      ]);
    } catch (e) {
      setMensagem({ texto: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      setMarcando(null);
    }
  }

  return (
    <View style={{ gap: espaco.m }}>
      <Texto variante="rotulo">Grupos que você deixou</Texto>
      {mensagem ? <Aviso texto={mensagem.texto} tipo={mensagem.tipo} /> : null}
      {[...grupos.values()].map((itens) => (
        <Cartao key={itens[0].grupo_id} style={{ padding: 0, gap: 0 }}>
          <Linha style={{ padding: espaco.g, paddingBottom: espaco.m }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: itens[0].grupo_cor }} />
            <Texto variante="forte">{itens[0].grupo_nome}</Texto>
          </Linha>
          {itens.map((p, i) => {
            const chave = `${p.grupo_id}|${p.gasto_id ?? ''}|${p.devedor}|${p.credor}`;
            const devo = p.devedor === eu;
            return (
              <View key={chave}>
                {i > 0 ? <Separador /> : null}
                <View style={{ padding: espaco.g, gap: espaco.m }}>
                  <Linha>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Texto variante="forte">{devo ? `Você deve a ${p.outra_pessoa}` : `${p.outra_pessoa} te deve`}</Texto>
                      {p.descricao ? (
                        <Texto variante="suave" numberOfLines={1}>
                          {p.descricao}
                          {p.data ? ` · ${diaCurto(p.data)}` : ''}
                        </Texto>
                      ) : null}
                    </View>
                    <Texto variante="subtitulo" cor={devo ? tema.negativo : tema.positivo}>
                      {reais(p.valor)}
                    </Texto>
                  </Linha>
                  <Botao
                    pequeno
                    variante="secundario"
                    titulo={devo ? 'Marcar que paguei' : 'Marcar que recebi'}
                    carregando={marcando === chave}
                    aoPressionar={() => pagar(p, chave)}
                    style={{ alignSelf: 'flex-end' }}
                  />
                </View>
              </View>
            );
          })}
        </Cartao>
      ))}
    </View>
  );
}
