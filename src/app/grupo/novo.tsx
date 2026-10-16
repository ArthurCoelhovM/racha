import { router } from 'expo-router';

import { FormularioGrupo } from '@/components/formulario-grupo';
import { Tela } from '@/components/ui';
import { criarGrupo } from '@/lib/api';

export default function NovoGrupo() {
  return (
    <Tela>
      <FormularioGrupo
        tituloBotao="Criar grupo"
        aoSalvar={async (g) => {
          const id = await criarGrupo(g);
          router.replace({ pathname: '/grupo/[id]/convite', params: { id, novo: '1' } });
        }}
      />
    </Tela>
  );
}
