import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DicaInstalar } from '@/components/dica-instalar';
import { Aviso, Botao, BotaoFlutuante, Carregando, Linha, Tela, Texto, Vazio } from '@/components/ui';
import { espaco, raio } from '@/constants/tema';
import { useCarregar } from '@/hooks/use-carregar';
import { useTema } from '@/hooks/use-tema';
import { contarAvisosNaoLidos, lancarMeusRecorrentes, listarMeusGrupos } from '@/lib/api';
import { dec, Decimal, ehZero, reaisCobrar } from '@/lib/dinheiro';
import { pegarCodigoPendente } from '@/lib/sessao';
import type { ResumoGrupo } from '@/lib/tipos';

async function carregarInicio() {
  await lancarMeusRecorrentes();
  const [grupos, naoLidos] = await Promise.all([listarMeusGrupos(), contarAvisosNaoLidos().catch(() => 0)]);
  return { grupos, naoLidos };
}

export default function Grupos() {
  const tema = useTema();
  const { dados, erro, carregando, atualizando, recarregar } = useCarregar(carregarInicio);

  useEffect(() => {
    const codigo = pegarCodigoPendente();
    if (codigo) router.push({ pathname: '/entrar-grupo', params: { codigo } });
  }, []);

  const grupos = dados?.grupos ?? [];
  const naoLidos = dados?.naoLidos ?? 0;
  const totalDevo = grupos.reduce((s, g) => s.plus(dec(g.voce_deve)), new Decimal(0));
  const totalMeDevem = grupos.reduce((s, g) => s.plus(dec(g.te_devem)), new Decimal(0));

  return (
    <Tela
      aoAtualizar={recarregar}
      atualizando={atualizando}
      sobreposto={<BotaoFlutuante titulo="+ Grupo" aoPressionar={() => router.push('/grupo/novo')} />}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Linha style={{ gap: 18, paddingHorizontal: 8 }}>
              <Pressable
                onPress={() => router.push('/avisos')}
                hitSlop={10}
                accessibilityLabel={`Avisos, ${naoLidos} não lidos`}>
                <Linha style={{ gap: 6 }}>
                  <Texto variante="forte" cor={tema.primaria}>
                    Avisos
                  </Texto>
                  {naoLidos > 0 ? (
                    <View style={[estilos.contador, { backgroundColor: tema.negativo }]}>
                      <Texto variante="suave" cor="#FFFFFF" style={{ fontWeight: '800', fontSize: 12 }}>
                        {naoLidos > 99 ? '99+' : naoLidos}
                      </Texto>
                    </View>
                  ) : null}
                </Linha>
              </Pressable>
              <Pressable onPress={() => router.push('/conta')} hitSlop={10}>
                <Texto variante="forte" cor={tema.primaria}>
                  Conta
                </Texto>
              </Pressable>
            </Linha>
          ),
        }}
      />

      {carregando ? <Carregando /> : null}
      {erro ? <Aviso texto={erro} acao="Tentar de novo" aoAcionar={recarregar} /> : null}

      <DicaInstalar />

      {!carregando && grupos.length > 0 ? (
        <View style={estilos.totais}>
          <Total rotulo="Você deve" valor={totalDevo} cor={tema.negativo} fundo={tema.fundoNegativo} />
          <Total rotulo="Te devem" valor={totalMeDevem} cor={tema.positivo} fundo={tema.fundoPositivo} />
        </View>
      ) : null}

      {!carregando && !erro && grupos.length === 0 ? (
        <Vazio
          titulo="Nenhum grupo ainda"
          texto="Crie um grupo para a casa, uma viagem ou o mercado, ou entre num grupo com o código que te mandaram.">
          <View style={{ gap: espaco.m, alignSelf: 'stretch', marginTop: espaco.m }}>
            <Botao titulo="Criar grupo" aoPressionar={() => router.push('/grupo/novo')} />
            <Botao titulo="Entrar com código" variante="secundario" aoPressionar={() => router.push('/entrar-grupo')} />
          </View>
        </Vazio>
      ) : null}

      {grupos.map((g) => (
        <CartaoGrupo key={g.grupo_id} grupo={g} />
      ))}

      {grupos.length > 0 ? (
        <Botao titulo="Entrar com código" variante="secundario" aoPressionar={() => router.push('/entrar-grupo')} />
      ) : null}
    </Tela>
  );
}

function Total({ rotulo, valor, cor, fundo }: { rotulo: string; valor: Decimal; cor: string; fundo: string }) {
  const tema = useTema();
  const zerado = ehZero(valor);
  return (
    <View style={[estilos.total, { backgroundColor: zerado ? tema.superficie2 : fundo }]}>
      <Texto variante="rotulo" cor={zerado ? tema.textoSuave : cor}>
        {rotulo}
      </Texto>
      <Texto variante="grande" cor={zerado ? tema.textoSuave : cor}>
        {reaisCobrar(valor)}
      </Texto>
    </View>
  );
}

function CartaoGrupo({ grupo }: { grupo: ResumoGrupo }) {
  const tema = useTema();
  const devo = dec(grupo.voce_deve);
  const meDevem = dec(grupo.te_devem);

  let situacao = { texto: 'Tudo certo', cor: tema.textoSuave, fundo: tema.superficie2 };
  if (!ehZero(devo))
    situacao = { texto: `Você deve ${reaisCobrar(devo)}`, cor: tema.negativo, fundo: tema.fundoNegativo };
  else if (!ehZero(meDevem))
    situacao = { texto: `Te devem ${reaisCobrar(meDevem)}`, cor: tema.positivo, fundo: tema.fundoPositivo };

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/grupo/[id]', params: { id: grupo.grupo_id } })}
      style={({ pressed }) => [
        estilos.cartao,
        { backgroundColor: tema.superficie, borderColor: tema.borda, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={[estilos.faixa, { backgroundColor: grupo.cor }]} />
      <View style={{ flex: 1, gap: 6, padding: espaco.g }}>
        <Texto variante="subtitulo" numberOfLines={1}>
          {grupo.nome}
        </Texto>
        <Texto variante="suave">
          {grupo.total_membros} {grupo.total_membros === 1 ? 'pessoa' : 'pessoas'} ·{' '}
          {grupo.abatimento ? 'com abatimento' : 'sem abatimento'}
        </Texto>
        <Linha>
          <View style={[estilos.situacao, { backgroundColor: situacao.fundo }]}>
            <Texto variante="suave" cor={situacao.cor} style={{ fontWeight: '700' }}>
              {situacao.texto}
            </Texto>
          </View>
          {!ehZero(devo) && !ehZero(meDevem) ? (
            <View style={[estilos.situacao, { backgroundColor: tema.fundoPositivo }]}>
              <Texto variante="suave" cor={tema.positivo} style={{ fontWeight: '700' }}>
                Te devem {reaisCobrar(meDevem)}
              </Texto>
            </View>
          ) : null}
        </Linha>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  totais: { flexDirection: 'row', gap: espaco.m },
  total: { flex: 1, borderRadius: raio.g, padding: espaco.g, gap: 4 },
  cartao: { flexDirection: 'row', borderRadius: raio.g, borderWidth: 1, overflow: 'hidden' },
  faixa: { width: 6 },
  situacao: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: raio.total },
  contador: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
