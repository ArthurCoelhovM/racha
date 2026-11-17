import { View } from 'react-native';

import { Cartao, Tela, Texto } from '@/components/ui';
import { espaco } from '@/constants/tema';

const contato = process.env.EXPO_PUBLIC_CONTATO_PRIVACIDADE;

const secoes: { titulo: string; texto: string[] }[] = [
  {
    titulo: 'Quais dados o app guarda',
    texto: [
      'Da sua conta, só três coisas: e-mail, senha e nome. Não pedimos confirmação por e-mail, telefone, CPF nem endereço.',
      'O e-mail e a senha ficam só no serviço de login; a senha é guardada criptografada e ninguém consegue ler.',
      'Além disso, o que você mesmo registra nos grupos: gastos, divisões, pagamentos, comentários e avisos.',
      'Só se você quiser: a chave Pix (para quem te deve pagar) e o endereço do aparelho, se ligar as notificações.',
      'O link de uma nota fiscal lida pelo QR code serve só para buscar os itens no site da Sefaz e não é guardado.',
    ],
  },
  {
    titulo: 'Para que servem',
    texto: ['Para dividir as contas do grupo, mostrar quem deve a quem e avisar sobre gastos, pagamentos e dívidas.'],
  },
  {
    titulo: 'Quem vê',
    texto: [
      'As pessoas dos grupos em que você está veem seu nome e os gastos daquele grupo, mas não o seu e-mail. Ninguém de fora do grupo vê nada.',
      'O app não tem anúncios, não vende dados e não usa rastreamento.',
    ],
  },
  {
    titulo: 'Onde ficam',
    texto: [
      'Os dados ficam no Supabase, o banco de dados do app.',
      'As notificações passam pelo serviço de push do Expo (Android) ou do navegador (Apple, Google ou Mozilla), só com o título e o texto do aviso.',
    ],
  },
  {
    titulo: 'Seus direitos (LGPD)',
    texto: [
      'Você pode ver e corrigir seus dados na tela da sua conta, exportar os gastos de um grupo em CSV e excluir a conta pelo próprio app.',
      'Ao excluir a conta, seu nome, e-mail, senha, chave Pix, aparelhos e avisos são apagados. Os gastos que você dividiu continuam no histórico do grupo como "Conta excluída", porque fazem parte das contas das outras pessoas.',
    ],
  },
];

export default function Privacidade() {
  return (
    <Tela>
      <Texto variante="titulo">Política de privacidade</Texto>
      <Texto variante="suave">Atualizada em 17/11/2026</Texto>
      {secoes.map((s) => (
        <Cartao key={s.titulo}>
          <Texto variante="subtitulo">{s.titulo}</Texto>
          <View style={{ gap: espaco.m }}>
            {s.texto.map((t) => (
              <Texto key={t}>{t}</Texto>
            ))}
          </View>
        </Cartao>
      ))}
      <Texto variante="suave">
        {contato
          ? `Dúvidas ou pedidos sobre seus dados: ${contato}.`
          : 'Dúvidas ou pedidos sobre seus dados: fale com quem te convidou para o app.'}
      </Texto>
    </Tela>
  );
}
