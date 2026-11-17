// Gerado por scripts/gerar-tipos.sh a partir das migrações. Não edite à mão.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      avisos: {
        Row: {
          corpo: string;
          criado_em: string;
          dados: Json | null;
          enviado_push: boolean;
          grupo_id: string | null;
          id: number;
          lido: boolean;
          tipo: string;
          titulo: string;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          corpo: string;
          criado_em?: string;
          dados?: Json | null;
          enviado_push?: boolean;
          grupo_id?: string | null;
          id?: never;
          lido?: boolean;
          tipo: string;
          titulo: string;
          usuario_id: string;
        };
        Update: {
          corpo?: string;
          criado_em?: string;
          dados?: Json | null;
          enviado_push?: boolean;
          grupo_id?: string | null;
          id?: never;
          lido?: boolean;
          tipo?: string;
          titulo?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'avisos_grupo_id_fkey';
            columns: ['grupo_id'];
            isOneToOne: false;
            referencedRelation: 'grupos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'avisos_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      comentarios: {
        Row: {
          criado_em: string;
          gasto_id: string;
          grupo_id: string;
          id: number;
          texto: string;
          usuario_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          criado_em?: string;
          gasto_id: string;
          grupo_id: string;
          id?: never;
          texto: string;
          usuario_id?: string | null;
        };
        Update: {
          criado_em?: string;
          gasto_id?: string;
          grupo_id?: string;
          id?: never;
          texto?: string;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'comentarios_gasto_id_fkey';
            columns: ['gasto_id'];
            isOneToOne: false;
            referencedRelation: 'gastos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comentarios_grupo_id_fkey';
            columns: ['grupo_id'];
            isOneToOne: false;
            referencedRelation: 'grupos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comentarios_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      dispositivos: {
        Row: {
          assinatura: Json | null;
          atualizado_em: string;
          criado_em: string;
          id: string;
          identificador: string;
          plataforma: string;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          assinatura?: Json | null;
          atualizado_em?: string;
          criado_em?: string;
          id?: string;
          identificador: string;
          plataforma: string;
          usuario_id: string;
        };
        Update: {
          assinatura?: Json | null;
          atualizado_em?: string;
          criado_em?: string;
          id?: string;
          identificador?: string;
          plataforma?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dispositivos_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      dividas: {
        Row: {
          credor: string;
          devedor: string;
          gasto_id: string;
          grupo_id: string;
          id: string;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          credor: string;
          devedor: string;
          gasto_id: string;
          grupo_id: string;
          id?: string;
          valor: number;
        };
        Update: {
          credor?: string;
          devedor?: string;
          gasto_id?: string;
          grupo_id?: string;
          id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'dividas_credor_fkey';
            columns: ['credor'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dividas_devedor_fkey';
            columns: ['devedor'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dividas_gasto_id_fkey';
            columns: ['gasto_id'];
            isOneToOne: false;
            referencedRelation: 'gastos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dividas_grupo_id_fkey';
            columns: ['grupo_id'];
            isOneToOne: false;
            referencedRelation: 'grupos';
            referencedColumns: ['id'];
          },
        ];
      };
      erros: {
        Row: {
          criado_em: string;
          id: number;
          mensagem: string;
          pilha: string | null;
          plataforma: string | null;
          tela: string | null;
          usuario_id: string | null;
          versao: string | null;
        };
        ComputedFields: never;
        Insert: {
          criado_em?: string;
          id?: never;
          mensagem: string;
          pilha?: string | null;
          plataforma?: string | null;
          tela?: string | null;
          usuario_id?: string | null;
          versao?: string | null;
        };
        Update: {
          criado_em?: string;
          id?: never;
          mensagem?: string;
          pilha?: string | null;
          plataforma?: string | null;
          tela?: string | null;
          usuario_id?: string | null;
          versao?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'erros_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      gasto_divisoes: {
        Row: {
          gasto_id: string;
          parametro: number | null;
          usuario_id: string;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          gasto_id: string;
          parametro?: number | null;
          usuario_id: string;
          valor: number;
        };
        Update: {
          gasto_id?: string;
          parametro?: number | null;
          usuario_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'gasto_divisoes_gasto_id_fkey';
            columns: ['gasto_id'];
            isOneToOne: false;
            referencedRelation: 'gastos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gasto_divisoes_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      gasto_pagadores: {
        Row: {
          gasto_id: string;
          usuario_id: string;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          gasto_id: string;
          usuario_id: string;
          valor: number;
        };
        Update: {
          gasto_id?: string;
          usuario_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'gasto_pagadores_gasto_id_fkey';
            columns: ['gasto_id'];
            isOneToOne: false;
            referencedRelation: 'gastos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gasto_pagadores_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      gastos: {
        Row: {
          atualizado_em: string;
          categoria: string;
          comprovante: string | null;
          criado_em: string;
          criado_por: string;
          data: string;
          descricao: string;
          grupo_id: string;
          id: string;
          itens: Json | null;
          recorrente_id: string | null;
          tipo_divisao: string;
          valor_total: number;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          categoria?: string;
          comprovante?: string | null;
          criado_em?: string;
          criado_por: string;
          data?: string;
          descricao: string;
          grupo_id: string;
          id?: string;
          itens?: Json | null;
          recorrente_id?: string | null;
          tipo_divisao: string;
          valor_total: number;
        };
        Update: {
          atualizado_em?: string;
          categoria?: string;
          comprovante?: string | null;
          criado_em?: string;
          criado_por?: string;
          data?: string;
          descricao?: string;
          grupo_id?: string;
          id?: string;
          itens?: Json | null;
          recorrente_id?: string | null;
          tipo_divisao?: string;
          valor_total?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'gastos_criado_por_fkey';
            columns: ['criado_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gastos_grupo_id_fkey';
            columns: ['grupo_id'];
            isOneToOne: false;
            referencedRelation: 'grupos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gastos_recorrente_id_fkey';
            columns: ['recorrente_id'];
            isOneToOne: false;
            referencedRelation: 'recorrentes';
            referencedColumns: ['id'];
          },
        ];
      };
      grupos: {
        Row: {
          abatimento: boolean;
          codigo_convite: string;
          cor: string;
          criado_em: string;
          criado_por: string;
          divisoes_permitidas: string[];
          id: string;
          lembrete_dias: number;
          metas: NonNullable<Json>;
          nome: string;
          permissoes: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          abatimento?: boolean;
          codigo_convite?: string;
          cor?: string;
          criado_em?: string;
          criado_por: string;
          divisoes_permitidas?: string[];
          id?: string;
          lembrete_dias?: number;
          metas?: NonNullable<Json>;
          nome: string;
          permissoes?: NonNullable<Json>;
        };
        Update: {
          abatimento?: boolean;
          codigo_convite?: string;
          cor?: string;
          criado_em?: string;
          criado_por?: string;
          divisoes_permitidas?: string[];
          id?: string;
          lembrete_dias?: number;
          metas?: NonNullable<Json>;
          nome?: string;
          permissoes?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'grupos_criado_por_fkey';
            columns: ['criado_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      historico: {
        Row: {
          acao: string;
          antes: Json | null;
          criado_em: string;
          depois: Json | null;
          entidade: string;
          grupo_id: string;
          id: number;
          registro_id: string | null;
          usuario_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          acao: string;
          antes?: Json | null;
          criado_em?: string;
          depois?: Json | null;
          entidade: string;
          grupo_id: string;
          id?: never;
          registro_id?: string | null;
          usuario_id?: string | null;
        };
        Update: {
          acao?: string;
          antes?: Json | null;
          criado_em?: string;
          depois?: Json | null;
          entidade?: string;
          grupo_id?: string;
          id?: never;
          registro_id?: string | null;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'historico_grupo_id_fkey';
            columns: ['grupo_id'];
            isOneToOne: false;
            referencedRelation: 'grupos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'historico_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      lancamentos_pendentes: {
        Row: {
          criado_em: string;
          data: string;
          gasto_id: string | null;
          grupo_id: string;
          id: string;
          recorrente_id: string;
          responsavel: string;
        };
        ComputedFields: never;
        Insert: {
          criado_em?: string;
          data: string;
          gasto_id?: string | null;
          grupo_id: string;
          id?: string;
          recorrente_id: string;
          responsavel: string;
        };
        Update: {
          criado_em?: string;
          data?: string;
          gasto_id?: string | null;
          grupo_id?: string;
          id?: string;
          recorrente_id?: string;
          responsavel?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lancamentos_pendentes_gasto_id_fkey';
            columns: ['gasto_id'];
            isOneToOne: false;
            referencedRelation: 'gastos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lancamentos_pendentes_grupo_id_fkey';
            columns: ['grupo_id'];
            isOneToOne: false;
            referencedRelation: 'grupos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lancamentos_pendentes_recorrente_id_fkey';
            columns: ['recorrente_id'];
            isOneToOne: false;
            referencedRelation: 'recorrentes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lancamentos_pendentes_responsavel_fkey';
            columns: ['responsavel'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      leituras_nfce: {
        Row: {
          criado_em: string;
          id: number;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          criado_em?: string;
          id?: never;
          usuario_id: string;
        };
        Update: {
          criado_em?: string;
          id?: never;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'leituras_nfce_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      membros: {
        Row: {
          apelido: string | null;
          arquivado: boolean;
          ativo: boolean;
          entrou_em: string;
          grupo_id: string;
          papel: string;
          removido_em: string | null;
          removido_por: string | null;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          apelido?: string | null;
          arquivado?: boolean;
          ativo?: boolean;
          entrou_em?: string;
          grupo_id: string;
          papel?: string;
          removido_em?: string | null;
          removido_por?: string | null;
          usuario_id: string;
        };
        Update: {
          apelido?: string | null;
          arquivado?: boolean;
          ativo?: boolean;
          entrou_em?: string;
          grupo_id?: string;
          papel?: string;
          removido_em?: string | null;
          removido_por?: string | null;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'membros_grupo_id_fkey';
            columns: ['grupo_id'];
            isOneToOne: false;
            referencedRelation: 'grupos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'membros_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      pagamentos: {
        Row: {
          criado_em: string;
          de: string;
          gasto_id: string | null;
          grupo_id: string;
          id: string;
          marcado_por: string;
          para: string;
          valor: number;
          valor_cobrado: number;
        };
        ComputedFields: never;
        Insert: {
          criado_em?: string;
          de: string;
          gasto_id?: string | null;
          grupo_id: string;
          id?: string;
          marcado_por: string;
          para: string;
          valor: number;
          valor_cobrado: number;
        };
        Update: {
          criado_em?: string;
          de?: string;
          gasto_id?: string | null;
          grupo_id?: string;
          id?: string;
          marcado_por?: string;
          para?: string;
          valor?: number;
          valor_cobrado?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'pagamentos_de_fkey';
            columns: ['de'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pagamentos_gasto_id_fkey';
            columns: ['gasto_id'];
            isOneToOne: false;
            referencedRelation: 'gastos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pagamentos_grupo_id_fkey';
            columns: ['grupo_id'];
            isOneToOne: false;
            referencedRelation: 'grupos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pagamentos_marcado_por_fkey';
            columns: ['marcado_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pagamentos_para_fkey';
            columns: ['para'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
      perfis: {
        Row: {
          chave_pix: string | null;
          criado_em: string;
          id: string;
          nome: string;
          push_token: string | null;
        };
        ComputedFields: never;
        Insert: {
          chave_pix?: string | null;
          criado_em?: string;
          id: string;
          nome?: string;
          push_token?: string | null;
        };
        Update: {
          chave_pix?: string | null;
          criado_em?: string;
          id?: string;
          nome?: string;
          push_token?: string | null;
        };
        Relationships: [];
      };
      recorrentes: {
        Row: {
          ativo: boolean;
          criado_em: string;
          criado_por: string;
          descricao: string;
          dia: number;
          frequencia: string;
          grupo_id: string;
          id: string;
          modelo: NonNullable<Json>;
          proxima_data: string;
          valor_total: number;
          valor_variavel: boolean;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          criado_em?: string;
          criado_por: string;
          descricao: string;
          dia: number;
          frequencia: string;
          grupo_id: string;
          id?: string;
          modelo: NonNullable<Json>;
          proxima_data: string;
          valor_total: number;
          valor_variavel?: boolean;
        };
        Update: {
          ativo?: boolean;
          criado_em?: string;
          criado_por?: string;
          descricao?: string;
          dia?: number;
          frequencia?: string;
          grupo_id?: string;
          id?: string;
          modelo?: NonNullable<Json>;
          proxima_data?: string;
          valor_total?: number;
          valor_variavel?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'recorrentes_criado_por_fkey';
            columns: ['criado_por'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recorrentes_grupo_id_fkey';
            columns: ['grupo_id'];
            isOneToOne: false;
            referencedRelation: 'grupos';
            referencedColumns: ['id'];
          },
        ];
      };
      saldos_pares: {
        Row: {
          atualizado_em: string;
          credor: string;
          devedor: string;
          devido: number;
          grupo_id: string;
          pago: number;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          credor: string;
          devedor: string;
          devido?: number;
          grupo_id: string;
          pago?: number;
        };
        Update: {
          atualizado_em?: string;
          credor?: string;
          devedor?: string;
          devido?: number;
          grupo_id?: string;
          pago?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'saldos_pares_credor_fkey';
            columns: ['credor'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saldos_pares_devedor_fkey';
            columns: ['devedor'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saldos_pares_grupo_id_fkey';
            columns: ['grupo_id'];
            isOneToOne: false;
            referencedRelation: 'grupos';
            referencedColumns: ['id'];
          },
        ];
      };
      tentativas_convite: {
        Row: {
          criado_em: string;
          id: number;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          criado_em?: string;
          id?: never;
          usuario_id: string;
        };
        Update: {
          criado_em?: string;
          id?: never;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tentativas_convite_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'perfis';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      anonimizar_conta: { Args: { p_usuario: string }; Returns: undefined };
      arquivar_grupo: { Args: { p_arquivar: boolean; p_grupo: string }; Returns: undefined };
      atualizar_grupo: {
        Args: {
          p_abatimento: boolean;
          p_cor: string;
          p_divisoes: string[];
          p_grupo: string;
          p_lembrete_dias: number;
          p_nome: string;
        };
        Returns: undefined;
      };
      buscar_em_todos: { Args: { p_texto: string }; Returns: string[] };
      buscar_gastos: {
        Args: { p_categoria?: string; p_grupo: string; p_mes?: string; p_pessoa?: string; p_texto?: string };
        Returns: string[];
      };
      calcular_dividas: { Args: { p_gasto: string }; Returns: undefined };
      cobrar: { Args: { p_devedor: string; p_grupo: string }; Returns: string };
      codigo_do_grupo: { Args: { p_grupo: string }; Returns: string };
      comentar: { Args: { p_gasto: string; p_texto: string }; Returns: number };
      compartilha_grupo: { Args: { outro: string }; Returns: boolean };
      conferir_grupo: {
        Args: { p_grupo: string };
        Returns: {
          data: string;
          descricao: string;
          detalhe: string;
          gasto_id: string;
          tipo: string;
        }[];
      };
      criar_grupo: {
        Args: {
          p_abatimento?: boolean;
          p_cor?: string;
          p_divisoes?: string[];
          p_lembrete_dias?: number;
          p_nome: string;
        };
        Returns: string;
      };
      criar_recorrente: {
        Args: { p: Json; p_frequencia: string; p_gasto?: string; p_valor_variavel?: boolean };
        Returns: string;
      };
      definir_apelido: { Args: { p_apelido: string; p_grupo: string }; Returns: undefined };
      definir_metas: { Args: { p_grupo: string; p_metas: Json }; Returns: undefined };
      definir_papel: { Args: { p_grupo: string; p_papel: string; p_usuario: string }; Returns: undefined };
      definir_permissoes: { Args: { p_grupo: string; p_permissoes: Json }; Returns: undefined };
      dividas_em_aberto: {
        Args: Record<PropertyKey, never>;
        Returns: {
          grupo_id: string;
          total: number;
          usuario_id: string;
        }[];
      };
      eh_dono: { Args: { g: string }; Returns: boolean };
      eh_membro: { Args: { g: string }; Returns: boolean };
      entrar_no_grupo: { Args: { p_codigo: string }; Returns: string };
      excluir_gasto: { Args: { p_id: string }; Returns: undefined };
      extrato_com: {
        Args: { p_grupo: string; p_outro: string };
        Returns: {
          criado_em: string;
          data: string;
          descricao: string;
          efeito: number;
          gasto_id: string;
          tipo: string;
          valor_total: number;
        }[];
      };
      garantir_dono: { Args: { p_grupo: string }; Returns: undefined };
      gerar_codigo: { Args: Record<PropertyKey, never>; Returns: string };
      gerar_lembretes: { Args: Record<PropertyKey, never>; Returns: number };
      gravar_gasto: { Args: { p: Json; p_autor: string }; Returns: string };
      hoje_sp: { Args: Record<PropertyKey, never>; Returns: string };
      lancar_meus_recorrentes: { Args: Record<PropertyKey, never>; Returns: number };
      lancar_recorrentes: { Args: Record<PropertyKey, never>; Returns: number };
      lancar_recorrentes_internos: { Args: { p_grupos: string[] }; Returns: number };
      limpar_dados_antigos: { Args: Record<PropertyKey, never>; Returns: number };
      marcar_pago: {
        Args: { p_de: string; p_gasto?: string; p_grupo: string; p_para: string; p_valor: number };
        Returns: string;
      };
      meu_papel: { Args: { g: string }; Returns: string };
      meus_dados: { Args: Record<PropertyKey, never>; Returns: Json };
      nivel_do_papel: { Args: { p: string }; Returns: number };
      novo_codigo_convite: { Args: { p_grupo: string }; Returns: string };
      parar_recorrente: { Args: { p_id: string }; Returns: undefined };
      partes_em_centavos: { Args: { p_pagadores: Json; p_partes: Json; p_total: number }; Returns: Json };
      passar_dono: { Args: { p_grupo: string; p_usuario: string }; Returns: undefined };
      pendencias_de_grupos_que_sai: {
        Args: Record<PropertyKey, never>;
        Returns: {
          credor: string;
          data: string;
          descricao: string;
          devedor: string;
          gasto_id: string;
          grupo_cor: string;
          grupo_id: string;
          grupo_nome: string;
          outra_pessoa: string;
          valor: string;
        }[];
      };
      pendencias_do_grupo: {
        Args: { p_abatimento?: boolean; p_grupo: string };
        Returns: {
          cobrar: string;
          credor: string;
          data: string;
          descricao: string;
          devedor: string;
          gasto_id: string;
          valor: string;
        }[];
      };
      pendencias_internas: {
        Args: { p_abatimento?: boolean; p_grupo: string };
        Returns: {
          credor: string;
          devedor: string;
          gasto_id: string;
          valor: number;
        }[];
      };
      permissoes_validas: { Args: { p: Json }; Returns: boolean };
      pode: { Args: { acao: string; g: string }; Returns: boolean };
      preencher_lancamento: { Args: { p: Json; p_pendente: string }; Returns: string };
      primeiros_passos: { Args: Record<PropertyKey, never>; Returns: Json };
      proxima_ocorrencia: { Args: { d: string; dia: number; frequencia: string }; Returns: string };
      readmitir_membro: { Args: { p_grupo: string; p_usuario: string }; Returns: undefined };
      reais: { Args: { v: number }; Returns: string };
      recalcular_saldo_par: { Args: { c: string; d: string; g: string }; Returns: undefined };
      registrar_dispositivo: {
        Args: { p_assinatura?: Json; p_identificador: string; p_plataforma: string };
        Returns: string;
      };
      registrar_erro: {
        Args: { p_mensagem: string; p_pilha?: string; p_plataforma?: string; p_tela?: string; p_versao?: string };
        Returns: undefined;
      };
      registrar_leitura_nfce: { Args: Record<PropertyKey, never>; Returns: undefined };
      remover_dispositivo: { Args: { p_identificador: string }; Returns: undefined };
      remover_membro: { Args: { p_grupo: string; p_usuario: string }; Returns: undefined };
      resumo_meus_grupos: {
        Args: Record<PropertyKey, never>;
        Returns: {
          abatimento: boolean;
          arquivado: boolean;
          cor: string;
          grupo_id: string;
          nome: string;
          te_devem: number;
          total_membros: number;
          voce_deve: number;
        }[];
      };
      retomar_recorrente: { Args: { p_id: string }; Returns: undefined };
      sair_do_grupo: { Args: { p_grupo: string }; Returns: undefined };
      salvar_gasto: { Args: { p: Json }; Returns: string };
      valor_a_cobrar: { Args: { v: number }; Returns: number };
      valor_de: { Args: { lista: Json; pessoa: string }; Returns: number };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
