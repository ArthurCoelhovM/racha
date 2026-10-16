# Super Organizador 3021

App para dividir contas, compras e gastos em grupo, parecido com Splitwise e Tricount, com uma regra diferente: **dívidas só se abatem entre duas pessoas**. Se A deve a B e B deve a C, A nunca paga para C.

- Android: APK gerado pelo EAS.
- iPhone: versão web instalável (abre pelo Safari e vai para a Tela de Início).
- Banco, login e regras de acesso: Supabase.

## Regras

| Regra | Como funciona |
| --- | --- |
| Abatimento | Configurado por grupo. Ligado: A deve 50 a B e B deve 30 a A, então A paga 20 a B. Desligado (ex.: Casa, com luz e aluguel): cada gasto é cobrado separado. |
| Terceiros | Nunca existe dívida passando por uma terceira pessoa. |
| Valores | As partes são guardadas com 18 casas decimais. Na hora de cobrar, o valor é arredondado para cima no centavo (R$ 33,333… vira R$ 33,34). |
| Vários pagadores | Quem pagou mais que a sua parte recebe de quem pagou menos, na proporção do que adiantou. |
| Formas de dividir | Igual, valor exato, porcentagem, cotas e por item. Cada grupo escolhe quais permite. |
| Pagamento | Um toque em "Marcar que paguei" ou "Marcar que recebi". Dá para desfazer. |
| Histórico | Gastos, pagamentos, entradas, saídas e mudanças de configuração ficam registrados. |

## Estrutura

```
src/app/                 telas (Expo Router)
  index.tsx              lista de grupos
  grupo/[id]/index.tsx   dívidas (lista, por pessoa, gráfico), gastos e histórico
  grupo/[id]/gasto.tsx   novo gasto e edição
src/lib/divisao.ts       contas de divisão
src/lib/saldos.ts        quem deve a quem, com e sem abatimento
src/lib/api.ts           chamadas ao Supabase
supabase/migrations/     banco: tabelas, RLS, funções e triggers
supabase/testes/         testes do banco
testes/                  testes das contas
public/                  manifesto e ícones da versão web
```

## Colocar no ar

### 1. Supabase

1. Crie um projeto grátis em supabase.com (região São Paulo).
2. Abra **SQL Editor**, cole o conteúdo de `supabase/migrations/20261016000000_esquema_inicial.sql` e rode.
3. Em **Authentication > Sign In / Providers > Email**, desligue **Confirm email**. O envio de e-mail padrão do Supabase só entrega para pessoas da equipe do projeto e no máximo 2 por hora, então seus amigos não receberiam a confirmação. Para recuperar senha por e-mail, configure um SMTP próprio (Brevo e Resend têm plano grátis) em **Authentication > Emails > SMTP Settings**.
4. Em **Authentication > URL Configuration**, coloque o endereço da versão web em **Site URL** e adicione `https://SEU-ENDERECO/**` em **Redirect URLs**.
5. Copie a URL do projeto e a **publishable key** (botão **Connect** ou **Project Settings > API Keys**).

### 2. Rodar no seu computador

```bash
cp .env.example .env        # e preencha com os dados do passo anterior
npm install
npx expo start              # aperte w para abrir no navegador
```

No Android, dá para testar com o app Expo Go lendo o QR code.

### 3. Versão web para iPhone (Vercel, grátis)

1. Suba o projeto para um repositório no GitHub.
2. Em vercel.com, importe o repositório. O `vercel.json` já define o build (`npx expo export -p web`) e a pasta `dist`.
3. Em **Settings > Environment Variables**, cadastre as três variáveis do `.env`.
4. Depois do deploy, no iPhone: abra o endereço no Safari, toque em **Compartilhar** e em **Adicionar à Tela de Início**.

Na Netlify também funciona: build `npx expo export -p web`, pasta `dist`. O arquivo `public/_redirects` já cuida das rotas.

### 4. APK para Android

1. Crie uma conta grátis em expo.dev.
2. Preencha as variáveis do perfil `apk` em `eas.json`.
3. Rode `npm run apk`. No fim, o EAS mostra um link para baixar o APK, que você pode mandar para o grupo.

## Testes

```bash
npm run testes          # contas de divisão, abatimento e arredondamento
npm run tipos           # TypeScript
npm run lint
npm run testes:banco    # precisa de um Postgres local: PGHOST, PGPORT e PGUSER
```

## Ainda falta

- Notificações push (Android com expo-notifications, iPhone com Web Push).
- Lembrete de dívida automático (pg_cron + Edge Function). A frequência já é salva por grupo.
- Gastos recorrentes (aluguel, luz, internet).
- Leitura de cupom fiscal por foto.
