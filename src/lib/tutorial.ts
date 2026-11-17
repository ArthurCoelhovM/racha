// Dicas do tutorial: cada uma aparece uma vez por aparelho
const PREFIXO = 'so3021-dica-';
const PASSOS = 'so3021-passos-pulados';

function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    // sem armazenamento, a dica volta na próxima vez
  }
}

export const jaViu = (id: string) => ler(PREFIXO + id) === '1';
export const marcarVisto = (id: string) => gravar(PREFIXO + id, '1');

export const pulouPrimeirosPassos = () => ler(PASSOS) === '1';
export const pularPrimeirosPassos = () => gravar(PASSOS, '1');

export const DICAS = ['grupo-abatimento', 'gasto-mudar', 'dividas-paguei', 'resumo-mes', 'conferir'] as const;

// "Ver as dicas de novo", em Sua conta
export function reverTutorial() {
  for (const id of DICAS) gravar(PREFIXO + id, null);
  gravar(PASSOS, null);
}
