import { View } from 'react-native';

import { Cartao, Separador, Texto } from '@/components/ui';
import { espaco } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { ehExato, reais } from '@/lib/dinheiro';
import type { Parte } from '@/lib/divisao';

import { LinhaPessoa, Secao } from './partes';

export function ComoFica({ partes, erro, nome }: { partes: Parte[]; erro: string | null; nome: (u: string) => string }) {
  const tema = useTema();
  return (
    <Secao titulo="Como fica">
      <Cartao>
        {partes.length === 0 ? (
          <Texto variante="suave">Preencha o valor e escolha quem divide.</Texto>
        ) : (
          partes.map((p, i) => (
            <View key={p.usuario_id} style={{ gap: espaco.m }}>
              {i > 0 ? <Separador /> : null}
              <LinhaPessoa id={p.usuario_id} nome={nome(p.usuario_id)}>
                <Texto variante="forte">
                  {ehExato(p.valor) ? '' : '≈ '}
                  {reais(p.valor)}
                </Texto>
              </LinhaPessoa>
            </View>
          ))
        )}
        {erro ? (
          <Texto variante="suave" cor={tema.negativo}>
            {erro}
          </Texto>
        ) : null}
      </Cartao>
      <Texto variante="suave">
        As contas guardam os centavos exatos. Na hora de cobrar, o valor é arredondado para cima.
      </Texto>
    </Secao>
  );
}
