import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { ChavePix } from '@/components/pix/chave-pix';
import { Aviso, Botao, Campo, Cartao, Interruptor, Separador, Tela, Texto } from '@/components/ui';
import { atualizarMeuNome, buscarMeuPerfil, excluirMinhaConta, mensagemDeErro, meusDados } from '@/lib/api';
import { exportarCsv } from '@/lib/csv';
import { ativarPush, desativarPush, situacaoPush, type SituacaoPush } from '@/lib/push';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { mudarCompacto, useCompacto } from '@/lib/preferencias';
import { reverTutorial } from '@/lib/tutorial';

export default function Conta() {
  const { usuarioId, sessao } = useSessao();
  const [nome, setNome] = useState('');
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'erro' | 'ok' } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [push, setPush] = useState<SituacaoPush | null>(null);
  const [mudandoPush, setMudandoPush] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [exportando, setExportando] = useState(false);
  const compacto = useCompacto();

  // tudo o que o app guarda sobre você, num arquivo JSON (LGPD)
  async function exportar() {
    setExportando(true);
    setAviso(null);
    try {
      const dados = await meusDados();
      await exportarCsv('meus-dados-racha.json', JSON.stringify(dados, null, 2), 'application/json');
      setAviso({ texto: 'Seus dados foram exportados.', tipo: 'ok' });
    } catch (e) {
      setAviso({ texto: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      setExportando(false);
    }
  }

  useEffect(() => {
    if (!usuarioId) return;
    buscarMeuPerfil(usuarioId)
      .then((p) => setNome(p.nome))
      .catch((e) => setAviso({ texto: mensagemDeErro(e), tipo: 'erro' }));
  }, [usuarioId]);

  useFocusEffect(
    useCallback(() => {
      situacaoPush()
        .then(setPush)
        .catch(() => setPush({ disponivel: false, ativo: false, motivo: 'Não deu para checar as notificações.' }));
    }, []),
  );

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

  async function mudarPush(ligar: boolean) {
    setMudandoPush(true);
    setAviso(null);
    try {
      if (ligar) await ativarPush();
      else await desativarPush();
      setPush(await situacaoPush());
      setAviso({
        texto: ligar ? 'Notificações ligadas neste aparelho.' : 'Notificações desligadas neste aparelho.',
        tipo: 'ok',
      });
    } catch (e) {
      setAviso({ texto: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      setMudandoPush(false);
    }
  }

  async function sair() {
    await desativarPush().catch(() => {});
    await supabase.auth.signOut();
  }

  async function excluir() {
    setExcluindo(true);
    try {
      await desativarPush().catch(() => {});
      await excluirMinhaConta();
    } catch (e) {
      setAviso({ texto: mensagemDeErro(e), tipo: 'erro' });
      setExcluindo(false);
    }
  }

  return (
    <Tela>
      <Cartao>
        <Texto variante="rotulo">E-mail</Texto>
        <Texto variante="forte">{sessao?.user.email}</Texto>
      </Cartao>
      <Campo rotulo="Seu nome no grupo" value={nome} onChangeText={setNome} onSubmitEditing={salvar} />
      <Botao titulo="Salvar nome" aoPressionar={salvar} carregando={salvando} />

      {usuarioId ? <ChavePix usuarioId={usuarioId} /> : null}

      <Cartao>
        {push?.disponivel ? (
          <Interruptor
            titulo="Notificações neste aparelho"
            descricao="Gastos novos, pagamentos e lembretes de dívida."
            valor={push.ativo}
            aoMudar={(v) => {
              if (!mudandoPush) mudarPush(v);
            }}
          />
        ) : (
          <>
            <Texto variante="forte">Notificações neste aparelho</Texto>
            <Texto variante="suave">{push?.motivo ?? 'Verificando…'}</Texto>
          </>
        )}
      </Cartao>

      <Cartao>
        <Interruptor
          titulo="Modo compacto"
          descricao="Linhas mais baixas na lista de gastos, sem a linha de sua parte. Bom para quem tem muitos gastos."
          valor={compacto}
          aoMudar={mudarCompacto}
        />
      </Cartao>

      {aviso ? <Aviso texto={aviso.texto} tipo={aviso.tipo} /> : null}

      <Botao
        titulo="Ver as dicas de novo"
        variante="secundario"
        aoPressionar={() => {
          reverTutorial();
          setAviso({ texto: 'As dicas e os primeiros passos voltam a aparecer.', tipo: 'ok' });
        }}
      />
      <Botao titulo="Trocar senha" variante="secundario" aoPressionar={() => router.push('/nova-senha')} />
      <Botao titulo="Política de privacidade" variante="secundario" aoPressionar={() => router.push('/privacidade')} />
      <Botao
        titulo="Exportar todos os meus dados"
        variante="secundario"
        carregando={exportando}
        aoPressionar={exportar}
      />
      <Botao titulo="Sair da conta" variante="perigo" confirmar="Toque de novo para sair" aoPressionar={sair} />

      <Separador />
      <Texto variante="suave">
        Excluir a conta apaga seu nome, e-mail, aparelhos e avisos. Os gastos que você dividiu continuam no histórico
        dos grupos como &quot;Conta excluída&quot;.
      </Texto>
      <Botao
        titulo="Excluir minha conta"
        variante="perigo"
        confirmar="Toque de novo: não dá para desfazer"
        aoPressionar={excluir}
        carregando={excluindo}
      />
    </Tela>
  );
}
