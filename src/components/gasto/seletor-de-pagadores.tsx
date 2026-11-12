import { CampoDinheiro, Cartao, Ficha, Fichas, Texto } from '@/components/ui';
import { useTema } from '@/hooks/use-tema';
import type { Membro } from '@/lib/tipos';

import { estilosGasto, LinhaPessoa, Secao } from './partes';

export function SeletorDePagadores({
  membros,
  nome,
  varios,
  pagadorUnico,
  valoresPagos,
  erro,
  aoEscolherUm,
  aoAlternarVarios,
  aoMudarValor,
}: {
  membros: Membro[];
  nome: (u: string) => string;
  varios: boolean;
  pagadorUnico: string;
  valoresPagos: Record<string, string>;
  erro: string | null;
  aoEscolherUm: (u: string) => void;
  aoAlternarVarios: () => void;
  aoMudarValor: (u: string, texto: string) => void;
}) {
  const tema = useTema();
  return (
    <Secao titulo="Quem pagou">
      <Fichas>
        {membros.map((m) => (
          <Ficha
            key={m.usuario_id}
            rotulo={nome(m.usuario_id)}
            selecionada={!varios && pagadorUnico === m.usuario_id}
            aoPressionar={() => aoEscolherUm(m.usuario_id)}
          />
        ))}
        <Ficha rotulo="Mais de um" selecionada={varios} aoPressionar={aoAlternarVarios} />
      </Fichas>
      {varios ? (
        <Cartao>
          {membros.map((m) => (
            <LinhaPessoa key={m.usuario_id} id={m.usuario_id} nome={nome(m.usuario_id)}>
              <CampoDinheiro
                value={valoresPagos[m.usuario_id] ?? ''}
                onChangeText={(t) => aoMudarValor(m.usuario_id, t)}
                accessibilityLabel={`Quanto ${nome(m.usuario_id)} pagou`}
                style={estilosGasto.campoPequeno}
              />
            </LinhaPessoa>
          ))}
          <Texto variante="suave" cor={erro ? tema.negativo : tema.positivo}>
            {erro ?? 'Os pagamentos fecham o total.'}
          </Texto>
        </Cartao>
      ) : null}
    </Secao>
  );
}
