import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

// QR desenhado em SVG: sempre preto no branco, para qualquer banco conseguir ler
export function QrCode({ texto, tamanho = 220 }: { texto: string; tamanho?: number }) {
  const { caminho, lado } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.isDark(y, x)) d += `M${x + 4} ${y + 4}h1v1h-1z`;
      }
    }
    return { caminho: d, lado: n + 8 };
  }, [texto]);

  return (
    <Svg width={tamanho} height={tamanho} viewBox={`0 0 ${lado} ${lado}`} accessibilityLabel="QR code do Pix">
      <Rect x={0} y={0} width={lado} height={lado} fill="#FFFFFF" />
      <Path d={caminho} fill="#000000" />
    </Svg>
  );
}
