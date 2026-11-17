import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DicaInstalar } from '@/components/dica-instalar';
import { GruposQueDeixei } from '@/components/inicio/grupos-que-deixei';
import { PrimeirosPassos } from '@/components/tutorial/primeiros-passos';
import { Aviso, Botao, Esqueleto, Linha, Tela, Texto, Valor, Vazio } from '@/components/ui';
import { espaco, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { textoDoErro, useAtualizarAoFocar, useInicio, usePuxar } from '@/lib/consultas';
import { dec, Decimal, ehZero, reaisCobrar, valorACobrar } from '@/lib/dinheiro';
import { pegarCodigoPendente, useSessao } from '@/lib/sessao';
import type { ResumoGrupo } from '@/lib/tipos';
import { ultimoGrupo } from '@/lib/ultimo-grupo';

export default function Grupos() {
  const tema = useTema();
  const consulta = useInicio();
  const { usuarioId } = useSessao();
  const [verArquivados, setVerArquivados] = useState(false);
  const dados = consulta.data;
  const erro = textoDoErro(consulta.error);
  const carregando = consulta.isPending && !erro;
  const recarregar = consulta.refetch;
  const { puxando: atualizando, puxar } = usePuxar(recarregar);
  useAtualizarAoFocar(recarregar);

  useEffect(() => {
    const codigo = pegarCodigoPendente();
    if (codigo) router.push({ pathname: '/entrar-grupo', params: { codigo } });
  }, []);

  const grupos = dados?.grupos ?? [];
  const ativos = grupos.filter((g) => !g.arquivado);
  const arquivados = grupos.filter((g) => g.arquivado);
  const totalDevo = grupos.reduce((s, g) => s.plus(dec(g.voce_deve)), new Decimal(0));
  const totalMeDevem = grupos.reduce((s, g) => s.plus(dec(g.te_devem)), new Decimal(0));

  // gasto novo já abre no último grupo usado (ou no primeiro da lista), com a troca de grupo no topo
  function novoGasto() {
    if (grupos.length === 0) return router.push('/grupo/novo');
    const ultimo = ultimoGrupo();
    const lista = ativos.length ? ativos : grupos;
    const id = lista.some((g) => g.grupo_id === ultimo) ? ultimo! : lista[0].grupo_id;
    router.push({ pathname: '/grupo/[id]/gasto', params: { id, escolher: '1' } });
  }

  return (
    <Tela aoAtualizar={puxar} atualizando={atualizando}>
      {carregando ? <Esqueleto comResumo={false} linhas={3} /> : null}
      {erro ? <Aviso texto={erro} acao="Tentar de novo" aoAcionar={() => recarregar()} /> : null}

      <DicaInstalar />

      {!carregando && !erro ? <PrimeirosPassos grupos={ativos} aoNovoGasto={novoGasto} /> : null}

      {!carregando && grupos.length > 0 ? (
        <View style={estilos.totais}>
          <Total rotulo="↓ Você paga" valor={totalDevo} cor={tema.negativo} fundo={tema.fundoNegativo} />
          <Total rotulo="↑ Você recebe" valor={totalMeDevem} cor={tema.positivo} fundo={tema.fundoPositivo} />
        </View>
      ) : null}

      {!carregando && !erro && grupos.length === 0 ? (
        <Vazio
          desenho="grupo"
          titulo="Nenhum grupo ainda"
          texto="Crie um grupo para a casa, uma viagem ou o mercado, ou entre num grupo com o código que te mandaram.">
          <View style={{ gap: espaco.m, alignSelf: 'stretch', marginTop: espaco.m }}>
            <Botao titulo="Criar grupo" aoPressionar={() => router.push('/grupo/novo')} />
            <Botao titulo="Entrar com código" variante="secundario" aoPressionar={() => router.push('/entrar-grupo')} />
          </View>
        </Vazio>
      ) : null}

      {ativos.map((g) => (
        <CartaoGrupo key={g.grupo_id} grupo={g} />
      ))}

      {arquivados.length > 0 ? (
        <Botao
          titulo={verArquivados ? 'Esconder arquivados' : `Arquivados (${arquivados.length})`}
          variante="texto"
          aoPressionar={() => setVerArquivados(!verArquivados)}
        />
      ) : null}
      {verArquivados ? arquivados.map((g) => <CartaoGrupo key={g.grupo_id} grupo={g} />) : null}

      <GruposQueDeixei eu={usuarioId ?? ''} />

      {grupos.length > 0 ? (
        <Linha style={{ gap: espaco.m }}>
          <Botao
            titulo="Novo grupo"
            variante="secundario"
            aoPressionar={() => router.push('/grupo/novo')}
            style={{ flex: 1 }}
          />
          <Botao
            titulo="Entrar com código"
            variante="secundario"
            aoPressionar={() => router.push('/entrar-grupo')}
            style={{ flex: 1 }}
          />
        </Linha>
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
      <Valor valor={valorACobrar(valor)} cor={zerado ? tema.textoSuave : cor} tamanho={26} />
    </View>
  );
}

function CartaoGrupo({ grupo }: { grupo: ResumoGrupo }) {
  const tema = useTema();
  const devo = dec(grupo.voce_deve);
  const meDevem = dec(grupo.te_devem);

  let situacao = { texto: 'Tudo certo', cor: tema.textoSuave, fundo: tema.superficie2 };
  if (!ehZero(devo))
    situacao = { texto: `↓ Você paga ${reaisCobrar(devo)}`, cor: tema.negativo, fundo: tema.fundoNegativo };
  else if (!ehZero(meDevem))
    situacao = { texto: `↑ Você recebe ${reaisCobrar(meDevem)}`, cor: tema.positivo, fundo: tema.fundoPositivo };

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
                ↑ Você recebe {reaisCobrar(meDevem)}
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
});
