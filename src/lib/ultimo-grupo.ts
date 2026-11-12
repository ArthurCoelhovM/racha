// último grupo em que a pessoa registrou um gasto: o "+ Gasto" da tela inicial já começa nele
const CHAVE = 'so3021-ultimo-grupo';

export function lembrarGrupo(id: string) {
  try {
    localStorage.setItem(CHAVE, id);
  } catch {
    // sem armazenamento, começa no primeiro grupo da lista
  }
}

export function ultimoGrupo(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}
