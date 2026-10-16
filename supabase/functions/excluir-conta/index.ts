// Edge Function: exclui a conta de quem chamou.
// Os dados pessoais somem (nome, e-mail, aparelhos, avisos) e o login é apagado;
// os gastos e dívidas continuam no histórico dos grupos, com o nome "Conta excluída".
// Publicar: npx supabase functions deploy excluir-conta
import { createClient } from 'npm:@supabase/supabase-js@2';

import { cors, resposta } from '../_shared/cors.ts';

const urlSupabase = Deno.env.get('SUPABASE_URL') ?? '';
const chaveServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return resposta({ erro: 'Use POST.' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const admin = createClient(urlSupabase, chaveServico, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return resposta({ erro: 'Faça login de novo para excluir a conta.' }, 401);

  const id = data.user.id;
  const anonimizar = await admin.rpc('anonimizar_conta', { p_usuario: id });
  if (anonimizar.error) return resposta({ erro: 'Não deu para apagar os dados agora.' }, 500);

  // exclusão "suave": o registro de login fica, sem e-mail nem senha, para o histórico dos grupos continuar válido
  const apagar = await admin.auth.admin.deleteUser(id, true);
  if (apagar.error) return resposta({ erro: 'Não deu para apagar o login agora.' }, 500);

  return resposta({ ok: true });
});
