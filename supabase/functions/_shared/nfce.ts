// Leitura da página de consulta pública da NFC-e (o link do QR code do cupom).
// A maioria dos estados usa o mesmo modelo de página, com a tabela "tabResult".
// Este arquivo não depende de Deno nem de React Native: é usado pela Edge Function e pelo app.

export type ItemNota = {
  descricao: string;
  codigo: string | null;
  quantidade: number | null;
  unidade: string | null;
  valorUnitario: number | null;
  valor: number;
};

export type Nota = {
  estabelecimento: string | null;
  cnpj: string | null;
  data: string | null;
  chave: string | null;
  itens: ItemNota[];
  totalItens: number;
  desconto: number;
  valorPago: number;
};

const entidades: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  ccedil: 'ç',
  Ccedil: 'Ç',
  atilde: 'ã',
  Atilde: 'Ã',
  otilde: 'õ',
  Otilde: 'Õ',
  aacute: 'á',
  Aacute: 'Á',
  eacute: 'é',
  Eacute: 'É',
  iacute: 'í',
  Iacute: 'Í',
  oacute: 'ó',
  Oacute: 'Ó',
  uacute: 'ú',
  Uacute: 'Ú',
  acirc: 'â',
  Acirc: 'Â',
  ecirc: 'ê',
  Ecirc: 'Ê',
  ocirc: 'ô',
  Ocirc: 'Ô',
  agrave: 'à',
  Agrave: 'À',
  ordm: 'º',
  ordf: 'ª',
  deg: '°',
};

export function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (inteiro, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : inteiro;
    }
    return entidades[e] ?? inteiro;
  });
}

export function textoPuro(html: string): string {
  return decodificarEntidades(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

// "1.234,56" -> 1234.56
export function numeroBr(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const limpo = texto.replace(/[^\d,.-]/g, '');
  if (!/\d/.test(limpo)) return null;
  const n = Number(limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo);
  return Number.isFinite(n) ? n : null;
}

function spanDaClasse(html: string, classe: string): string | null {
  const m = new RegExp(`<span[^>]*class=["'][^"']*\\b${classe}\\b[^"']*["'][^>]*>([\\s\\S]*?)</span>`, 'i').exec(html);
  return m ? m[1] : null;
}

// tira o rótulo em <strong> ("Qtde.:", "UN:", "Vl. Unit.:") e devolve só o valor
function valorDoCampo(html: string, classe: string): string | null {
  const conteudo = spanDaClasse(html, classe);
  if (conteudo === null) return null;
  const semRotulo = textoPuro(conteudo.replace(/<strong[^>]*>[\s\S]*?<\/strong>/gi, ''));
  return semRotulo || null;
}

function totalDoRotulo(html: string, rotulo: RegExp): number | null {
  const fonte = rotulo.source;
  const m = new RegExp(`${fonte}[\\s\\S]{0,300}?class=["'][^"']*totalNumb[^"']*["'][^>]*>([^<]+)<`, 'i').exec(html);
  return m ? numeroBr(m[1]) : null;
}

function centavos(n: number): number {
  return Math.round(n * 100) / 100;
}

export function lerNfce(html: string): Nota {
  const tabela = /<table[^>]*id=["']tabResult["'][^>]*>([\s\S]*?)<\/table>/i.exec(html)?.[1] ?? '';
  const linhas = tabela.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];

  const itens: ItemNota[] = [];
  for (const linha of linhas) {
    const nome = spanDaClasse(linha, 'txtTit');
    const valor = numeroBr(textoPuro(spanDaClasse(linha, 'valor') ?? ''));
    if (nome === null || valor === null) continue;
    const textoCodigo = textoPuro(spanDaClasse(linha, 'RCod') ?? '');
    const codigo = /C[óo]d(?:igo)?\.?:?\s*([^\s)]+)/i.exec(textoCodigo)?.[1] ?? null;
    itens.push({
      descricao: textoPuro(nome),
      codigo,
      quantidade: numeroBr(valorDoCampo(linha, 'Rqtd')),
      unidade: valorDoCampo(linha, 'RUN'),
      valorUnitario: numeroBr(valorDoCampo(linha, 'RvlUnit')),
      valor,
    });
  }

  const totalItens = centavos(itens.reduce((s, i) => s + i.valor, 0));
  const aPagar = totalDoRotulo(html, /<label[^>]*>\s*Valor a pagar/);
  const descontoInformado = totalDoRotulo(html, /<label[^>]*>\s*Descontos?\b/);
  const desconto = centavos(descontoInformado ?? (aPagar !== null ? Math.max(0, totalItens - aPagar) : 0));
  const valorPago = centavos(aPagar ?? totalItens - desconto);

  const texto = textoPuro(html);
  const topo = /<div[^>]*class=["'][^"']*txtTopo[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1];
  const data = /Emiss[ãa]o:?\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(texto);
  const chave = /Chave de acesso:?\s*((?:\d\s*){44})/i.exec(texto)?.[1].replace(/\s/g, '') ?? null;

  return {
    estabelecimento: topo ? textoPuro(topo) || null : null,
    cnpj: /CNPJ:?\s*([\d./-]{14,18})/i.exec(texto)?.[1] ?? null,
    data: data ? `${data[3]}-${data[2]}-${data[1]}` : null,
    chave,
    itens,
    totalItens,
    desconto,
    valorPago,
  };
}

// Só aceita links de sites do governo (".gov.br") com os parâmetros da NFC-e.
export function validarUrlNfce(texto: string, hostsExtras: string[] = []): string | null {
  let url: URL;
  try {
    url = new URL(texto.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  const permitido = host.endsWith('.gov.br') || hostsExtras.includes(host);
  if (!permitido) return null;
  if (!/(^|[?&])(p|chNFe)=/i.test(url.search)) return null;
  return url.toString();
}
