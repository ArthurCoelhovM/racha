// Edge Function: entrega cada aviso novo como notificação push.
// É chamada por um Database Webhook na tabela "avisos" (evento INSERT).
// Publicar: npx supabase functions deploy enviar-push --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

import { cors, resposta } from '../_shared/cors.ts';

const urlSupabase = Deno.env.get('SUPABASE_URL') ?? '';
const chaveServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const segredo = Deno.env.get('PUSH_WEBHOOK_SEGREDO') ?? '';
const urlExpo = Deno.env.get('EXPO_PUSH_URL') ?? 'https://exp.host/--/api/v2/push/send';
const vapidPublica = Deno.env.get('VAPID_CHAVE_PUBLICA') ?? '';
const vapidPrivada = Deno.env.get('VAPID_CHAVE_PRIVADA') ?? '';
const vapidContato = Deno.env.get('VAPID_CONTATO') ?? 'mailto:contato@superorganizador.app';

if (vapidPublica && vapidPrivada) webpush.setVapidDetails(vapidContato, vapidPublica, vapidPrivada);

type Aviso = { id: number; usuario_id: string; grupo_id: string | null; titulo: string; corpo: string };
type Dispositivo = {
  id: string;
  plataforma: 'expo' | 'web';
  identificador: string;
  assinatura: webpush.PushSubscription | null;
};

async function enviarExpo(aparelhos: Dispositivo[], aviso: Aviso, destino: string) {
  const enviados: string[] = [];
  const mortos: string[] = [];
  if (aparelhos.length === 0) return { enviados, mortos };

  const r = await fetch(urlExpo, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(
      aparelhos.map((a) => ({
        to: a.identificador,
        title: aviso.titulo,
        body: aviso.corpo,
        sound: 'default',
        channelId: 'avisos',
        data: { url: destino },
      })),
    ),
  });
  const corpo = await r.json().catch(() => ({}));
  const tickets: { status: string; details?: { error?: string } }[] = corpo?.data ?? [];
  tickets.forEach((t, i) => {
    if (t.status === 'ok') enviados.push(aparelhos[i].id);
    else if (t.details?.error === 'DeviceNotRegistered') mortos.push(aparelhos[i].id);
  });
  return { enviados, mortos };
}

async function enviarWeb(aparelhos: Dispositivo[], aviso: Aviso, destino: string) {
  const enviados: string[] = [];
  const mortos: string[] = [];
  if (aparelhos.length === 0 || !vapidPublica || !vapidPrivada) return { enviados, mortos };

  const conteudo = JSON.stringify({ titulo: aviso.titulo, corpo: aviso.corpo, url: destino });
  await Promise.all(
    aparelhos.map(async (a) => {
      if (!a.assinatura) return;
      try {
        await webpush.sendNotification(a.assinatura, conteudo, { TTL: 60 * 60 * 24 });
        enviados.push(a.id);
      } catch (e) {
        const codigo = (e as { statusCode?: number }).statusCode;
        if (codigo === 404 || codigo === 410) mortos.push(a.id);
      }
    }),
  );
  return { enviados, mortos };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!segredo || req.headers.get('x-segredo') !== segredo) return resposta({ erro: 'Não autorizado.' }, 401);

  // o webhook manda { type, table, record }; aceitamos também o aviso direto
  const corpo = await req.json().catch(() => null);
  const aviso: Aviso | null = corpo?.record ?? corpo;
  if (!aviso?.usuario_id || !aviso.id) return resposta({ erro: 'Aviso inválido.' }, 400);

  const banco = createClient(urlSupabase, chaveServico, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await banco
    .from('dispositivos')
    .select('id, plataforma, identificador, assinatura')
    .eq('usuario_id', aviso.usuario_id);
  if (error) return resposta({ erro: error.message }, 500);

  const aparelhos = (data ?? []) as Dispositivo[];
  const destino = aviso.grupo_id ? `/grupo/${aviso.grupo_id}` : '/avisos';
  const [expo, web] = await Promise.all([
    enviarExpo(
      aparelhos.filter((a) => a.plataforma === 'expo'),
      aviso,
      destino,
    ),
    enviarWeb(
      aparelhos.filter((a) => a.plataforma === 'web'),
      aviso,
      destino,
    ),
  ]);

  const mortos = [...expo.mortos, ...web.mortos];
  if (mortos.length > 0) await banco.from('dispositivos').delete().in('id', mortos);
  await banco.from('avisos').update({ enviado_push: true }).eq('id', aviso.id);

  return resposta({ enviados: expo.enviados.length + web.enviados.length, removidos: mortos.length });
});
