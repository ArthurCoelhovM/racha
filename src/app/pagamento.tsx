import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Aviso, Botao, CampoDinheiro, Esqueleto, Ficha, Fichas, Tela, Texto } from '@/components/ui';
import { mensagemDeErro, marcarPago } from '@/lib/api';
import { textoDoErro, useInicio, useInvalidarGrupo, useMembros, usePendencias } from '@/lib/consultas';
import { Decimal, lerValor, paraCampo, reais } from '@/lib/dinheiro';
import { useSessao } from '@/lib/sessao';
import { vibrarSucesso } from '@/lib/toque';

type Sentido = 'paguei' | 'recebi';

// Pagamento avulso: escolher o grupo, a pessoa, o sentido e quanto. Serve também para pagar só uma parte.
export default function TelaPagamento() {
  const params = useLocalSearchParams<{ grupo?: string }>();
  const { usuarioId } = useSessao();
  const eu = usuarioId ?? '';
  const inicio = useInicio();
  const grupos = (inicio.data?.grupos ?? []).filter((g) => !g.arquivado);
  const [grupoId, setGrupoId] = useState<string | null>(params.grupo ?? null);
  const grupo = grupoId ?? grupos[0]?.grupo_id ?? '';
  const membros = useMembros(grupo);
  const pendencias = usePendencias(grupo);
  const invalidar = useInvalidarGrupo();

  const [pessoa, setPessoa] = useState<string | null>(null);
  const [sentido, setSentido] = useState<Sentido | null>(null);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (inicio.data && grupos.length === 0) {
    return (
      <Tela>
        <Aviso tipo="info" texto="Entre num grupo primeiro: pagamentos são sempre entre pessoas de um grupo." />
      </Tela>
    );
  }
  const erroCarga = textoDoErro(inicio.error ?? membros.error ?? pendencias.error);
  if (erroCarga) {
    return (
      <Tela>
        <Aviso texto={erroCarga} />
      </Tela>
    );
  }
  if (!inicio.data || !membros.data || !pendencias.data) {
    return (
      <Tela>
        <Esqueleto comResumo={false} />
      </Tela>
    );
  }

  const lista = pendencias.data;
  const nome = (u: string) => membros.data.find((m) => m.usuario_id === u)?.perfil.nome || 'Alguém';
  // quanto está em aberto entre você e cada pessoa, nos dois sentidos
  const aberto = (de: string, para: string) => {
    const doPar = lista.filter((p) => p.devedor === de && p.credor === para);
    return {
      exato: doPar.reduce((s, p) => s.plus(p.valor), new Decimal(0)),
      cobrar: doPar.reduce((s, p) => s.plus(p.cobrar), new Decimal(0)),
    };
  };
  const pessoas = membros.data.filter(
    (m) => m.usuario_id !== eu && (aberto(eu, m.usuario_id).cobrar.gt(0) || aberto(m.usuario_id, eu).cobrar.gt(0)),
  );

  const escolhida = pessoa && pessoas.some((m) => m.usuario_id === pessoa) ? pessoa : (pessoas[0]?.usuario_id ?? null);
  const devo = escolhida ? aberto(eu, escolhida) : null;
  const meDeve = escolhida ? aberto(escolhida, eu) : null;
  const sentidoAtual: Sentido | null = !escolhida ? null : (sentido ?? (devo!.cobrar.gt(0) ? 'paguei' : 'recebi'));
  const emAberto = sentidoAtual === 'paguei' ? devo : meDeve;

  function trocarGrupo(id: string) {
    setGrupoId(id);
    setPessoa(null);
    setSentido(null);
    setValor('');
    setErro(null);
  }

  async function salvar() {
    if (!escolhida || !sentidoAtual || !emAberto) return;
    const digitado = lerValor(valor || paraCampo(emAberto.cobrar));
    if (!digitado || digitado.lte(0)) {
      setErro('Informe o valor do pagamento.');
      return;
    }
    if (digitado.gt(emAberto.cobrar)) {
      setErro(`O valor passa do que está em aberto (${reais(emAberto.cobrar)}).`);
      return;
    }
    // o valor cheio vai com as casas extras guardadas, para a dívida zerar certinho
    const enviar = digitado.eq(emAberto.cobrar) ? emAberto.exato : digitado;
    const [de, para] = sentidoAtual === 'paguei' ? [eu, escolhida] : [escolhida, eu];
    setErro(null);
    setSalvando(true);
    try {
      await marcarPago(grupo, de, para, enviar, null);
      vibrarSucesso();
      await invalidar(grupo);
      router.back();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Tela>
      {grupos.length > 1 ? (
        <View style={{ gap: 6 }}>
          <Texto variante="rotulo">Grupo</Texto>
          <Fichas>
            {grupos.map((g) => (
              <Ficha
                key={g.grupo_id}
                rotulo={g.nome}
                cor={g.cor}
                selecionada={g.grupo_id === grupo}
                aoPressionar={() => trocarGrupo(g.grupo_id)}
              />
            ))}
          </Fichas>
        </View>
      ) : null}

      {pessoas.length === 0 ? (
        <Aviso tipo="info" texto="Neste grupo não há nada em aberto entre você e outra pessoa." />
      ) : (
        <>
          <View style={{ gap: 6 }}>
            <Texto variante="rotulo">Com quem</Texto>
            <Fichas>
              {pessoas.map((m) => (
                <Ficha
                  key={m.usuario_id}
                  rotulo={nome(m.usuario_id)}
                  selecionada={m.usuario_id === escolhida}
                  aoPressionar={() => {
                    setPessoa(m.usuario_id);
                    setSentido(null);
                    setValor('');
                  }}
                />
              ))}
            </Fichas>
          </View>

          {escolhida && devo && meDeve ? (
            <View style={{ gap: 6 }}>
              <Texto variante="rotulo">O que aconteceu</Texto>
              <Fichas>
                {devo.cobrar.gt(0) ? (
                  <Ficha
                    rotulo={`Paguei a ${nome(escolhida)}`}
                    selecionada={sentidoAtual === 'paguei'}
                    aoPressionar={() => {
                      setSentido('paguei');
                      setValor('');
                    }}
                  />
                ) : null}
                {meDeve.cobrar.gt(0) ? (
                  <Ficha
                    rotulo={`${nome(escolhida)} me pagou`}
                    selecionada={sentidoAtual === 'recebi'}
                    aoPressionar={() => {
                      setSentido('recebi');
                      setValor('');
                    }}
                  />
                ) : null}
              </Fichas>
            </View>
          ) : null}

          {emAberto ? (
            <>
              <CampoDinheiro
                rotulo="Quanto"
                value={valor}
                onChangeText={setValor}
                placeholder={paraCampo(emAberto.cobrar)}
              />
              <Texto variante="suave">
                Em aberto: {reais(emAberto.cobrar)}. Deixe em branco para acertar tudo, ou digite um valor menor para
                pagar só uma parte.
              </Texto>
            </>
          ) : null}

          {erro ? <Aviso texto={erro} /> : null}
          <Botao titulo="Registrar pagamento" aoPressionar={salvar} carregando={salvando} desabilitado={!emAberto} />
        </>
      )}
    </Tela>
  );
}
