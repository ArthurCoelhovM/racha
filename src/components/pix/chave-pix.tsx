import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Aviso, Botao, Campo, Cartao, Ficha, Fichas, Texto } from '@/components/ui';
import { mensagemDeErro, salvarChavePix } from '@/lib/api';
import { useMinhaChavePix } from '@/lib/consultas';
import { chaveParaMostrar, normalizarChave, TIPOS_CHAVE, tipoDaChave, type TipoChave } from '@/lib/pix';

// Em Sua conta: a chave Pix aparece para quem divide grupo com você, no botão "Pagar com Pix"
export function ChavePix({ usuarioId }: { usuarioId: string }) {
  const atual = useMinhaChavePix(usuarioId);
  if (atual.isPending) return null;
  return <Formulario usuarioId={usuarioId} salva={atual.data ?? null} />;
}

function Formulario({ usuarioId, salva }: { usuarioId: string; salva: string | null }) {
  const cliente = useQueryClient();
  const [tipo, setTipo] = useState<TipoChave>(salva ? tipoDaChave(salva) : 'celular');
  const [texto, setTexto] = useState(salva ? chaveParaMostrar(salva) : '');
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'erro' | 'ok' } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const exemplo = TIPOS_CHAVE.find((t) => t.tipo === tipo)!.exemplo;

  async function gravar(chave: string | null) {
    setSalvando(true);
    setAviso(null);
    try {
      await salvarChavePix(usuarioId, chave);
      await cliente.invalidateQueries({ queryKey: ['minha-chave'] });
      await cliente.invalidateQueries({ queryKey: ['chave-pix'] });
      setAviso({ texto: chave ? 'Chave Pix salva.' : 'Chave Pix removida.', tipo: 'ok' });
    } catch (e) {
      setAviso({ texto: mensagemDeErro(e), tipo: 'erro' });
    } finally {
      setSalvando(false);
    }
  }

  function salvar() {
    const chave = normalizarChave(tipo, texto);
    if (!chave) {
      setAviso({
        texto: `Essa chave não parece um ${TIPOS_CHAVE.find((t) => t.tipo === tipo)!.nome.toLowerCase()}.`,
        tipo: 'erro',
      });
      return;
    }
    gravar(chave);
  }

  return (
    <Cartao>
      <Texto variante="forte">Sua chave Pix</Texto>
      <Texto variante="suave">
        Quem te deve vê a chave e um QR com o valor certo para pagar. Só aparece para quem divide grupo com você.
      </Texto>
      <Fichas>
        {TIPOS_CHAVE.map((t) => (
          <Ficha key={t.tipo} rotulo={t.nome} selecionada={tipo === t.tipo} aoPressionar={() => setTipo(t.tipo)} />
        ))}
      </Fichas>
      <Campo
        value={texto}
        onChangeText={setTexto}
        placeholder={exemplo}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={tipo === 'email' ? 'email-address' : tipo === 'aleatoria' ? 'default' : 'phone-pad'}
        accessibilityLabel="Chave Pix"
      />
      {aviso ? <Aviso texto={aviso.texto} tipo={aviso.tipo} /> : null}
      <Botao titulo="Salvar chave Pix" aoPressionar={salvar} carregando={salvando} />
      {salva ? (
        <Botao titulo="Remover chave" variante="texto" aoPressionar={() => gravar(null)} desabilitado={salvando} />
      ) : null}
    </Cartao>
  );
}
