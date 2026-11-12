export type TipoDivisao = 'igual' | 'exato' | 'porcentagem' | 'cotas' | 'itens';

export const TIPOS_DIVISAO: { tipo: TipoDivisao; nome: string; dica: string }[] = [
  { tipo: 'igual', nome: 'Igual', dica: 'Todo mundo paga o mesmo' },
  { tipo: 'exato', nome: 'Valor exato', dica: 'Você diz quanto cada um paga' },
  { tipo: 'porcentagem', nome: 'Porcentagem', dica: 'Cada um paga uma % do total' },
  { tipo: 'cotas', nome: 'Cotas', dica: 'Pesos: 2 cotas pagam o dobro de 1' },
  { tipo: 'itens', nome: 'Por item', dica: 'Cada item da compra tem seus participantes' },
];

export type Perfil = {
  id: string;
  nome: string;
};

export type Papel = 'dono' | 'admin' | 'membro';

export type Acao =
  | 'registrar_gastos'
  | 'editar_gastos_de_outros'
  | 'mudar_configuracoes'
  | 'convidar_membros'
  | 'remover_membros';

export type Permissoes = Record<Acao, Papel>;

export type Grupo = {
  id: string;
  nome: string;
  cor: string;
  abatimento: boolean;
  divisoes_permitidas: TipoDivisao[];
  lembrete_dias: number;
  criado_por: string;
  permissoes: Permissoes;
};

export type ResumoGrupo = {
  grupo_id: string;
  nome: string;
  cor: string;
  abatimento: boolean;
  total_membros: number;
  voce_deve: number;
  te_devem: number;
};

export type Membro = {
  usuario_id: string;
  papel: Papel;
  ativo: boolean;
  perfil: Perfil;
};

export type Item = {
  descricao: string;
  valor: string;
  participantes: string[];
};

export type Gasto = {
  id: string;
  grupo_id: string;
  descricao: string;
  valor_total: string;
  data: string;
  tipo_divisao: TipoDivisao;
  itens: Item[] | null;
  criado_por: string;
  criado_em: string;
  recorrente_id: string | null;
  pagadores: { usuario_id: string; valor: string }[];
  divisoes: { usuario_id: string; parametro: string | null; valor: string }[];
  dividas: { devedor: string; credor: string }[];
};

// o que está em aberto num grupo que a pessoa deixou
export type PendenciaFora = {
  grupo_id: string;
  grupo_nome: string;
  grupo_cor: string;
  devedor: string;
  credor: string;
  outra_pessoa: string;
  gasto_id: string | null;
  descricao: string | null;
  data: string | null;
  valor: string;
};

export type RegistroHistorico = {
  id: number;
  usuario_id: string | null;
  entidade: string;
  acao: string;
  registro_id: string | null;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  criado_em: string;
};

export type Aviso = {
  id: number;
  grupo_id: string | null;
  tipo:
    | 'gasto_novo'
    | 'gasto_editado'
    | 'gasto_excluido'
    | 'pagamento'
    | 'membro'
    | 'grupo'
    | 'lembrete'
    | 'recorrente_parado'
    | 'cobranca';
  titulo: string;
  corpo: string;
  dados: Record<string, unknown> | null;
  lido: boolean;
  criado_em: string;
};

export type Frequencia = 'mensal' | 'semanal';

export type Recorrente = {
  id: string;
  descricao: string;
  valor_total: string;
  frequencia: Frequencia;
  proxima_data: string;
  ativo: boolean;
};
