import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Ficha, Icone, Linha, Texto, type NomeIcone } from '@/components/ui';
import { raio } from '@/constants/tema';
import { useTema } from '@/hooks/use-tema';
import { temFiltro, type Filtros } from '@/lib/api';
import { CATEGORIAS, type Membro } from '@/lib/tipos';

const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function ultimosMeses(quantos: number): { valor: string; nome: string }[] {
  const hoje = new Date();
  return Array.from({ length: quantos }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const nome =
      i === 0
        ? 'Este mês'
        : `${NOMES_MES[d.getMonth()]}${d.getFullYear() !== hoje.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
    return { valor, nome };
  });
}

export const SEM_FILTRO: Filtros = { texto: '', pessoa: null, mes: null, categoria: null };

// busca por texto (também nos itens do cupom) e filtros por pessoa, mês e categoria
export function FiltrosDeGastos({
  filtros,
  membros,
  nome,
  aoMudar,
}: {
  filtros: Filtros;
  membros: Membro[];
  nome: (u: string) => string;
  aoMudar: (f: Filtros) => void;
}) {
  const tema = useTema();
  const [aberto, setAberto] = useState(!!(filtros.pessoa || filtros.mes || filtros.categoria));
  const mudar = (m: Partial<Filtros>) => aoMudar({ ...filtros, ...m });

  return (
    <View style={{ gap: 8 }}>
      <Linha style={[estilos.busca, { backgroundColor: tema.superficie, borderColor: tema.borda }]}>
        <Icone nome="search" tamanho={18} cor={tema.textoSuave} />
        <TextInput
          value={filtros.texto}
          onChangeText={(t) => mudar({ texto: t })}
          placeholder="Buscar gasto ou item"
          placeholderTextColor={tema.textoSuave}
          accessibilityLabel="Buscar gastos"
          style={[estilos.entrada, { color: tema.texto }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filtros"
          accessibilityState={{ expanded: aberto }}
          onPress={() => setAberto(!aberto)}
          hitSlop={8}>
          <Icone nome={aberto ? 'options' : 'options-outline'} tamanho={20} cor={tema.primaria} />
        </Pressable>
      </Linha>

      {aberto ? (
        <View style={{ gap: 8 }}>
          <Faixa titulo="Pessoa">
            <Ficha rotulo="Todos" selecionada={!filtros.pessoa} aoPressionar={() => mudar({ pessoa: null })} />
            {membros.map((m) => (
              <Ficha
                key={m.usuario_id}
                rotulo={nome(m.usuario_id)}
                selecionada={filtros.pessoa === m.usuario_id}
                aoPressionar={() => mudar({ pessoa: m.usuario_id })}
              />
            ))}
          </Faixa>
          <Faixa titulo="Mês">
            <Ficha rotulo="Todos" selecionada={!filtros.mes} aoPressionar={() => mudar({ mes: null })} />
            {ultimosMeses(12).map((m) => (
              <Ficha
                key={m.valor}
                rotulo={m.nome}
                selecionada={filtros.mes === m.valor}
                aoPressionar={() => mudar({ mes: m.valor })}
              />
            ))}
          </Faixa>
          <Faixa titulo="Categoria">
            <Ficha rotulo="Todas" selecionada={!filtros.categoria} aoPressionar={() => mudar({ categoria: null })} />
            {CATEGORIAS.map((c) => (
              <Pressable
                key={c.categoria}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: filtros.categoria === c.categoria }}
                onPress={() => mudar({ categoria: c.categoria })}
                style={[
                  estilos.categoria,
                  {
                    borderColor: filtros.categoria === c.categoria ? c.cor : tema.borda,
                    backgroundColor: filtros.categoria === c.categoria ? c.cor : tema.superficie,
                  },
                ]}>
                <Icone
                  nome={c.icone as NomeIcone}
                  tamanho={16}
                  cor={filtros.categoria === c.categoria ? '#FFFFFF' : c.cor}
                />
                <Texto
                  variante="suave"
                  cor={filtros.categoria === c.categoria ? '#FFFFFF' : tema.texto}
                  style={{ fontWeight: '600' }}>
                  {c.nome}
                </Texto>
              </Pressable>
            ))}
          </Faixa>
        </View>
      ) : null}
      {temFiltro(filtros) ? (
        <Texto variante="suave" aoPressionar={() => aoMudar(SEM_FILTRO)} cor={tema.primaria}>
          Limpar busca e filtros
        </Texto>
      ) : null}
    </View>
  );
}

function Faixa({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <Texto variante="rotulo">{titulo}</Texto>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {children}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  busca: { borderWidth: 1, borderRadius: raio.m, paddingHorizontal: 12, minHeight: 44 },
  entrada: { flex: 1, fontSize: 15, paddingVertical: 8, outlineStyle: 'none' } as object,
  categoria: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: raio.total,
    borderWidth: 1.5,
  },
});
