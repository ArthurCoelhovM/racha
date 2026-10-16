import { router } from 'expo-router';
import { useState } from 'react';

import { Aviso, Botao, Campo, Tela, Texto } from '@/components/ui';
import { useTema } from '@/hooks/use-tema';
import { traduzirErroAuth } from '@/lib/erros-auth';
import { supabase, urlDoSite } from '@/lib/supabase';

export default function Cadastro() {
  const tema = useTema();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function cadastrar() {
    if (!nome.trim()) return setErro('Diga como o grupo vai te chamar.');
    if (!email.trim()) return setErro('Preencha o e-mail.');
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.');

    setCarregando(true);
    setErro(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: { nome: nome.trim() }, emailRedirectTo: urlDoSite('/') },
    });
    setCarregando(false);
    if (error) return setErro(traduzirErroAuth(error));
    if (!data.session) setEnviado(true);
  }

  if (enviado) {
    return (
      <Tela>
        <Aviso tipo="ok" texto={`Enviamos um link de confirmação para ${email.trim()}.`} />
        <Texto>Abra o e-mail, toque no link e depois volte aqui para entrar.</Texto>
        <Botao titulo="Ir para o login" aoPressionar={() => router.replace('/entrar')} />
      </Tela>
    );
  }

  return (
    <Tela>
      <Campo
        rotulo="Seu nome"
        value={nome}
        onChangeText={setNome}
        autoComplete="name"
        placeholder="Como o grupo te chama"
      />
      <Campo
        rotulo="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Campo
        rotulo="Senha"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoComplete="new-password"
        dica="Pelo menos 6 caracteres"
        onSubmitEditing={cadastrar}
      />
      {erro ? <Aviso texto={erro} /> : null}
      <Botao titulo="Criar conta" aoPressionar={cadastrar} carregando={carregando} />
      <Texto variante="suave" style={{ textAlign: 'center' }}>
        Ao criar a conta você concorda com a{' '}
        <Texto
          variante="suave"
          cor={tema.primaria}
          style={{ fontWeight: '700' }}
          aoPressionar={() => router.push('/privacidade')}>
          política de privacidade
        </Texto>
        .
      </Texto>
    </Tela>
  );
}
