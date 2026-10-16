import { router } from 'expo-router';
import { useState } from 'react';

import { Aviso, Botao, Campo, Tela } from '@/components/ui';
import { traduzirErroAuth } from '@/lib/erros-auth';
import { supabase } from '@/lib/supabase';

export default function NovaSenha() {
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function salvar() {
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.');
    if (senha !== repetir) return setErro('As duas senhas não são iguais.');
    setCarregando(true);
    setErro(null);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setCarregando(false);
    if (error) return setErro(traduzirErroAuth(error));
    setPronto(true);
  }

  return (
    <Tela>
      <Campo rotulo="Nova senha" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="new-password" />
      <Campo
        rotulo="Repita a senha"
        value={repetir}
        onChangeText={setRepetir}
        secureTextEntry
        autoComplete="new-password"
        onSubmitEditing={salvar}
      />
      {erro ? <Aviso texto={erro} /> : null}
      {pronto ? (
        <>
          <Aviso tipo="ok" texto="Senha trocada." />
          <Botao titulo="Ir para os grupos" aoPressionar={() => router.replace('/')} />
        </>
      ) : (
        <Botao titulo="Salvar senha" aoPressionar={salvar} carregando={carregando} />
      )}
    </Tela>
  );
}
