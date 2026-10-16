import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Botao, Texto } from '@/components/ui';
import { raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';

// No celular: câmera nativa do expo-camera lendo só QR code.
export function LeitorQr({ aoLer }: { aoLer: (texto: string) => void }) {
  const tema = useTema();
  const [permissao, pedirPermissao] = useCameraPermissions();
  const ultimo = useRef<{ texto: string; quando: number } | null>(null);

  if (!permissao) return <View style={[estilos.quadro, { backgroundColor: tema.superficie2 }]} />;

  if (!permissao.granted) {
    return (
      <View style={[estilos.quadro, estilos.centro, { backgroundColor: tema.superficie2 }]}>
        <Texto style={{ textAlign: 'center' }}>Para ler o QR code, o app precisa usar a câmera.</Texto>
        <Botao titulo="Permitir câmera" aoPressionar={pedirPermissao} />
      </View>
    );
  }

  return (
    <View style={estilos.quadro}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          const agora = Date.now();
          if (ultimo.current && ultimo.current.texto === data && agora - ultimo.current.quando < 3000) return;
          ultimo.current = { texto: data, quando: agora };
          aoLer(data);
        }}
      />
      <View pointerEvents="none" style={[estilos.mira, { borderColor: '#FFFFFF' }]} />
    </View>
  );
}

const estilos = StyleSheet.create({
  quadro: { height: 320, borderRadius: raio.g, overflow: 'hidden', backgroundColor: '#000' },
  centro: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  mira: {
    position: 'absolute',
    top: '15%',
    left: '20%',
    right: '20%',
    bottom: '15%',
    borderWidth: 3,
    borderRadius: raio.g,
  },
});
