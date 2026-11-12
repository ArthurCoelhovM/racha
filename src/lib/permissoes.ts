import type { Acao, Grupo, Membro, Papel } from './tipos';

export const ACOES: { acao: Acao; nome: string }[] = [
  { acao: 'registrar_gastos', nome: 'Registrar gastos' },
  { acao: 'editar_gastos_de_outros', nome: 'Editar e excluir gastos de outras pessoas' },
  { acao: 'mudar_configuracoes', nome: 'Mudar as configurações do grupo' },
  { acao: 'convidar_membros', nome: 'Convidar pessoas' },
  { acao: 'remover_membros', nome: 'Remover pessoas' },
];

export const NIVEIS: { papel: Papel; nome: string }[] = [
  { papel: 'membro', nome: 'Todos' },
  { papel: 'admin', nome: 'Admins e dono' },
  { papel: 'dono', nome: 'Só o dono' },
];

export const NOME_DO_PAPEL: Record<Papel, string> = { dono: 'Dono', admin: 'Admin', membro: 'Membro' };

const nivel: Record<Papel, number> = { dono: 3, admin: 2, membro: 1 };

// mesma regra da função pode() do banco; aqui serve só para mostrar ou esconder botões
export function meuPapel(membros: Membro[], eu: string): Papel | null {
  return membros.find((m) => m.usuario_id === eu && m.ativo)?.papel ?? null;
}

export function pode(grupo: Grupo, papel: Papel | null, acao: Acao): boolean {
  if (!papel) return false;
  return nivel[papel] >= nivel[grupo.permissoes?.[acao] ?? 'dono'];
}

export function quemPode(grupo: Grupo, acao: Acao): string {
  const minimo = grupo.permissoes?.[acao] ?? 'dono';
  return minimo === 'membro' ? 'todos' : minimo === 'admin' ? 'admins e o dono' : 'só o dono';
}
