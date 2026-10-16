import { useState } from 'react';

import { Aviso, Botao, Campo, Tela, Texto } from '@/components/ui';
import { traduzirErroAuth } from '@/lib/erros-auth';
import { supabase, urlDoSite } from '@/lib/supabase';

export default function Recuperar() {
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function enviar() {
    if (!email.trim()) return setErro('Preencha o e-mail da sua conta.');
    setCarregando(true);
    setErro(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: urlDoSite('/nova-senha'),
    });
    setCarregando(false);
    if (error) return setErro(traduzirErroAuth(error));
    setEnviado(true);
  }

  return (
    <Tela>
      <Texto>Mandamos um link para você criar uma senha nova.</Texto>
      <Campo
        rotulo="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        onSubmitEditing={enviar}
      />
      {erro ? <Aviso texto={erro} /> : null}
      {enviado ? <Aviso tipo="ok" texto="Pronto. Confira sua caixa de entrada (e o spam)." /> : null}
      <Botao titulo="Enviar link" aoPressionar={enviar} carregando={carregando} />
    </Tela>
  );
}
