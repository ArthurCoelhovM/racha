// Edge Function: recebe o link do QR code da NFC-e, consulta o site da Sefaz e devolve os itens.
// Publicar: npx supabase functions deploy ler-nfce
import { cors, resposta } from '../_shared/cors.ts';
import { lerNfce, validarUrlNfce } from '../_shared/nfce.ts';

const hostsExtras = (Deno.env.get('NFCE_HOSTS_EXTRAS') ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);
const urlSupabase = Deno.env.get('SUPABASE_URL') ?? '';
const chaveAnon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

// páginas de NFC-e têm poucas dezenas de KB; acima disso é erro ou abuso
const LIMITE_BYTES = 2 * 1024 * 1024;

// cada pessoa pode ler até 10 cupons a cada 10 minutos (conferido no banco, com o login de quem chamou)
async function conferirLimite(req: Request): Promise<{ erro: string; status: number } | null> {
  const chave = chaveAnon || req.headers.get('apikey') || '';
  if (!urlSupabase || !chave) return null;
  const autorizacao = req.headers.get('Authorization');
  if (!autorizacao) return { erro: 'Faça login para ler o cupom.', status: 401 };
  const r = await fetch(`${urlSupabase}/rest/v1/rpc/registrar_leitura_nfce`, {
    method: 'POST',
    headers: { apikey: chave, Authorization: autorizacao, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (r.ok) return null;
  const corpo = await r.json().catch(() => null);
  const mensagem = typeof corpo?.message === 'string' ? corpo.message : '';
  if (mensagem.startsWith('Muitas leituras')) return { erro: mensagem, status: 429 };
  return { erro: 'Faça login para ler o cupom.', status: 401 };
}

async function lerCorpo(r: Response): Promise<ArrayBuffer> {
  if (Number(r.headers.get('content-length') ?? 0) > LIMITE_BYTES) throw new Error('grande-demais');
  const leitor = r.body?.getReader();
  if (!leitor) return new ArrayBuffer(0);
  const partes: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > LIMITE_BYTES) {
      await leitor.cancel();
      throw new Error('grande-demais');
    }
    partes.push(value);
  }
  const junto = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) {
    junto.set(parte, posicao);
    posicao += parte.length;
  }
  return junto.buffer;
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

  const bloqueio = await conferirLimite(req);
  if (bloqueio) return resposta({ erro: bloqueio.erro }, bloqueio.status);

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
    const nota = lerNfce(decodificar(await lerCorpo(r), r.headers.get('content-type')));
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
    const grande = e instanceof Error && e.message === 'grande-demais';
    return resposta(
      {
        erro: demorou
          ? 'O site da Sefaz demorou demais. Tente de novo.'
          : grande
            ? 'A página da nota veio grande demais. Dá para digitar os itens.'
            : 'Não deu para consultar a nota agora.',
      },
      502,
    );
  } finally {
    clearTimeout(tempo);
  }
});
