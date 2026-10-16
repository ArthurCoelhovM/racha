// Edge Function: recebe o link do QR code da NFC-e, consulta o site da Sefaz e devolve os itens.
// Publicar: npx supabase functions deploy ler-nfce
import { lerNfce, validarUrlNfce } from '../_shared/nfce.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const hostsExtras = (Deno.env.get('NFCE_HOSTS_EXTRAS') ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// alguns estados ainda respondem em ISO-8859-1
function decodificar(bytes: ArrayBuffer, tipo: string | null): string {
  let charset = /charset=([\w-]+)/i.exec(tipo ?? '')?.[1];
  if (!charset) {
    const inicio = new TextDecoder('latin1').decode(bytes.slice(0, 4096));
    charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(inicio)?.[1];
  }
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

// segue redirecionamentos só enquanto eles continuarem em sites permitidos
async function buscar(url: string, sinal: AbortSignal): Promise<Response> {
  let atual = url;
  for (let i = 0; i < 4; i++) {
    const r = await fetch(atual, {
      redirect: 'manual',
      signal: sinal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    if (r.status < 300 || r.status >= 400) return r;
    const destino = r.headers.get('location');
    const proximo = destino ? new URL(destino, atual).toString() : null;
    const valido = proximo ? new URL(proximo) : null;
    if (!valido || !(valido.hostname.endsWith('.gov.br') || hostsExtras.includes(valido.hostname))) {
      throw new Error('redirecionamento-bloqueado');
    }
    atual = proximo!;
  }
  throw new Error('redirecionamentos-demais');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return resposta({ erro: 'Use POST.' }, 405);

  let corpo: { url?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return resposta({ erro: 'Envie o link da nota.' }, 400);
  }

  const url = validarUrlNfce(String(corpo?.url ?? ''), hostsExtras);
  if (!url) return resposta({ erro: 'Esse QR code não parece ser de uma NFC-e.' }, 400);

  const controle = new AbortController();
  const tempo = setTimeout(() => controle.abort(), 20000);
  try {
    const r = await buscar(url, controle.signal);
    if (!r.ok) {
      return resposta(
        { erro: `O site da Sefaz respondeu com erro (${r.status}). Tente de novo em alguns minutos.` },
        502,
      );
    }
    const nota = lerNfce(decodificar(await r.arrayBuffer(), r.headers.get('content-type')));
    if (nota.itens.length === 0) {
      return resposta(
        {
          erro: 'Não encontrei os itens dessa nota. O site deste estado pode usar outro formato; dá para digitar os itens.',
        },
        422,
      );
    }
    return resposta(nota);
  } catch (e) {
    const demorou = e instanceof DOMException && e.name === 'AbortError';
    return resposta(
      { erro: demorou ? 'O site da Sefaz demorou demais. Tente de novo.' : 'Não deu para consultar a nota agora.' },
      502,
    );
  } finally {
    clearTimeout(tempo);
  }
});
