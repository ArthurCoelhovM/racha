import { dec, reais } from './dinheiro';
import { isoParaBr } from './formatos';
import { NOME_DO_PAPEL } from './permissoes';
import { TIPOS_DIVISAO, type Papel, type RegistroHistorico } from './tipos';

type Registro = Record<string, unknown>;
type Linha = { usuario_id?: unknown; valor?: unknown };

function porPessoa(lista: unknown): Map<string, string> {
  const mapa = new Map<string, string>();
  if (!Array.isArray(lista)) return mapa;
  for (const item of lista as Linha[]) {
    if (item && typeof item.usuario_id === 'string') mapa.set(item.usuario_id, dec(String(item.valor ?? 0)).toFixed(2));
  }
  return mapa;
}

function nomeDoTipo(tipo: unknown): string {
  return TIPOS_DIVISAO.find((t) => t.tipo === tipo)?.nome ?? String(tipo ?? '');
}

function juntar(nomes: string[]): string {
  if (nomes.length <= 1) return nomes.join('');
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

// O que mudou de uma versão do gasto para a outra, em frases curtas.
// "antes" vem da linha do banco e "depois" do que o app mandou salvar; os dois têm pagadores e divisões.
export function mudancasDoGasto(antes: Registro, depois: Registro, nome: (u: string) => string): string[] {
  const mudancas: string[] = [];
  if (String(antes.descricao ?? '') !== String(depois.descricao ?? '')) {
    mudancas.push(`Descrição: "${antes.descricao}" → "${depois.descricao}"`);
  }
  if (!dec(String(antes.valor_total ?? 0)).eq(dec(String(depois.valor_total ?? 0)))) {
    mudancas.push(`Valor: ${reais(String(antes.valor_total))} → ${reais(String(depois.valor_total))}`);
  }
  if (antes.data && depois.data && String(antes.data).slice(0, 10) !== String(depois.data).slice(0, 10)) {
    mudancas.push(`Data: ${isoParaBr(String(antes.data))} → ${isoParaBr(String(depois.data))}`);
  }
  if (antes.tipo_divisao !== depois.tipo_divisao) {
    mudancas.push(`Divisão: ${nomeDoTipo(antes.tipo_divisao)} → ${nomeDoTipo(depois.tipo_divisao)}`);
  }

  const pagosAntes = porPessoa(antes.pagadores);
  const pagosDepois = porPessoa(depois.pagadores);
  const mesmosPagadores =
    pagosAntes.size === pagosDepois.size && [...pagosAntes].every(([u, v]) => pagosDepois.get(u) === v);
  if (!mesmosPagadores) {
    const descrever = (m: Map<string, string>) =>
      m.size === 1 ? nome([...m.keys()][0]) : juntar([...m].map(([u, v]) => `${nome(u)} (${reais(v)})`));
    mudancas.push(`Quem pagou: ${descrever(pagosAntes)} → ${descrever(pagosDepois)}`);
  }

  const partesAntes = porPessoa(antes.divisoes);
  const partesDepois = porPessoa(depois.divisoes);
  for (const u of new Set([...partesAntes.keys(), ...partesDepois.keys()])) {
    const a = partesAntes.get(u);
    const d = partesDepois.get(u);
    if (a === d) continue;
    const quem = nome(u) === 'Você' ? 'Sua parte' : `Parte de ${nome(u)}`;
    if (!a) mudancas.push(`${quem}: entrou com ${reais(d!)}`);
    else if (!d || dec(d).isZero()) mudancas.push(`${quem}: saiu da divisão (era ${reais(a)})`);
    else mudancas.push(`${quem}: ${reais(a)} → ${reais(d)}`);
  }
  return mudancas;
}

export function descreverHistorico(r: RegistroHistorico, nome: (u: string) => string): string {
  const quem = r.usuario_id ? nome(r.usuario_id) : 'Alguém';
  const depois = (r.depois ?? {}) as Registro;
  const antes = (r.antes ?? {}) as Registro;
  switch (r.entidade) {
    case 'gastos': {
      if (r.acao === 'insert') return `${quem} registrou "${depois.descricao}" de ${reais(String(depois.valor_total))}`;
      if (r.acao === 'delete') return `${quem} excluiu "${antes.descricao}" de ${reais(String(antes.valor_total))}`;
      const mudancas = mudancasDoGasto(antes, depois, nome);
      if (mudancas.length === 0) return `${quem} editou "${depois.descricao}"`;
      const resto = mudancas.length > 2 ? ` e mais ${mudancas.length - 2}` : '';
      return `${quem} editou "${depois.descricao}": ${mudancas.slice(0, 2).join('; ')}${resto}`;
    }
    case 'pagamentos': {
      const dados = r.acao === 'insert' ? depois : antes;
      const texto = `${nome(String(dados.de))} pagou ${reais(String(dados.valor_cobrado ?? dados.valor))} a ${nome(String(dados.para))}`;
      return r.acao === 'insert' ? `${quem} marcou: ${texto}` : `${quem} desfez: ${texto}`;
    }
    case 'membros': {
      const pessoa = nome(String(depois.usuario_id));
      if (r.acao === 'insert') return `${pessoa} entrou no grupo`;
      if (antes.ativo !== depois.ativo) {
        if (depois.ativo) return `${pessoa} voltou ao grupo`;
        return r.usuario_id && r.usuario_id !== depois.usuario_id
          ? `${quem} removeu ${pessoa} do grupo`
          : `${pessoa} saiu do grupo`;
      }
      if (antes.papel !== depois.papel) {
        return `${pessoa} passou de ${NOME_DO_PAPEL[antes.papel as Papel] ?? antes.papel} para ${(
          NOME_DO_PAPEL[depois.papel as Papel] ?? String(depois.papel)
        ).toLowerCase()}`;
      }
      return `${quem} mudou ${pessoa}`;
    }
    case 'grupos':
      if (antes.abatimento !== depois.abatimento) {
        return `${quem} ${depois.abatimento ? 'ligou' : 'desligou'} o abatimento`;
      }
      if (depois.codigo_trocado === true || (antes.codigo_convite && antes.codigo_convite !== depois.codigo_convite)) {
        return `${quem} gerou um novo código de convite`;
      }
      if (antes.nome !== depois.nome) return `${quem} mudou o nome do grupo para "${depois.nome}"`;
      if (JSON.stringify(antes.permissoes) !== JSON.stringify(depois.permissoes)) {
        return `${quem} mudou as permissões do grupo`;
      }
      return `${quem} mudou as configurações do grupo`;
    default:
      return `${quem} fez uma alteração`;
  }
}
