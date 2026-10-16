import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Marca } from '@/components/marca';
import { Texto } from '@/components/ui';
import { useEscuro, useTema } from '@/hooks/use-tema';
import { ProvedorSessao, useSessao } from '@/lib/sessao';
import { supabaseConfigurado } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

function Navegacao() {
  const { sessao, carregando } = useSessao();
  const tema = useTema();

  useEffect(() => {
    if (!carregando) SplashScreen.hideAsync();
  }, [carregando]);

  if (carregando) return null;
  const logado = !!sessao;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: tema.fundo },
        headerTintColor: tema.texto,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: 'Voltar',
        contentStyle: { backgroundColor: tema.fundo },
      }}>
      <Stack.Protected guard={!logado}>
        <Stack.Screen name="entrar" options={{ headerShown: false, title: 'Entrar' }} />
        <Stack.Screen name="cadastro" options={{ title: 'Criar conta' }} />
        <Stack.Screen name="recuperar" options={{ title: 'Recuperar senha' }} />
      </Stack.Protected>

      <Stack.Protected guard={logado}>
        <Stack.Screen name="index" options={{ title: 'Seus grupos' }} />
        <Stack.Screen name="conta" options={{ title: 'Sua conta' }} />
        <Stack.Screen name="avisos" options={{ title: 'Avisos' }} />
        <Stack.Screen name="nova-senha" options={{ title: 'Nova senha' }} />
        <Stack.Screen name="entrar-grupo" options={{ title: 'Entrar em um grupo' }} />
        <Stack.Screen name="grupo/novo" options={{ title: 'Novo grupo' }} />
        <Stack.Screen name="grupo/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="grupo/[id]/configuracoes" options={{ title: 'Configurações do grupo' }} />
        <Stack.Screen name="grupo/[id]/convite" options={{ title: 'Convidar pessoas' }} />
        <Stack.Screen name="grupo/[id]/gasto" options={{ title: 'Gasto' }} />
        <Stack.Screen name="grupo/[id]/cupom" options={{ title: 'Ler cupom fiscal' }} />
      </Stack.Protected>

      <Stack.Screen name="convite/[codigo]" options={{ title: 'Convite' }} />
    </Stack>
  );
}

function FaltaConfigurar() {
  const tema = useTema();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: tema.fundo, padding: 24, justifyContent: 'center', gap: 12 }}>
      <Marca tamanho={28} />
      <Texto variante="subtitulo">Falta ligar o Supabase</Texto>
      <Texto>
        Copie o arquivo .env.example para .env, preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        com os dados do seu projeto e reinicie o app.
      </Texto>
    </View>
  );
}

export default function Raiz() {
  const escuro = useEscuro();
  const tema = useTema();
  const base = escuro ? DarkTheme : DefaultTheme;
  const temaNavegacao = {
    ...base,
    colors: {
      ...base.colors,
      primary: tema.primaria,
      background: tema.fundo,
      card: tema.fundo,
      text: tema.texto,
      border: tema.borda,
    },
  };

  return (
    <SafeAreaProvider>
      <ThemeProvider value={temaNavegacao}>
        <StatusBar style={escuro ? 'light' : 'dark'} />
        {supabaseConfigurado ? (
          <ProvedorSessao>
            <Navegacao />
          </ProvedorSessao>
        ) : (
          <FaltaConfigurar />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
