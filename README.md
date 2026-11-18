# Racha

(antes chamado Super Organizador 3021; os nomes técnicos abaixo continuam os antigos)

App para dividir contas, compras e gastos em grupo, parecido com Splitwise e Tricount, com uma regra diferente: **dívidas só se abatem entre duas pessoas**. Se A deve a B e B deve a C, A nunca paga para C.

- Android: APK gerado pelo EAS.
- iPhone: versão web instalável (abre pelo Safari e vai para a Tela de Início).
- Banco, login e regras de acesso: Supabase.

## Regras

| Regra | Como funciona |
| --- | --- |
| Abatimento | Configurado por grupo. Ligado: A deve 50 a B e B deve 30 a A, então A paga 20 a B. Desligado (ex.: Casa, com luz e aluguel): cada gasto é cobrado separado. |
| Terceiros | Nunca existe dívida passando por uma terceira pessoa. |
| Valores | Tudo em centavos exatos: as partes somam o total. Quando a conta não divide certinho, o centavo que sobra fica com quem pagou (R$ 100 entre 3: 33,34 para quem pagou e 33,33 para os outros). |
| Vários pagadores | Quem pagou mais que a sua parte recebe de quem pagou menos, na proporção do que adiantou. |
| Formas de dividir | Igual, valor exato, porcentagem, cotas e por item. Cada grupo escolhe quais permite. |
| Pagamento | Um toque em "Paguei" ou "Recebi". Dá para desfazer. Sem abatimento, "Acertar tudo" quita todas as dívidas com uma pessoa. "Cobrar" manda um aviso na hora (uma vez a cada 12 horas). |
| Papéis | Dono, admin e membro. O dono escolhe quem pode registrar gastos, editar gastos dos outros, mudar as configurações, convidar e remover pessoas. Cada um sempre edita os gastos que registrou. |
| Quem saiu | O grupo continua vendo a dívida como "Bia (saiu)". A Bia vê o que ficou em aberto na tela inicial e marca como pago. |
| Categorias e resumo | Cada gasto tem uma categoria. A aba Resumo mostra o mês contra a média, categorias, quem pagou o quê, gasto por mês, contas fixas no ano e os itens mais comprados no mercado. |
| Histórico | Gastos, pagamentos, entradas, saídas, papéis e mudanças de configuração ficam registrados. Dentro de cada gasto, a seção Alterações mostra o antes e o depois de cada campo, mesmo depois de pago. |
| Avisos | Gasto novo, pagamento marcado e gente nova no grupo geram um aviso para quem foi afetado (quem fez a ação não é avisado). |
| Lembretes | Todo dia às 9h o banco lembra quem está devendo, respeitando a frequência escolhida em cada grupo. |
| Recorrentes | Um gasto pode se repetir todo mês ou toda semana. O lançamento acontece sozinho e cada um pode ser editado depois. Contas de valor variável (luz, água) avisam quem pagou para preencher o valor do mês. |
| Notificações | Cada aviso também chega como notificação: no Android pelo app, no iPhone pela versão web instalada na Tela de Início. Liga e desliga em Sua conta. |
| Privacidade | Política de privacidade no app e botão "Excluir minha conta": nome, e-mail, aparelhos e avisos são apagados; os gastos ficam no histórico do grupo como "Conta excluída". |
| Convites | Depois de 8 códigos errados em 15 minutos, a pessoa precisa esperar para tentar de novo. |
| Cupom fiscal | O QR code da NFC-e (câmera, foto ou link colado) vira os itens da divisão "Por item". O desconto da nota é distribuído entre os itens. |

## Estrutura

```
src/app/                 telas (Expo Router)
  index.tsx              lista de grupos
  grupo/[id]/index.tsx   dívidas, gastos (busca e filtros), resumo com gráficos e histórico
  grupo/[id]/gasto.tsx   novo gasto, edição, alterações e comentários
src/components/          pedaços das telas (grupo/, gasto/, configuracoes/, inicio/) e ui.tsx
src/lib/banco.ts         tipos gerados do banco (npm run tipos:banco), não editar à mão
src/lib/consultas.ts     TanStack Query: chaves, consultas e "marcar como pago" otimista
src/lib/api.ts           chamadas ao Supabase
src/lib/divisao.ts       contas de divisão em centavos
src/lib/graficos.ts      contas dos gráficos do resumo
src/lib/permissoes.ts    papéis e permissões (a regra de verdade está no banco)
src/lib/erros.ts         registro de erros na tabela "erros"
supabase/migrations/     banco: tabelas, RLS, funções e triggers
supabase/functions/      Edge Functions (cupom, push e exclusão de conta)
supabase/testes/         testes do banco (05 é a lista revisada de funções liberadas)
testes/                  testes das contas e dos gráficos
e2e/                     testes de ponta a ponta (Playwright)
scripts/gerar-tipos.sh   gera src/lib/banco.ts a partir das migrações
public/                  manifesto e ícones da versão web
```

## Colocar no ar

### Como está publicado

| Parte | Onde | Situação |
| --- | --- | --- |
| Banco, login e funções | Supabase, projeto `super-organizador-3021` (São Paulo, ref `nhsglhdifpozrpotxypr`) | No ar |
| Site (iPhone e navegador) | Vercel, `racha-3021.vercel.app` (o endereço antigo `super-organizador-3021.vercel.app` continua funcionando) | No ar, publica sozinho a cada envio para `main` |
| APK do Android | Expo (EAS), conta `coelho_von`, workflow **Publicar** | Gerado pelo workflow (segredo `EXPO_TOKEN` no GitHub) |

Detalhes da produção:

- As migrações foram rodadas no **SQL Editor**, na ordem abaixo. Para uma migração nova, rode só ela no SQL Editor, ou use o workflow **Publicar** marcando "Atualizar banco" (precisa dos segredos `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` no GitHub).
- As funções foram publicadas pelo editor do painel (**Edge Functions > Deploy a new function > Via Editor**). No painel, cada função tem os arquivos compartilhados na mesma pasta (`cors.ts`, `nfce.ts`), importados com `./`.
- Os segredos `VAPID_CHAVE_PUBLICA`, `VAPID_CHAVE_PRIVADA`, `VAPID_CONTATO` e `PUSH_WEBHOOK_SEGREDO` estão em **Edge Functions > Secrets**. A chave pública também vai no `eas.json` e nas variáveis da Vercel.
- O webhook `enviar_push` (**Integrations > Database Webhooks**) chama a função `enviar-push` a cada aviso novo, com a chave anon legada no `Authorization` e o cabeçalho `x-segredo`.
- A Vercel (plano Hobby) só publica commits cujo e-mail de autor está ligado à conta do GitHub. Use o e-mail `174974297+ArthurCoelhovM@users.noreply.github.com` ou cadastre o seu e-mail no GitHub.
- O projeto assina os logins com chaves ECC (**Settings > JWT Keys**). A opção "Verify JWT with legacy secret" recusa esses logins, então ela fica desligada em `ler-nfce` e `excluir-conta`, que conferem o login no próprio código. Em `enviar-push` ela fica ligada.

### 1. Supabase

1. Crie um projeto grátis em supabase.com (região São Paulo).
2. Abra **SQL Editor** e rode, nesta ordem, o conteúdo de cada arquivo de `supabase/migrations/`:
   - `20261016000000_esquema_inicial.sql`
   - `20261016150000_avisos_lembretes_recorrentes.sql`
   - `20261016150100_agendamentos.sql` (agenda os lembretes e os recorrentes com pg_cron; se der erro de extensão, ative **pg_cron** em **Database > Extensions** e rode de novo)
   - `20261016170000_push_conta_convite.sql`
   - `20261016200000_correcoes_da_revisao.sql`
   - `20261016200100_agendamentos_limpeza.sql` (limpeza mensal de avisos antigos, também com pg_cron)
   - `20261112100000_arquitetura.sql` (permissões fechadas por padrão e tabela de erros)
   - `20261112110000_papeis_centavos_historico.sql` (papéis, centavos exatos, quem saiu; converte os valores antigos)
   - `20261112120000_cobrar.sql`
   - `20261112130000_funcionalidades.sql` (categorias, valor variável, busca, arquivar, apelido, comprovante, comentários, meus dados)
   - `20261117100000_conferir_pix_passos.sql` (extrato e conferência do grupo, chave Pix, primeiros passos)
   - `20261118100000_desfazer_metas_privacidade.sql` (desfazer, metas por categoria, busca em todos os grupos; o perfil deixa de guardar o e-mail)

   Se você já tinha rodado os primeiros, rode só os que faltam, na ordem. Com a CLI, `npx supabase db push` faz isso sozinho.
3. Em **Authentication > Sign In / Providers > Email**, desligue **Confirm email**. O envio de e-mail padrão do Supabase só entrega para pessoas da equipe do projeto e no máximo 2 por hora, então seus amigos não receberiam a confirmação. Para recuperar senha por e-mail, configure um SMTP próprio (Brevo e Resend têm plano grátis) em **Authentication > Emails > SMTP Settings**.
4. Em **Authentication > URL Configuration**, coloque o endereço da versão web em **Site URL** e adicione `https://SEU-ENDERECO/**` em **Redirect URLs**.
5. Copie a URL do projeto e a **publishable key** (botão **Connect** ou **Project Settings > API Keys**).

### 1b. Leitura do cupom fiscal (Edge Function)

O navegador não pode consultar o site da Sefaz direto, então quem consulta é uma Edge Function do Supabase. Para publicar:

```bash
npx supabase login
npx supabase link --project-ref SEU-PROJETO
npx supabase functions deploy ler-nfce
```

A função só aceita links de sites `.gov.br` com os parâmetros da NFC-e e só atende usuários logados. Ela lê o modelo de página usado pela maioria dos estados (tabela `tabResult`). Se algum estado usar outro formato, o app avisa e a pessoa digita os itens.

### 1c. Notificações push e exclusão de conta

1. Gere as chaves das notificações do navegador:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Guarde os segredos das funções (invente um segredo longo para o webhook):
   ```bash
   npx supabase secrets set VAPID_CHAVE_PUBLICA=... VAPID_CHAVE_PRIVADA=... VAPID_CONTATO=mailto:seu@email.com PUSH_WEBHOOK_SEGREDO=...
   npx supabase functions deploy enviar-push --no-verify-jwt
   npx supabase functions deploy excluir-conta
   ```
3. No painel do Supabase, abra **Database Webhooks** e crie um webhook na tabela `avisos`, evento **Insert**, do tipo HTTP Request (POST) para `https://SEU-PROJETO.supabase.co/functions/v1/enviar-push`, com o cabeçalho `x-segredo` igual ao `PUSH_WEBHOOK_SEGREDO`.
4. Coloque a chave pública em `EXPO_PUBLIC_VAPID_PUBLIC_KEY` (no `.env`, na Vercel e no `eas.json`).
5. **Android:** rode `npx eas-cli@latest init` para ligar o app a um projeto no expo.dev e cadastre as credenciais do Firebase (FCM V1) no EAS, seguindo o guia "Add Android FCM V1 credentials" da documentação do Expo. No Expo Go as notificações não funcionam; só no APK.
6. **iPhone:** a pessoa instala o app pela Tela de Início (Safari, Compartilhar, Adicionar à Tela de Início), abre por lá e liga em **Sua conta**.

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

O GitHub roda tudo isso sozinho a cada envio de código (`.github/workflows/testes.yml`).

```bash
npm run testes          # contas de divisão, centavos e gráficos
npm run tipos           # TypeScript
npm run lint
npm run testes:banco    # precisa de um Postgres local: PGHOST, PGPORT e PGUSER
npm run tipos:banco     # gera src/lib/banco.ts (mesmo Postgres); rode depois de mudar uma migração
npm run e2e             # ponta a ponta: precisa do Supabase local (supabase start) e de npm run e2e:web
```

No GitHub também roda o job **Ponta a ponta**: `supabase start`, a versão web apontando para ele e os testes do Playwright.

Toda função nova do banco nasce fechada. Para liberar uma função para o app, dê o `grant` na migração e acrescente a assinatura em `supabase/testes/05_permissoes.sql`; sem isso, os testes do banco falham.

Erros inesperados do app ficam na tabela `erros` (Supabase > Table Editor), com a tela, a plataforma e a versão.

## Ainda falta

- Testar a entrega das notificações em celulares de verdade (os testes usam serviços de push simulados).
- Cartão de primeiro uso explicando o abatimento direto (anotado na segunda revisão).
- O envio de e-mail padrão do Supabase só entrega para a equipe do projeto: configurar um SMTP antes de chamar o grupo.
- Conferir a leitura do cupom com notas reais de cada estado que o grupo usa (os testes usam páginas-modelo).
