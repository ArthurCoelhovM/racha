import { useState } from 'react';
import { View } from 'react-native';

import { Aviso, Avatar, Botao, Cartao, Ficha, Fichas, Linha, Separador, Texto } from '@/components/ui';
import { espaco } from '@/constants/tema';
import { definirPapel, definirPermissoes, mensagemDeErro, passarDono, removerMembro } from '@/lib/api';
import { ACOES, NIVEIS, NOME_DO_PAPEL, pode } from '@/lib/permissoes';
import type { Acao, Grupo, Membro, Papel } from '@/lib/tipos';

type Props = {
  grupo: Grupo;
  membros: Membro[];
  eu: string;
  papel: Papel | null;
  aoMudar: () => Promise<unknown>;
};

export function MembrosEPapeis({ grupo, membros, eu, papel, aoMudar }: Props) {
  const [mensagem, setMensagem] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const souDono = papel === 'dono';
  const podeRemover = pode(grupo, papel, 'remover_membros');
  const ativos = membros.filter((m) => m.ativo);

  async function fazer(chave: string, acao: () => Promise<void>, ok: string) {
    setOcupado(chave);
    setMensagem(null);
    try {
      await acao();
      await aoMudar();
      setMensagem({ texto: ok, tipo: 'ok' });
    } catch (e) {
      setMensagem({ texto: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <View style={{ gap: espaco.m }}>
      <Texto variante="rotulo">Pessoas do grupo</Texto>
      {mensagem ? <Aviso texto={mensagem.texto} tipo={mensagem.tipo} /> : null}
      <Cartao style={{ padding: 0, gap: 0 }}>
        {ativos.map((m, i) => {
          const nome = m.usuario_id === eu ? 'Você' : m.perfil.nome || 'Alguém';
          const ehEu = m.usuario_id === eu;
          const removivel =
            !ehEu && m.papel !== 'dono' && podeRemover && (m.papel === 'membro' || souDono);
          return (
            <View key={m.usuario_id}>
              {i > 0 ? <Separador /> : null}
              <View style={{ padding: espaco.g, gap: espaco.m }}>
                <Linha>
                  <Avatar id={m.usuario_id} nome={nome} />
                  <Texto variante="forte" style={{ flex: 1 }} numberOfLines={1}>
                    {nome}
                  </Texto>
                  <Texto variante="suave">{NOME_DO_PAPEL[m.papel]}</Texto>
                </Linha>
                {(souDono && !ehEu) || removivel ? (
                  <Linha style={{ flexWrap: 'wrap', gap: espaco.m }}>
                    {souDono && !ehEu ? (
                      <Botao
                        pequeno
                        variante="secundario"
                        titulo={m.papel === 'admin' ? 'Tirar de admin' : 'Tornar admin'}
                        carregando={ocupado === `papel-${m.usuario_id}`}
                        aoPressionar={() =>
                          fazer(
                            `papel-${m.usuario_id}`,
                            () => definirPapel(grupo.id, m.usuario_id, m.papel === 'admin' ? 'membro' : 'admin'),
                            m.papel === 'admin' ? `${nome} voltou a ser membro.` : `${nome} agora é admin.`,
                          )
                        }
                      />
                    ) : null}
                    {souDono && !ehEu ? (
                      <Botao
                        pequeno
                        variante="secundario"
                        titulo="Passar o papel de dono"
                        confirmar={`Toque de novo: ${nome} vira dono e você vira admin`}
                        carregando={ocupado === `dono-${m.usuario_id}`}
                        aoPressionar={() =>
                          fazer(`dono-${m.usuario_id}`, () => passarDono(grupo.id, m.usuario_id), `${nome} agora é o dono.`)
                        }
                      />
                    ) : null}
                    {removivel ? (
                      <Botao
                        pequeno
                        variante="perigo"
                        titulo="Remover"
                        confirmar={`Toque de novo para remover ${nome}`}
                        carregando={ocupado === `remover-${m.usuario_id}`}
                        aoPressionar={() =>
                          fazer(
                            `remover-${m.usuario_id}`,
                            () => removerMembro(grupo.id, m.usuario_id),
                            `${nome} saiu do grupo. O que estava em aberto continua nas dívidas.`,
                          )
                        }
                      />
                    ) : null}
                  </Linha>
                ) : null}
              </View>
            </View>
          );
        })}
      </Cartao>
      {souDono ? <Permissoes grupo={grupo} aoMudar={aoMudar} /> : <ResumoPermissoes grupo={grupo} />}
    </View>
  );
}

function Permissoes({ grupo, aoMudar }: { grupo: Grupo; aoMudar: () => Promise<unknown> }) {
  const [erro, setErro] = useState<string | null>(null);
  const [valores, setValores] = useState(grupo.permissoes);

  async function mudar(acao: Acao, papel: Papel) {
    const anterior = valores;
    setValores({ ...valores, [acao]: papel });
    setErro(null);
    try {
      await definirPermissoes(grupo.id, { [acao]: papel });
      await aoMudar();
    } catch (e) {
      setValores(anterior);
      setErro(mensagemDeErro(e));
    }
  }

  return (
    <View style={{ gap: espaco.m }}>
      <Texto variante="rotulo">Quem pode</Texto>
      {erro ? <Aviso texto={erro} /> : null}
      <Cartao>
        {ACOES.map((a, i) => (
          <View key={a.acao} style={{ gap: 6 }}>
            {i > 0 ? <Separador /> : null}
            <Texto variante="forte">{a.nome}</Texto>
            <Fichas>
              {NIVEIS.map((n) => (
                <Ficha
                  key={n.papel}
                  rotulo={n.nome}
                  selecionada={valores[a.acao] === n.papel}
                  aoPressionar={() => mudar(a.acao, n.papel)}
                  cor={grupo.cor}
                />
              ))}
            </Fichas>
          </View>
        ))}
      </Cartao>
      <Texto variante="suave">
        Cada pessoa sempre pode editar e excluir os gastos que ela mesma registrou. Só o dono muda as permissões e
        escolhe os admins.
      </Texto>
    </View>
  );
}

function ResumoPermissoes({ grupo }: { grupo: Grupo }) {
  return (
    <View style={{ gap: espaco.m }}>
      <Texto variante="rotulo">Quem pode</Texto>
      <Cartao>
        {ACOES.map((a) => (
          <Linha key={a.acao} style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Texto style={{ flex: 1 }}>{a.nome}</Texto>
            <Texto variante="suave">{NIVEIS.find((n) => n.papel === grupo.permissoes[a.acao])?.nome}</Texto>
          </Linha>
        ))}
      </Cartao>
    </View>
  );
}
