import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as TextoSvg } from 'react-native-svg';

import { Linha, Texto } from '@/components/ui';
import { useTema } from '@/hooks/use-tema';
import { Decimal } from '@/lib/dinheiro';

export function Legenda({ itens }: { itens: { nome: string; cor: string }[] }) {
  return (
    <Linha style={{ flexWrap: 'wrap', gap: 10 }}>
      {itens.map((i) => (
        <Linha key={i.nome} style={{ gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: i.cor }} />
          <Texto variante="suave">{i.nome}</Texto>
        </Linha>
      ))}
    </Linha>
  );
}

// linhas em SVG; valores ausentes quebram a linha
export function GraficoDeLinhas({
  rotulos,
  series,
  comValores = false,
  linhaDoZero = false,
  altura = 170,
}: {
  rotulos: string[];
  series: { nome: string; cor: string; valores: (Decimal | null)[] }[];
  comValores?: boolean;
  linhaDoZero?: boolean;
  altura?: number;
}) {
  const tema = useTema();
  const [largura, setLargura] = useState(300);
  const margem = {
    esquerda: comValores ? 22 : 10,
    direita: comValores ? 22 : 10,
    cima: comValores ? 22 : 12,
    baixo: 22,
  };
  const todos = series.flatMap((s) => s.valores.filter((v): v is Decimal => v !== null));
  const maximo = todos.reduce((m, v) => Decimal.max(m, v), new Decimal(0));
  const minimo = todos.reduce((m, v) => Decimal.min(m, v), linhaDoZero ? new Decimal(0) : maximo);
  const faixa = maximo.minus(minimo).isZero() ? new Decimal(1) : maximo.minus(minimo);
  const x = (i: number) =>
    margem.esquerda +
    (rotulos.length === 1 ? 0 : (i * (largura - margem.esquerda - margem.direita)) / (rotulos.length - 1));
  const y = (v: Decimal) =>
    margem.cima +
    (altura - margem.cima - margem.baixo) * (1 - Number(v.minus(minimo).div(faixa).toFixed(4)) * 0.9 - 0.05);
  const passo = Math.ceil(rotulos.length / 6);

  return (
    <View onLayout={(e) => setLargura(e.nativeEvent.layout.width)} accessibilityRole="image">
      <Svg width={largura} height={altura}>
        <Line
          x1={margem.esquerda}
          x2={largura - margem.direita}
          y1={altura - margem.baixo}
          y2={altura - margem.baixo}
          stroke={tema.borda}
        />
        {linhaDoZero && minimo.lt(0) ? (
          <Line
            x1={margem.esquerda}
            x2={largura - margem.direita}
            y1={y(new Decimal(0))}
            y2={y(new Decimal(0))}
            stroke={tema.textoSuave}
            strokeDasharray="4 4"
          />
        ) : null}
        {series.map((s) => {
          const trechos: { i: number; v: Decimal }[][] = [[]];
          s.valores.forEach((v, i) => (v === null ? trechos.push([]) : trechos[trechos.length - 1].push({ i, v })));
          return (
            <G key={s.nome}>
              {trechos
                .filter((t) => t.length > 1)
                .map((t, k) => (
                  <Polyline
                    key={k}
                    points={t.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')}
                    fill="none"
                    stroke={s.cor}
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                  />
                ))}
              {s.valores.map((v, i) =>
                v === null ? null : (
                  <Circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={s.cor} stroke={tema.superficie} strokeWidth={1.5} />
                ),
              )}
              {comValores
                ? s.valores.map((v, i) =>
                    v === null ? null : (
                      <TextoSvg
                        key={`t${i}`}
                        x={x(i)}
                        y={y(v) - 8}
                        fontSize={10}
                        fontFamily="sans-serif"
                        fill={tema.texto}
                        textAnchor="middle">
                        {v.toFixed(2).replace('.', ',')}
                      </TextoSvg>
                    ),
                  )
                : null}
            </G>
          );
        })}
        {rotulos.map((r, i) =>
          i % passo === 0 || i === rotulos.length - 1 ? (
            <TextoSvg
              key={`r${i}`}
              x={x(i)}
              y={altura - 6}
              fontSize={10}
              fontFamily="sans-serif"
              fill={tema.textoSuave}
              textAnchor={i === 0 ? 'start' : i === rotulos.length - 1 ? 'end' : 'middle'}>
              {r}
            </TextoSvg>
          ) : null,
        )}
      </Svg>
    </View>
  );
}
