import { StyleSheet, View } from 'react-native';

import { Cartao, Separador, Texto, Vazio } from '@/components/ui';
import { espaco } from '@/constants/tema';
import { momento } from '@/lib/formatos';
import { descreverHistorico } from '@/lib/historico';
import type { RegistroHistorico } from '@/lib/tipos';

export function Historico({ registros, nome }: { registros: RegistroHistorico[]; nome: (u: string) => string }) {
  if (registros.length === 0) return <Vazio titulo="Nada por aqui ainda" />;
  return (
    <Cartao style={{ padding: 0, gap: 0 }}>
      {registros.map((r, i) => (
        <View key={r.id}>
          {i > 0 ? <Separador /> : null}
          <View style={estilos.linha}>
            <Texto>{descreverHistorico(r, nome)}</Texto>
            <Texto variante="suave">{momento(r.criado_em)}</Texto>
          </View>
        </View>
      ))}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  linha: { padding: espaco.g, gap: 2 },
});
