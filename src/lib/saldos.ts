import { Decimal, dec } from './dinheiro';

// Pendências vêm prontas do banco (pendencias_do_grupo): a regra do abatimento mora só lá.
export type PendenciaBanco = {
  devedor: string;
  credor: string;
  gasto_id: string | null;
  descricao: string | null;
  data: string | null;
  valor: string;
  cobrar: string;
};

export type Pendencia = {
  chave: string;
  devedor: string;
  credor: string;
  valor: Decimal;
  cobrar: Decimal;
  gasto_id: string | null;
  descricao: string | null;
  data: string | null;
};

export function lerPendencias(linhas: PendenciaBanco[]): Pendencia[] {
  return linhas.map((l) => ({
    chave: l.gasto_id ? `${l.gasto_id}|${l.devedor}|${l.credor}` : `${l.devedor}|${l.credor}`,
    devedor: l.devedor,
    credor: l.credor,
    valor: dec(l.valor),
    cobrar: dec(l.cobrar),
    gasto_id: l.gasto_id,
    descricao: l.descricao,
    data: l.data,
  }));
}

export function resumoDoUsuario(pendencias: Pendencia[], eu: string) {
  let voceDeve = new Decimal(0);
  let teDevem = new Decimal(0);
  for (const p of pendencias) {
    if (p.devedor === eu) voceDeve = voceDeve.plus(p.cobrar);
    if (p.credor === eu) teDevem = teDevem.plus(p.cobrar);
  }
  return { voceDeve, teDevem };
}

// saldo de cada pessoa: quanto tem a receber menos quanto deve, em valores de cobrança
export function saldoDaPessoa(pendencias: Pendencia[], pessoa: string): Decimal {
  let saldo = new Decimal(0);
  for (const p of pendencias) {
    if (p.credor === pessoa) saldo = saldo.plus(p.cobrar);
    if (p.devedor === pessoa) saldo = saldo.minus(p.cobrar);
  }
  return saldo;
}
