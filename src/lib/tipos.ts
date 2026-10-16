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
  email: string | null;
};

export type Grupo = {
  id: string;
  nome: string;
  cor: string;
  abatimento: boolean;
  divisoes_permitidas: TipoDivisao[];
  lembrete_dias: number;
  codigo_convite: string;
  criado_por: string;
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
  papel: 'dono' | 'membro';
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
  pagadores: { usuario_id: string; valor: string }[];
  divisoes: { usuario_id: string; parametro: string | null; valor: string }[];
};

export type Divida = {
  id: string;
  gasto_id: string;
  devedor: string;
  credor: string;
  valor: string;
};

export type Pagamento = {
  id: string;
  de: string;
  para: string;
  valor: string;
  valor_cobrado: string;
  gasto_id: string | null;
  marcado_por: string;
  criado_em: string;
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
