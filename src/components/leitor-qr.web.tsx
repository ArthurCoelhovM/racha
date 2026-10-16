import jsQR from 'jsqr';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { StyleSheet, View } from 'react-native';

import { Botao, Texto } from '@/components/ui';
import { raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';

// lê o QR de uma imagem (quadro do vídeo ou foto), reduzindo para no máximo `lado` pixels
function decodificar(fonte: CanvasImageSource, largura: number, altura: number, lado: number): string | null {
  const escala = Math.min(1, lado / Math.max(largura, altura));
  const w = Math.max(1, Math.round(largura * escala));
  const h = Math.max(1, Math.round(altura * escala));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(fonte, 0, 0, w, h);
  const imagem = ctx.getImageData(0, 0, w, h);
  return jsQR(imagem.data, w, h, { inversionAttempts: 'attemptBoth' })?.data ?? null;
}

// No navegador (iPhone): câmera pelo getUserMedia e decodificação com jsQR.
// Também aceita uma foto do QR code, que funciona mesmo sem permissão de câmera.
export function LeitorQr({ aoLer }: { aoLer: (texto: string) => void }) {
  const tema = useTema();
  const video = useRef<HTMLVideoElement | null>(null);
  const arquivo = useRef<HTMLInputElement | null>(null);
  const ultimo = useRef<{ texto: string; quando: number } | null>(null);
  const aoLerRef = useRef(aoLer);
  const [situacao, setSituacao] = useState<'abrindo' | 'lendo' | 'sem-camera'>('abrindo');
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  useEffect(() => {
    aoLerRef.current = aoLer;
  });

  function entregar(texto: string) {
    const agora = Date.now();
    if (ultimo.current && ultimo.current.texto === texto && agora - ultimo.current.quando < 3000) return;
    ultimo.current = { texto, quando: agora };
    aoLerRef.current(texto);
  }

  useEffect(() => {
    let ativo = true;
    let fluxo: MediaStream | null = null;
    let temporizador: ReturnType<typeof setTimeout> | null = null;

    async function abrir() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setSituacao('sem-camera');
        return;
      }
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (!ativo || !video.current) return;
        video.current.srcObject = fluxo;
        await video.current.play();
        setSituacao('lendo');
        const ler = () => {
          if (!ativo) return;
          const v = video.current;
          if (v && v.readyState >= 2 && v.videoWidth > 0) {
            const texto = decodificar(v, v.videoWidth, v.videoHeight, 720);
            if (texto) entregar(texto);
          }
          temporizador = setTimeout(ler, 180);
        };
        ler();
      } catch {
        if (ativo) setSituacao('sem-camera');
      }
    }

    abrir();
    return () => {
      ativo = false;
      if (temporizador) clearTimeout(temporizador);
      fluxo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function lerFoto(evento: ChangeEvent<HTMLInputElement>) {
    const foto = evento.target.files?.[0];
    evento.target.value = '';
    if (!foto) return;
    setErroFoto(null);
    try {
      const imagem = await createImageBitmap(foto);
      const texto =
        decodificar(imagem, imagem.width, imagem.height, 1600) ?? decodificar(imagem, imagem.width, imagem.height, 800);
      if (texto) entregar(texto);
      else setErroFoto('Não achei um QR code nessa foto. Tente uma mais de perto, com o QR inteiro e sem reflexo.');
    } catch {
      setErroFoto('Não deu para abrir essa foto.');
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={[estilos.quadro, { backgroundColor: situacao === 'sem-camera' ? tema.superficie2 : '#000' }]}>
        <video
          ref={video}
          muted
          playsInline
          autoPlay
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: situacao === 'sem-camera' ? 'none' : 'block',
          }}
        />
        {situacao === 'lendo' ? <View pointerEvents="none" style={estilos.mira} /> : null}
        {situacao === 'sem-camera' ? (
          <View style={estilos.centro}>
            <Texto style={{ textAlign: 'center' }}>
              Não deu para abrir a câmera aqui. Tire uma foto do QR code e escolha abaixo, ou cole o link da nota.
            </Texto>
          </View>
        ) : null}
      </View>
      <input
        ref={arquivo}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Foto do QR code"
        onChange={lerFoto}
        style={{ display: 'none' }}
      />
      <Botao titulo="Usar uma foto do QR code" variante="secundario" aoPressionar={() => arquivo.current?.click()} />
      {erroFoto ? (
        <Texto variante="suave" cor={tema.negativo}>
          {erroFoto}
        </Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  quadro: { height: 320, borderRadius: raio.g, overflow: 'hidden' },
  centro: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  mira: {
    position: 'absolute',
    top: '15%',
    left: '20%',
    right: '20%',
    bottom: '15%',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: raio.g,
  },
});
