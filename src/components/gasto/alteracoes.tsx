import { View } from 'react-native';

import { Cartao, Separador, Texto } from '@/components/ui';
import { espaco } from '@/constants/tema';
import { reais } from '@/lib/dinheiro';
import { momento } from '@/lib/formatos';
import { mudancasDoGasto } from '@/lib/historico';
import type { RegistroHistorico } from '@/lib/tipos';

import { Secao } from './partes';

type Registro = Record<string, unknown>;

function titulo(r: RegistroHistorico, nome: (u: string) => string): string {
  const quem = r.usuario_id ? nome(r.usuario_id) : 'Alguém';
  const depois = (r.depois ?? {}) as Registro;
  const antes = (r.antes ?? {}) as Registro;
  if (r.entidade === 'pagamentos') {
    const dados = r.acao === 'insert' ? depois : antes;
    const texto = `${nome(String(dados.de))} pagou ${reais(String(dados.valor_cobrado ?? dados.valor))} a ${nome(String(dados.para))}`;
    return r.acao === 'insert' ? `${quem} marcou: ${texto}` : `${quem} desfez: ${texto}`;
  }
  if (r.acao === 'insert') return `${quem} registrou o gasto de ${reais(String(depois.valor_total))}`;
  if (r.acao === 'delete') return `${quem} excluiu o gasto`;
  return `${quem} editou o gasto`;
}

// Tudo o que aconteceu com o gasto, do mais antigo ao mais novo; continua aqui depois de pago.
export function Alteracoes({ registros, nome }: { registros: RegistroHistorico[]; nome: (u: string) => string }) {
  if (registros.length === 0) return null;
  return (
    <Secao titulo="Alterações">
      <Cartao style={{ padding: 0, gap: 0 }}>
        {registros.map((r, i) => {
          const mudancas =
            r.entidade === 'gastos' && r.acao === 'update'
              ? mudancasDoGasto((r.antes ?? {}) as Registro, (r.depois ?? {}) as Registro, nome)
              : [];
          return (
            <View key={r.id}>
              {i > 0 ? <Separador /> : null}
              <View style={{ padding: espaco.g, gap: 4 }}>
                <Texto variante="forte">{titulo(r, nome)}</Texto>
                {mudancas.map((m) => (
                  <Texto key={m}>• {m}</Texto>
                ))}
                {r.entidade === 'gastos' && r.acao === 'update' && mudancas.length === 0 ? (
                  <Texto variante="suave">Salvo sem mudar valores.</Texto>
                ) : null}
                <Texto variante="suave">{momento(r.criado_em)}</Texto>
              </View>
            </View>
          );
        })}
      </Cartao>
    </Secao>
  );
}
