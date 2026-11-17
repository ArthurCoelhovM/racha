import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  Aviso,
  Avatar,
  Cartao,
  Esqueleto,
  Ficha,
  Fichas,
  Icone,
  Linha,
  Separador,
  Texto,
  Vazio,
  type NomeIcone,
} from '@/components/ui';
import { espaco, raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import type { LinhaExtrato, PontoParaOlhar } from '@/lib/api';
import { textoDoErro, useConferir, useExtrato } from '@/lib/consultas';
import { dec, Decimal, ehZero, reais, reaisCobrar } from '@/lib/dinheiro';
import { diaCurto, isoParaBr } from '@/lib/formatos';
import type { Pendencia } from '@/lib/saldos';
import type { Membro } from '@/lib/tipos';

// Aba "Conferir" das dívidas: o selo do grupo, o que vale olhar e o extrato com uma pessoa
export function Conferir({
  grupoId,
  abatimento,
  membros,
  pendencias,
  eu,
  nome,
  pessoaInicial,
  aoAbrirGasto,
}: {
  grupoId: string;
  abatimento: boolean;
  membros: Membro[];
  pendencias: Pendencia[];
  eu: string;
  nome: (u: string) => string;
  pessoaInicial: string | null;
  aoAbrirGasto: (gastoId: string) => void;
}) {
  // primeiro quem tem conta aberta com você, depois o resto do grupo
  const comConta = new Set(
    pendencias.flatMap((p) => (p.devedor === eu ? [p.credor] : p.credor === eu ? [p.devedor] : [])),
  );
  const outros = membros
    .filter((m) => m.usuario_id !== eu && (m.ativo || comConta.has(m.usuario_id)))
    .sort((a, b) => Number(comConta.has(b.usuario_id)) - Number(comConta.has(a.usuario_id)));
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const pessoa = escolhida ?? pessoaInicial ?? outros[0]?.usuario_id ?? null;

  return (
    <>
      <SeloDoGrupo grupoId={grupoId} aoAbrirGasto={aoAbrirGasto} />

      <View style={{ gap: 6 }}>
        <Texto variante="rotulo">Extrato com</Texto>
        {outros.length === 0 ? (
          <Texto variante="suave">Ninguém mais no grupo ainda.</Texto>
        ) : (
          <Fichas>
            {outros.map((m) => (
              <Ficha
                key={m.usuario_id}
                rotulo={nome(m.usuario_id)}
                selecionada={m.usuario_id === pessoa}
                aoPressionar={() => setEscolhida(m.usuario_id)}
              />
            ))}
          </Fichas>
        )}
      </View>

      {pessoa ? (
        <Extrato
          grupoId={grupoId}
          outro={pessoa}
          abatimento={abatimento}
          pendencias={pendencias}
          eu={eu}
          nome={nome}
          aoAbrirGasto={aoAbrirGasto}
        />
      ) : null}
    </>
  );
}

function SeloDoGrupo({ grupoId, aoAbrirGasto }: { grupoId: string; aoAbrirGasto: (id: string) => void }) {
  const tema = useTema();
  const conferir = useConferir(grupoId, true);
  if (conferir.isPending) return <Esqueleto comResumo={false} linhas={1} />;
  if (conferir.error) return <Aviso texto={textoDoErro(conferir.error)!} />;

  const pontos = conferir.data;
  const naoFecha = pontos.filter((p) => p.tipo === 'nao_fecha');
  const resto = pontos.filter((p) => p.tipo !== 'nao_fecha');
  const ok = naoFecha.length === 0;

  return (
    <>
      <View style={[estilos.selo, { backgroundColor: ok ? tema.fundoPositivo : tema.fundoNegativo }]}>
        <Icone nome={ok ? 'shield-checkmark' : 'alert-circle'} cor={ok ? tema.positivo : tema.negativo} tamanho={26} />
        <View style={{ flex: 1, gap: 2 }}>
          <Texto variante="forte" cor={ok ? tema.positivo : tema.negativo}>
            {ok
              ? 'As contas fecham'
              : `${naoFecha.length === 1 ? 'Um gasto não fecha' : `${naoFecha.length} gastos não fecham`}`}
          </Texto>
          <Texto variante="suave" cor={ok ? tema.positivo : tema.negativo}>
            {ok
              ? 'Em todos os gastos, as partes e quem pagou somam o total. As dívidas saem daí.'
              : 'As partes ou quem pagou não somam o total. Abra o gasto e salve de novo para corrigir.'}
          </Texto>
        </View>
      </View>
      {naoFecha.length > 0 ? <ListaDePontos pontos={naoFecha} aoAbrirGasto={aoAbrirGasto} /> : null}

      {resto.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Texto variante="rotulo">Vale dar uma olhada</Texto>
          <ListaDePontos pontos={resto} aoAbrirGasto={aoAbrirGasto} />
        </View>
      ) : null}
    </>
  );
}

const PONTOS: Record<PontoParaOlhar['tipo'], { icone: NomeIcone; titulo: string }> = {
  nao_fecha: { icone: 'calculator-outline', titulo: 'Não fecha' },
  duplicado: { icone: 'copy-outline', titulo: 'Lançado duas vezes?' },
  futuro: { icone: 'calendar-outline', titulo: 'Data no futuro' },
  sem_valor: { icone: 'hourglass-outline', titulo: 'Conta sem valor' },
  pagamento_maior: { icone: 'cash-outline', titulo: 'Pagou a mais' },
};

function ListaDePontos({ pontos, aoAbrirGasto }: { pontos: PontoParaOlhar[]; aoAbrirGasto: (id: string) => void }) {
  const tema = useTema();
  return (
    <Cartao style={{ padding: 0, gap: 0 }}>
      {pontos.map((p, i) => {
        const info = PONTOS[p.tipo];
        const abrir = p.gasto_id ? () => aoAbrirGasto(p.gasto_id!) : undefined;
        return (
          <View key={`${p.tipo}-${p.gasto_id ?? p.descricao}-${p.data}`}>
            {i > 0 ? <Separador /> : null}
            <Pressable
              onPress={abrir}
              disabled={!abrir}
              accessibilityRole={abrir ? 'button' : undefined}
              style={({ pressed }) => [estilos.ponto, { opacity: pressed ? 0.7 : 1 }]}>
              <Icone nome={info.icone} cor={tema.aviso} tamanho={20} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Texto variante="forte" numberOfLines={1}>
                  {info.titulo}: {p.descricao}
                </Texto>
                <Texto variante="suave" numberOfLines={2}>
                  {isoParaBr(p.data)} · {p.detalhe}
                </Texto>
              </View>
              {abrir ? <Icone nome="chevron-forward" cor={tema.textoSuave} tamanho={18} /> : null}
            </Pressable>
          </View>
        );
      })}
    </Cartao>
  );
}

// "você deve R$ 41,67" / "Bia te deve R$ 10,00" / "tudo certo"
function textoDoSaldo(saldo: Decimal, outro: string): string {
  if (ehZero(saldo)) return 'tudo certo';
  return saldo.gt(0) ? `você deve ${reaisCobrar(saldo)}` : `${outro} te deve ${reaisCobrar(saldo.neg())}`;
}

function Extrato({
  grupoId,
  outro,
  abatimento,
  pendencias,
  eu,
  nome,
  aoAbrirGasto,
}: {
  grupoId: string;
  outro: string;
  abatimento: boolean;
  pendencias: Pendencia[];
  eu: string;
  nome: (u: string) => string;
  aoAbrirGasto: (id: string) => void;
}) {
  const tema = useTema();
  const extrato = useExtrato(grupoId, outro);
  const nomeOutro = nome(outro);
  if (extrato.isPending) return <Esqueleto comResumo={false} />;
  if (extrato.error) return <Aviso texto={textoDoErro(extrato.error)!} />;

  const linhas = extrato.data;
  if (linhas.length === 0) {
    return (
      <Vazio
        titulo={`Nada entre você e ${nomeOutro}`}
        texto="Nenhum gasto dividido e nenhum pagamento entre vocês dois."
      />
    );
  }

  const comSaldo = saldoAcumulado(linhas);
  const saldo = comSaldo[comSaldo.length - 1].saldo;

  // a conta do rodapé
  const soma = (filtro: (l: LinhaExtrato) => boolean) =>
    linhas.filter(filtro).reduce((s, l) => s.plus(dec(l.efeito)), new Decimal(0));
  const eraMeu = soma((l) => l.tipo === 'gasto' && dec(l.efeito).gt(0));
  const eraDela = soma((l) => l.tipo === 'gasto' && dec(l.efeito).lt(0)).neg();
  const pagos = soma((l) => l.tipo === 'pagamento');
  const devoAgora = pendencias
    .filter((p) => p.devedor === eu && p.credor === outro)
    .reduce((s, p) => s.plus(p.cobrar), new Decimal(0));
  const meDeveAgora = pendencias
    .filter((p) => p.devedor === outro && p.credor === eu)
    .reduce((s, p) => s.plus(p.cobrar), new Decimal(0));

  return (
    <>
      <Cartao style={{ padding: 0, gap: 0 }}>
        <Linha style={[estilos.cabecalho, { backgroundColor: tema.superficie2 }]}>
          <Avatar id={outro} nome={nomeOutro} tamanho={28} />
          <Texto variante="forte" style={{ flex: 1 }} numberOfLines={1}>
            Você e {nomeOutro}
          </Texto>
          <Texto variante="suave">Saldo</Texto>
        </Linha>
        {comSaldo.map((l, i) => {
          const efeito = dec(l.efeito);
          const sobe = efeito.gt(0);
          const abrir = l.gasto_id && l.tipo === 'gasto' ? () => aoAbrirGasto(l.gasto_id!) : undefined;
          return (
            <View key={`${l.tipo}-${l.criado_em}-${i}`}>
              <Separador />
              <Pressable
                onPress={abrir}
                disabled={!abrir}
                style={({ pressed }) => [estilos.movimento, { opacity: pressed ? 0.7 : 1 }]}>
                <Texto variante="suave" style={estilos.data}>
                  {diaCurto(l.data)}
                </Texto>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Texto variante="forte" numberOfLines={2}>
                    {descreverMovimento(l, nomeOutro)}
                  </Texto>
                  <Texto variante="suave" cor={sobe ? tema.negativo : tema.positivo}>
                    {sobe ? '↑ você deve + ' : l.tipo === 'pagamento' ? '↓ abate ' : `↓ ${nomeOutro} deve + `}
                    {reais(efeito.abs())}
                  </Texto>
                </View>
                <SaldoDaLinha saldo={l.saldo} outro={nomeOutro} />
              </Pressable>
            </View>
          );
        })}
      </Cartao>

      <Cartao style={{ gap: 6 }}>
        <Texto variante="rotulo">A conta</Texto>
        {abatimento ? (
          <>
            <Texto>
              Pelos gastos, você devia {reais(eraMeu)} e {nomeOutro} devia {reais(eraDela)}
              {pagos.isZero() ? '' : `; os pagamentos entre vocês somam ${reais(pagos.abs())}`}.
            </Texto>
            <Texto variante="forte">
              {ehZero(saldo)
                ? 'Abatido, ninguém deve nada.'
                : saldo.gt(0)
                  ? `Abatido: você paga ${reaisCobrar(saldo)} a ${nomeOutro}.`
                  : `Abatido: ${nomeOutro} te paga ${reaisCobrar(saldo.neg())}.`}
            </Texto>
          </>
        ) : (
          <>
            <Texto>
              Sem abatimento, cada gasto é pago separado: você deve {reais(devoAgora)} a {nomeOutro} e {nomeOutro} te
              deve {reais(meDeveAgora)}.
            </Texto>
            <Texto variante="suave">Se o grupo usasse abatimento, ficaria {textoDoSaldo(saldo, nomeOutro)}.</Texto>
          </>
        )}
      </Cartao>
    </>
  );
}

// saldo depois de cada movimento, como num extrato de banco
function saldoAcumulado(linhas: LinhaExtrato[]) {
  const resultado: (LinhaExtrato & { saldo: Decimal })[] = [];
  for (const l of linhas) {
    const antes = resultado.length ? resultado[resultado.length - 1].saldo : new Decimal(0);
    resultado.push({ ...l, saldo: antes.plus(dec(l.efeito)) });
  }
  return resultado;
}

// à direita de cada linha: quem deve depois deste movimento, em duas linhas curtas
function SaldoDaLinha({ saldo, outro }: { saldo: Decimal; outro: string }) {
  const tema = useTema();
  if (ehZero(saldo)) {
    return (
      <Texto variante="suave" style={estilos.saldo} cor={tema.textoSuave}>
        tudo certo
      </Texto>
    );
  }
  const devo = saldo.gt(0);
  const cor = devo ? tema.negativo : tema.positivo;
  return (
    <View style={{ width: 96, alignItems: 'flex-end' }}>
      <Texto variante="suave" cor={cor} numberOfLines={1}>
        {devo ? 'você deve' : `${outro} deve`}
      </Texto>
      <Texto variante="forte" cor={cor} style={{ fontVariant: ['tabular-nums'] }}>
        {reaisCobrar(saldo.abs())}
      </Texto>
    </View>
  );
}

function descreverMovimento(l: LinhaExtrato, outro: string): string {
  if (l.tipo === 'pagamento') {
    const quem = dec(l.efeito).lt(0)
      ? `Você pagou ${reais(l.valor_total)} a ${outro}`
      : `${outro} te pagou ${reais(l.valor_total)}`;
    return l.descricao ? `${quem} (${l.descricao})` : quem;
  }
  return `${l.descricao ?? 'Gasto'}, ${reais(l.valor_total)}`;
}

const estilos = StyleSheet.create({
  selo: { flexDirection: 'row', gap: espaco.m + 4, padding: espaco.g, borderRadius: raio.g, alignItems: 'center' },
  ponto: { flexDirection: 'row', alignItems: 'center', gap: espaco.m + 4, padding: espaco.g },
  cabecalho: { paddingHorizontal: espaco.g, paddingVertical: espaco.m + 2 },
  movimento: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco.m + 2, padding: espaco.g },
  data: { width: 40, paddingTop: 2, fontVariant: ['tabular-nums'] },
  saldo: { width: 96, textAlign: 'right', fontWeight: '700', paddingTop: 2 },
});
