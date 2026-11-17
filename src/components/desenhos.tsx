import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTema } from '@/hooks/use-tema';

export type TipoDesenho = 'sacola' | 'cofre' | 'grupo' | 'busca' | 'sino' | 'grafico';

// Desenhos de traço simples para as telas vazias: fundo claro, contorno na cor do app
export function Desenho({ tipo, tamanho = 96 }: { tipo: TipoDesenho; tamanho?: number }) {
  const tema = useTema();
  const traco = {
    stroke: tema.primaria,
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const fundo = tema.superficie2;

  return (
    <Svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 96 96"
      accessibilityElementsHidden
      importantForAccessibility="no">
      <Circle cx={48} cy={48} r={46} fill={fundo} />
      {tipo === 'sacola' ? (
        <>
          <Path d="M27 36h42l-4 36H31z" fill={tema.superficie} {...traco} />
          <Path d="M38 40v-8a10 10 0 0 1 20 0v8" fill="none" {...traco} />
          <Path d="M40 54h16" fill="none" {...traco} />
        </>
      ) : null}
      {tipo === 'cofre' ? (
        <>
          <Rect x={24} y={26} width={48} height={44} rx={8} fill={tema.superficie} {...traco} />
          <Circle cx={48} cy={48} r={10} fill="none" {...traco} />
          <Path d="M48 38v4M48 54v4M38 48h4M54 48h4" fill="none" {...traco} />
          <Path d="M32 70v4M64 70v4" fill="none" {...traco} />
        </>
      ) : null}
      {tipo === 'grupo' ? (
        <>
          <Circle cx={34} cy={40} r={8} fill={tema.superficie} {...traco} />
          <Circle cx={62} cy={40} r={8} fill={tema.superficie} {...traco} />
          <Circle cx={48} cy={34} r={9} fill={tema.superficie} {...traco} />
          <Path d="M22 68c0-9 6-15 12-15M74 68c0-9-6-15-12-15" fill="none" {...traco} />
          <Path d="M34 70c0-10 6-17 14-17s14 7 14 17" fill={tema.superficie} {...traco} />
        </>
      ) : null}
      {tipo === 'busca' ? (
        <>
          <Circle cx={43} cy={43} r={15} fill={tema.superficie} {...traco} />
          <Path d="M54 54l13 13" fill="none" {...traco} strokeWidth={5} />
        </>
      ) : null}
      {tipo === 'sino' ? (
        <>
          <Path d="M32 62V46a16 16 0 0 1 32 0v16l5 5H27z" fill={tema.superficie} {...traco} />
          <Path d="M43 72a5 5 0 0 0 10 0" fill="none" {...traco} />
        </>
      ) : null}
      {tipo === 'grafico' ? (
        <>
          <Path d="M26 70h46" fill="none" {...traco} />
          <Rect x={30} y={50} width={9} height={20} rx={2} fill={tema.superficie} {...traco} />
          <Rect x={44} y={38} width={9} height={32} rx={2} fill={tema.superficie} {...traco} />
          <Rect x={58} y={28} width={9} height={42} rx={2} fill={tema.superficie} {...traco} />
        </>
      ) : null}
    </Svg>
  );
}
