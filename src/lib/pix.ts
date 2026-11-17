import { Decimal } from './dinheiro';

export type TipoChave = 'cpf' | 'celular' | 'email' | 'aleatoria';

export const TIPOS_CHAVE: { tipo: TipoChave; nome: string; exemplo: string }[] = [
  { tipo: 'celular', nome: 'Celular', exemplo: '(51) 99999-9999' },
  { tipo: 'cpf', nome: 'CPF ou CNPJ', exemplo: '000.000.000-00' },
  { tipo: 'email', nome: 'E-mail', exemplo: 'voce@exemplo.com' },
  { tipo: 'aleatoria', nome: 'Aleatória', exemplo: '123e4567-e89b-12d3-a456-426614174000' },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// deixa a chave no formato que o Banco Central espera; null se não der para usar
export function normalizarChave(tipo: TipoChave, texto: string): string | null {
  const limpo = texto.trim();
  if (tipo === 'email') {
    const email = limpo.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 77 ? email : null;
  }
  if (tipo === 'aleatoria') {
    const chave = limpo.toLowerCase();
    return UUID.test(chave) ? chave : null;
  }
  const digitos = limpo.replace(/\D/g, '');
  if (tipo === 'cpf') return digitos.length === 11 || digitos.length === 14 ? digitos : null;
  // celular: com DDD, com ou sem o 55 na frente
  const nacional = digitos.length === 13 && digitos.startsWith('55') ? digitos.slice(2) : digitos;
  return nacional.length === 10 || nacional.length === 11 ? `+55${nacional}` : null;
}

// adivinha o tipo de uma chave já salva, para o campo abrir certo
export function tipoDaChave(chave: string): TipoChave {
  if (chave.includes('@')) return 'email';
  if (chave.startsWith('+')) return 'celular';
  if (UUID.test(chave)) return 'aleatoria';
  return 'cpf';
}

// "+5551999999999" -> "(51) 99999-9999"
export function chaveParaMostrar(chave: string): string {
  if (chave.startsWith('+55')) {
    const n = chave.slice(3);
    const meio = n.length === 11 ? 7 : 6;
    return `(${n.slice(0, 2)}) ${n.slice(2, meio)}-${n.slice(meio)}`;
  }
  if (/^\d{11}$/.test(chave)) return `${chave.slice(0, 3)}.${chave.slice(3, 6)}.${chave.slice(6, 9)}-${chave.slice(9)}`;
  if (/^\d{14}$/.test(chave))
    return `${chave.slice(0, 2)}.${chave.slice(2, 5)}.${chave.slice(5, 8)}/${chave.slice(8, 12)}-${chave.slice(12)}`;
  return chave;
}

function campo(id: string, valor: string): string {
  return `${id}${String(valor.length).padStart(2, '0')}${valor}`;
}

// nome e cidade do recebedor: sem acento, maiúsculo e no tamanho do padrão
function textoSimples(texto: string, maximo: number): string {
  const simples = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, maximo)
    .trim();
  return simples || 'RECEBEDOR';
}

export function crc16(texto: string): string {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// "Pix copia e cola" (BR Code estático) com o valor já preenchido
export function codigoPix({
  chave,
  nome,
  valor,
  cidade = 'BRASIL',
}: {
  chave: string;
  nome: string;
  valor: Decimal;
  cidade?: string;
}): string {
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', chave);
  const corpo =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    (valor.gt(0) ? campo('54', valor.toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', textoSimples(nome, 25)) +
    campo('60', textoSimples(cidade, 15)) +
    campo('62', campo('05', '***')) +
    '6304';
  return corpo + crc16(corpo);
}
