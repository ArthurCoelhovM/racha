import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Marca } from '@/components/marca';
import { Aviso, Botao, Campo, Tela, Texto } from '@/components/ui';
import { traduzirErroAuth } from '@/lib/erros-auth';
import { supabase } from '@/lib/supabase';

export default function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    if (!email.trim() || !senha) {
      setErro('Preencha o e-mail e a senha.');
      return;
    }
    setCarregando(true);
    setErro(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setCarregando(false);
    if (error) setErro(traduzirErroAuth(error));
  }

  return (
    <Tela>
      <View style={{ gap: 10, paddingTop: 56, paddingBottom: 8 }}>
        <Marca />
        <Texto variante="suave">
          Divida contas, compras e gastos com seu grupo. Dívidas só se abatem entre duas pessoas.
        </Texto>
      </View>

      <Campo
        rotulo="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="voce@email.com"
      />
      <Campo
        rotulo="Senha"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoComplete="current-password"
        onSubmitEditing={entrar}
      />

      {erro ? <Aviso texto={erro} /> : null}

      <Botao titulo="Entrar" aoPressionar={entrar} carregando={carregando} />
      <Botao titulo="Criar conta" variante="secundario" aoPressionar={() => router.push('/cadastro')} />
      <Botao titulo="Esqueci minha senha" variante="texto" aoPressionar={() => router.push('/recuperar')} />
    </Tela>
  );
}
