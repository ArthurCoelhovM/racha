import { Tabs } from 'expo-router/js-tabs';

import { BarraDeBaixo } from '@/components/navegacao/barra-de-baixo';
import { fontes } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';

// Início, Gastos, +, Avisos e Conta ficam na barra de baixo, ao alcance do polegar
export default function LayoutAbas() {
  const tema = useTema();
  return (
    <Tabs
      tabBar={(props) => <BarraDeBaixo {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: tema.fundo },
        headerTintColor: tema.texto,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fontes.tituloMedio, fontSize: 19 },
        sceneStyle: { backgroundColor: tema.fundo },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Seus grupos' }} />
      <Tabs.Screen name="gastos" options={{ title: 'Gastos' }} />
      <Tabs.Screen name="avisos" options={{ title: 'Avisos' }} />
      <Tabs.Screen name="conta" options={{ title: 'Sua conta' }} />
    </Tabs>
  );
}
