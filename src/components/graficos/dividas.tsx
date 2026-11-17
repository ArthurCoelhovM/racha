import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as TextoSvg } from 'react-native-svg';

import { GraficoDeLinhas } from '@/components/graficos/linhas';
import { Cartao, Texto, useCorDaPessoa } from '@/components/ui';
import { useTema } from '@/hooks/use-tema';
import { Decimal, dec, reais } from '@/lib/dinheiro';
import { diaCurto } from '@/lib/formatos';
import type { Pendencia } from '@/lib/saldos';
import type { LinhaExtrato } from '@/lib/api';

// Mapa de quem deve a quem: cada pessoa é uma bolinha e cada seta vai de quem deve para quem recebe.
// Com abatimento, entre duas pessoas há no máximo uma seta: é o abatimento direto em uma imagem.
export function MapaDeDividas({
  pendencias,
  pessoas,
  eu,
  nome,
}: {
  pendencias: Pendencia[];
  pessoas: string[];
  eu: string;
  nome: (u: string) => string;
}) {
  const tema = useTema();
  const cor = useCorDaPessoa();
  const [largura, setLargura] = useState(320);

  // soma por par e sentido
  const setas = new Map<string, { de: string; para: string; valor: Decimal }>();
  for (const p of pendencias) {
    const k = `${p.devedor}|${p.credor}`;
    const atual = setas.get(k) ?? { de: p.devedor, para: p.credor, valor: new Decimal(0) };
    atual.valor = atual.valor.plus(p.cobrar);
    setas.set(k, atual);
  }
  const envolvidas = pessoas.filter((u) => [...setas.values()].some((s) => s.de === u || s.para === u));
  if (envolvidas.length < 2) return null;

  const altura = Math.min(Math.max(largura * 0.85, 260), 380);
  const cx = largura / 2;
  const cy = altura / 2;
  const raioRoda = Math.min(largura, altura) / 2 - 46;
  const r = 20;
  const pos = new Map(
    envolvidas.map((u, i) => {
      const ang = -Math.PI / 2 + (2 * Math.PI * i) / envolvidas.length;
      return [u, { x: cx + raioRoda * Math.cos(ang), y: cy + raioRoda * Math.sin(ang) }];
    }),
  );

  return (
    <Cartao>
      <View style={{ gap: 2 }}>
        <Texto variante="forte">Quem deve a quem</Texto>
        <Texto variante="suave">A seta sai de quem deve e chega em quem recebe.</Texto>
      </View>
      <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)} accessibilityRole="image">
        <Svg width={largura} height={altura}>
          {[...setas.values()].map((s) => {
            const a = pos.get(s.de)!;
            const b = pos.get(s.para)!;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 1;
            const ux = dx / d;
            const uy = dy / d;
            // se houver seta nos dois sentidos (sem abatimento), cada uma fica de um lado
            const volta = setas.has(`${s.para}|${s.de}`);
            const ox = volta ? -uy * 7 : 0;
            const oy = volta ? ux * 7 : 0;
            const x1 = a.x + ux * (r + 3) + ox;
            const y1 = a.y + uy * (r + 3) + oy;
            const x2 = b.x - ux * (r + 6) + ox;
            const y2 = b.y - uy * (r + 6) + oy;
            const cor = s.de === eu ? tema.negativo : s.para === eu ? tema.positivo : tema.textoSuave;
            const ponta = `M${x2} ${y2} L${x2 - ux * 10 - uy * 5} ${y2 - uy * 10 + ux * 5} L${x2 - ux * 10 + uy * 5} ${y2 - uy * 10 - ux * 5} Z`;
            const mx = (x1 + x2) / 2 + ox * 1.6;
            const my = (y1 + y2) / 2 + oy * 1.6;
            const rotulo = reais(s.valor).replace('R$ ', '');
            return (
              <G key={`${s.de}|${s.para}`}>
                <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={cor} strokeWidth={2.5} />
                <Path d={ponta} fill={cor} />
                <Rect
                  x={mx - rotulo.length * 3.4 - 5}
                  y={my - 9}
                  width={rotulo.length * 6.8 + 10}
                  height={18}
                  rx={9}
                  fill={tema.superficie}
                  stroke={cor}
                  strokeWidth={1}
                />
                <TextoSvg
                  x={mx}
                  y={my + 4}
                  fontSize={11}
                  fontFamily="sans-serif"
                  fontWeight="700"
                  fill={cor}
                  textAnchor="middle">
                  {rotulo}
                </TextoSvg>
              </G>
            );
          })}
          {envolvidas.map((u) => {
            const p = pos.get(u)!;
            const n = nome(u);
            return (
              <G key={u}>
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={cor(u)}
                  stroke={u === eu ? tema.texto : tema.superficie}
                  strokeWidth={u === eu ? 3 : 2}
                />
                <TextoSvg
                  x={p.x}
                  y={p.y + 5}
                  fontSize={14}
                  fontFamily="sans-serif"
                  fontWeight="800"
                  fill="#FFFFFF"
                  textAnchor="middle">
                  {n.slice(0, 1).toUpperCase()}
                </TextoSvg>
                <TextoSvg
                  x={p.x}
                  y={p.y + r + 15}
                  fontSize={11.5}
                  fontFamily="sans-serif"
                  fontWeight={u === eu ? '800' : '600'}
                  fill={tema.texto}
                  textAnchor="middle">
                  {n.length > 14 ? `${n.slice(0, 13)}…` : n}
                </TextoSvg>
              </G>
            );
          })}
        </Svg>
      </View>
    </Cartao>
  );
}

// Saldo entre você e uma pessoa depois de cada movimento: acima da linha tracejada, você deve
export function SaldoNoTempo({ linhas, outro }: { linhas: (LinhaExtrato & { saldo: Decimal })[]; outro: string }) {
  const tema = useTema();
  if (linhas.length < 2) return null;
  const ultimos = linhas.slice(-12);
  return (
    <Cartao>
      <View style={{ gap: 2 }}>
        <Texto variante="forte">O saldo com {outro} ao longo do tempo</Texto>
        <Texto variante="suave">
          Acima da linha tracejada, você deve; abaixo, {outro} te deve. Se a linha só sobe, vale acertar.
        </Texto>
      </View>
      <GraficoDeLinhas
        rotulos={ultimos.map((l) => diaCurto(l.data))}
        series={[{ nome: 'saldo', cor: tema.primaria, valores: ultimos.map((l) => dec(l.saldo)) }]}
        linhaDoZero
        altura={150}
      />
    </Cartao>
  );
}
