export const paleta = {
  claro: {
    fundo: '#F6F7FB',
    superficie: '#FFFFFF',
    superficie2: '#EEF0F6',
    texto: '#17182B',
    textoSuave: '#5F627A',
    borda: '#E2E4EE',
    primaria: '#5B4CF0',
    sobrePrimaria: '#FFFFFF',
    positivo: '#12924B',
    negativo: '#D92657',
    aviso: '#B07800',
    fundoPositivo: '#E3F5EA',
    fundoNegativo: '#FCE6EC',
  },
  escuro: {
    fundo: '#0F1017',
    superficie: '#191A25',
    superficie2: '#232535',
    texto: '#ECEDF6',
    textoSuave: '#9EA1BA',
    borda: '#2A2D40',
    primaria: '#8B7FFF',
    sobrePrimaria: '#0F1017',
    positivo: '#3FC77F',
    negativo: '#FF6A90',
    aviso: '#F2B937',
    fundoPositivo: '#16301F',
    fundoNegativo: '#3A1824',
  },
};

export type Cores = typeof paleta.claro;

export const coresGrupo = ['#5B4CF0', '#E8680A', '#12924B', '#D92657', '#07879E', '#C78800', '#4D4DCF', '#7A3EC8'];

export function corDaPessoa(id: string): string {
  let soma = 0;
  for (let i = 0; i < id.length; i++) soma = (soma * 31 + id.charCodeAt(i)) >>> 0;
  return coresGrupo[soma % coresGrupo.length];
}

export const espaco = { p: 4, m: 8, g: 16, xg: 24, xxg: 32 };
export const raio = { p: 8, m: 12, g: 16, total: 999 };
export const larguraMaxima = 640;
