export function hojeIso(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function isoParaBr(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

// "16/10/2026" -> "2026-10-16"; null se a data não existir
export function brParaIso(texto: string): string | null {
  const m = texto.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return null;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function diaCurto(iso: string): string {
  const [, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}`;
}

export function momento(isoComHora: string): string {
  const d = new Date(isoComHora);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const hora = String(d.getHours()).padStart(2, '0');
  const minuto = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes} às ${hora}:${minuto}`;
}

export function textoLembrete(dias: number): string {
  if (dias === 0) return 'Sem lembrete';
  if (dias === 1) return 'Todo dia';
  if (dias === 7) return 'Toda semana';
  if (dias === 30) return 'Todo mês';
  return `A cada ${dias} dias`;
}

// mesma regra do banco: no mensal, dia 31 vira o último dia dos meses curtos
export function proximaOcorrencia(iso: string, frequencia: 'mensal' | 'semanal', dia: number): string {
  const [ano, mes, d] = iso.split('-').map(Number);
  if (frequencia === 'semanal') {
    const data = new Date(Date.UTC(ano, mes - 1, d + 7));
    return data.toISOString().slice(0, 10);
  }
  const proximoMes = new Date(Date.UTC(ano, mes, 1));
  const ultimoDia = new Date(Date.UTC(proximoMes.getUTCFullYear(), proximoMes.getUTCMonth() + 1, 0)).getUTCDate();
  proximoMes.setUTCDate(Math.min(dia, ultimoDia));
  return proximoMes.toISOString().slice(0, 10);
}
