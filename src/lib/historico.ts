import { reais } from './dinheiro';
import type { RegistroHistorico } from './tipos';

export function descreverHistorico(r: RegistroHistorico, nome: (u: string) => string): string {
  const quem = r.usuario_id ? nome(r.usuario_id) : 'Alguém';
  const depois = (r.depois ?? {}) as Record<string, unknown>;
  const antes = (r.antes ?? {}) as Record<string, unknown>;
  switch (r.entidade) {
    case 'gastos':
      if (r.acao === 'insert') return `${quem} registrou "${depois.descricao}" de ${reais(String(depois.valor_total))}`;
      if (r.acao === 'update') return `${quem} editou "${depois.descricao}"`;
      return `${quem} excluiu "${antes.descricao}" de ${reais(String(antes.valor_total))}`;
    case 'pagamentos': {
      const dados = r.acao === 'insert' ? depois : antes;
      const texto = `${nome(String(dados.de))} pagou ${reais(String(dados.valor_cobrado))} a ${nome(String(dados.para))}`;
      return r.acao === 'insert' ? `${quem} marcou: ${texto}` : `${quem} desfez: ${texto}`;
    }
    case 'membros': {
      const pessoa = nome(String(depois.usuario_id));
      if (r.acao === 'insert') return `${pessoa} entrou no grupo`;
      if (antes.ativo !== depois.ativo) return depois.ativo ? `${pessoa} voltou ao grupo` : `${pessoa} saiu do grupo`;
      if (depois.papel === 'dono') return `${pessoa} passou a ser dono do grupo`;
      return `${pessoa} deixou de ser dono do grupo`;
    }
    case 'grupos':
      if (antes.abatimento !== depois.abatimento) {
        return `${quem} ${depois.abatimento ? 'ligou' : 'desligou'} o abatimento`;
      }
      if (antes.codigo_convite !== depois.codigo_convite) return `${quem} gerou um novo código de convite`;
      if (antes.nome !== depois.nome) return `${quem} mudou o nome do grupo para "${depois.nome}"`;
      return `${quem} mudou as configurações do grupo`;
    default:
      return `${quem} fez uma alteração`;
  }
}
