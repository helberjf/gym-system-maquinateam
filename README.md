# Maquina Team Gym System

Plataforma full-stack para academia de luta com site publico moderno, autenticacao completa, operacao interna por perfil e modulos de alunos, professores, modalidades, turmas, presenca, financeiro, produtos, vendas, e-commerce, treinos, avisos, dashboards e relatorios.

## Status

Fase 11 concluida.

O produto agora entrega:

- site publico modernizado em preto e branco
- login, cadastro, confirmacao de e-mail e reset de senha
- dashboard por perfil com areas privadas protegidas
- modulos operacionais da academia
- financeiro principal com inadimplencia
- produtos, vendas e upload em Cloudflare R2
- e-commerce completo com catalogo publico, carrinho, checkout, frete, cupons e pedidos
- treinos e avisos
- dashboards administrativos e relatorios com CSV
- smoke tests para fluxos centrais

## Stack

- Next.js 16
- TypeScript
- PostgreSQL
- Prisma ORM
- Auth.js v5
- bcryptjs
- Mailgun
- Upstash Redis
- Mercado Pago
- AbacatePay
- Cloudflare R2
- Zod
- Tailwind CSS
- Vitest
- Sonner

## Perfis e permissoes

- `ADMIN`: acesso total
- `RECEPCAO`: operacao de alunos, turmas, presenca, financeiro, produtos, vendas e relatorios
- `PROFESSOR`: turmas, presenca relacionada, treinos e avisos
- `ALUNO`: painel proprio com plano, pagamentos, presenca, treinos e avisos

## Rotas principais

Publico:

- `GET /`
- `GET /home`
- `GET /loja`
- `GET /loja/[slug]`
- `GET /carrinho`
- `GET /checkout`
- `GET /checkout/sucesso`
- `GET /checkout/falha`
- `GET /checkout/pix`
- `GET /planos`
- `GET /planos/sucesso`
- `GET /planos/falha`
- `GET /planos/pix`
- `GET /contato`
- `GET /faq`
- `GET /login`
- `GET /cadastro`
- `GET /confirmar-email`
- `GET /reenvio-confirmacao`
- `GET /esqueci-senha`
- `GET /redefinir-senha/[token]`

Privado:

- `GET /dashboard`
- `GET /dashboard/admin`
- `GET /dashboard/alunos`
- `GET /dashboard/professores`
- `GET /dashboard/modalidades`
- `GET /dashboard/turmas`
- `GET /dashboard/presenca`
- `GET /dashboard/planos`
- `GET /dashboard/assinaturas`
- `GET /dashboard/pagamentos`
- `GET /dashboard/produtos`
- `GET /dashboard/vendas`
- `GET /dashboard/pedidos`
- `GET /dashboard/pedidos/[id]`
- `GET /dashboard/pedidos-loja`
- `GET /dashboard/pedidos-loja/[id]`
- `GET /dashboard/cupons`
- `GET /dashboard/treinos`
- `GET /dashboard/avisos`
- `GET /dashboard/relatorios`

APIs importantes:

- `POST /api/auth/register`
- `POST /api/auth/forgot-password`
- `POST /api/auth/resend-verification`
- `POST /api/auth/reset-password`
- `POST /api/attendance/check-in`
- `POST /api/attendance/check-out`
- `POST /api/training-assignments`
- `POST /api/uploads/product-images`
- `GET /api/store/cart`
- `POST /api/store/cart/items`
- `PATCH /api/store/cart/items/[itemId]`
- `POST /api/store/coupon`
- `POST /api/store/shipping/quote`
- `POST /api/store/checkout`
- `POST /api/plans/[id]/checkout`
- `GET /api/payments/pix/status`
- `POST /api/mercadopago/webhook`
- `POST /api/store/coupons`
- `PATCH /api/store/orders/[id]/status`
- `GET /api/reports/export`

## Arquitetura final

### 1. Camada de dominio

As regras principais ficaram separadas por contexto:

- `src/lib/auth`
- `src/lib/academy`
- `src/lib/billing`
- `src/lib/commerce`
- `src/lib/store`
- `src/lib/training`
- `src/lib/reports`

Cada modulo concentra regras, filtros, consultas e mutacoes sem jogar tudo dentro de handlers gigantes.

### 2. Camada transversal

- `src/lib/permissions`: matriz central de permissoes
- `src/lib/rate-limit`: perfis reutilizaveis e pronto para Vercel via Upstash
- `src/lib/validators`: validacao centralizada com Zod
- `src/lib/errors`: respostas e erros consistentes
- `src/lib/audit`: trilha minima de auditoria
- `src/lib/mail`: envio de e-mails com Mailgun
- `src/lib/uploads`: integracao com Cloudflare R2

### 3. Banco e persistencia

- Prisma modela auth, operacao, financeiro, vendas, loja, treinos e auditoria
- PostgreSQL e a fonte principal de dados
- seed inicial cria perfis, modalidades, planos, alunos, assinaturas, pagamentos, produtos, vendas, cupons, enderecos, pedidos, treinos e avisos

### 4. Frontend

- App Router com rotas publicas, auth e dashboard
- componentes reutilizaveis para formularios, metricas, estados vazios e graficos simples
- toasts com Sonner
- loadings de rota e telas de erro/not-found

## Modulos implementados

### Publico

- home moderna com branding da academia
- pagina de planos
- pagina de contato
- pagina de FAQ
- CTA para WhatsApp e Instagram
- navegacao clara para login, cadastro e dashboard

### Auth

- login com Google
- login com credentials
- cadastro com hash de senha
- confirmacao de e-mail
- reenvio de confirmacao
- forgot password
- reset password
- sessao com role

### Operacao

- CRUD de alunos
- CRUD de professores
- CRUD de modalidades
- CRUD de turmas/horarios
- check-in/check-out
- historico e filtros de presenca

### Financeiro

- CRUD de planos
- CRUD de assinaturas
- pagamentos e mensalidades
- pagamento online inicial de planos com Mercado Pago e Pix via AbacatePay
- inadimplencia
- resumo financeiro do aluno

### Produtos e vendas

- CRUD de produtos
- galeria de imagens
- upload em Cloudflare R2
- vendas internas
- baixa automatica de estoque
- alerta de estoque baixo

### E-commerce da loja

- CTA publica da loja integrada na home
- catalogo publico com busca, filtros e ordenacao
- pagina de detalhe de produto
- carrinho server-side para visitante e usuario autenticado
- merge de carrinho no login
- checkout com endereco, frete, cupom e redirecionamento ao gateway correto
- Pix com AbacatePay para produtos e planos, incluindo tela de QR Code e polling de status
- frete interno com retirada, entrega local e envio padrao
- CRUD administrativo de cupons
- pedidos com snapshot de itens, status, reconciliacao de pagamento e webhook
- historico de pedidos para o cliente
- operacao administrativa de pedidos e atualizacao de status
- movimentos de estoque e restauracao no cancelamento

### Treinos e comunicacao

- modelos de treino
- duplicacao de modelo
- atribuicao para um ou mais alunos
- leitura e conclusao pelo aluno
- avisos por role

### Dashboards e relatorios

- dashboard do aluno
- dashboard do professor
- dashboard da recepcao
- dashboard administrativo
- relatorios de presenca, pagamentos, inadimplencia, faturamento, vendas e estoque baixo
- exportacao CSV protegida

## Seguranca

Camadas aplicadas:

- auth com Auth.js v5
- hash de senha com bcryptjs
- confirmacao de e-mail obrigatoria para credentials
- reset de senha com token seguro de uso unico
- autorizacao por role em middleware, servidor e handlers
- rate limit em auth, uploads, mutacoes, admin e relatorios
- rate limit em carrinho, cupom, checkout, CRUD de cupom e status de pedidos
- logs minimos de auditoria
- validacao centralizada com Zod

Rate limit aplicado hoje em:

- cadastro
- login
- reenvio de confirmacao
- forgot password
- reset password
- uploads
- planos
- produtos
- pagamentos
- check-in/check-out
- treinos
- turmas
- carrinho e checkout
- validacao de cupom
- CRUD de cupons
- atualizacao de status de pedidos
- endpoints administrativos
- exportacao de relatorios

## Testes

Smoke tests adicionados com Vitest:

- cadastro
- login com credentials
- confirmacao de e-mail
- forgot password
- reset password
- autorizacao por role
- check-in duplicado
- atribuicao de treino com conflito
- pontos centrais de rate limit

Comandos:

```bash
npm run test
npm run test:run
npm run typecheck
```

## Setup local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar ambiente

Copie:

```bash
cp .env.example .env.local
```

Variaveis principais:

- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET`
- `AUTH_URL`
- `AUTH_TRUST_HOST`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- `MAILGUN_FROM`
- `MAILGUN_API_BASE_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `MP_ACCESS_TOKEN`
- `MP_PUBLIC_KEY`
- `MP_INTEGRATOR_ID`
- `MP_MAX_INSTALLMENTS`
- `MP_WEBHOOK_SECRET`
- `MP_WEBHOOK_ALLOWED_IPS`
- `MP_STORE_STATEMENT_DESCRIPTOR`
- `MP_PLAN_STATEMENT_DESCRIPTOR`
- `ABACATEPAY_API_KEY`
- `ABACATEPAY_BASE_URL`
- `R2_ACCOUNT_ID`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`
- `NEXT_PUBLIC_R2_PUBLIC_URL`
- `NEXT_PUBLIC_APP_URL`

### 3. Prisma

```bash
npm run db:format
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

Para Supabase/Vercel, use o fluxo com `DIRECT_URL` para schema:

```bash
npm run db:status
npm run db:migrate:deploy
```

### 4. Rodar o app

```bash
npm run dev
```

### 5. Validacoes uteis

```bash
npx tsc --noEmit
npm run test:run
npm run build
npm exec prisma validate
```

## PostgreSQL, Prisma e Supabase

- use `DATABASE_URL` para runtime da aplicacao
- use `DIRECT_URL` para `db push`, migrations e seed controlado
- em desenvolvimento local, `prisma migrate dev`
- em ambiente Supabase, prefira `npm run db:migrate:deploy`
- para regenerar seed local, `npm run db:seed`
- para inspecao manual, `npm run db:studio`
- guia detalhado: `docs/SUPABASE_SETUP.md`

Seed inicial:

- 1 admin
- 1 recepcao
- 1 professor
- 3 alunos
- modalidades base
- turmas e matriculas
- planos
- assinaturas
- pagamentos
- produtos e vendas
- templates de treino
- avisos
- logs de auditoria

Credenciais de seed:

- Admin: `admin@maquinateam.com.br`
- Recepcao: `recepcao@maquinateam.com.br`
- Professor: `ricardo.alves@maquinateam.com.br`
- Aluno exemplo: `alice.nogueira@maquinateam.com.br`

Senhas:

- `SEED_ADMIN_PASSWORD`
- `SEED_STAFF_PASSWORD`
- `SEED_STUDENT_PASSWORD`

## Auth.js e Google OAuth

Para Google:

1. crie um projeto no Google Cloud
2. habilite OAuth consent screen
3. crie credenciais OAuth Web
4. configure redirect URI:

```txt
http://localhost:3000/api/auth/callback/google
https://seu-dominio.vercel.app/api/auth/callback/google
```

5. preencha:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## Mailgun

Para e-mail transacional:

1. configure dominio no Mailgun
2. valide remetente
3. preencha:

- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- `MAILGUN_FROM`
- `MAILGUN_API_BASE_URL`

Fluxos cobertos:

- confirmacao de e-mail
- reenvio de confirmacao
- forgot password
- reset password

## Cloudflare R2

Para uploads:

1. crie o bucket
2. gere access key e secret
3. configure endpoint ou account id
4. configure URL publica

Variaveis:

- `R2_ACCOUNT_ID`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`
- `NEXT_PUBLIC_R2_PUBLIC_URL`

O upload de imagens de produto:

- valida tipo
- valida tamanho
- protege com auth, permissao e rate limit
- salva `url` e `storageKey`

## Deploy na Vercel

Passos recomendados:

1. suba o repositorio
2. conecte o projeto na Vercel
3. configure todas as envs do `.env.example`
4. aponte `AUTH_URL` e `NEXT_PUBLIC_APP_URL` para o dominio final
5. configure PostgreSQL de producao
6. configure Upstash Redis para rate limit distribuido
7. configure bucket R2 e Mailgun
8. rode migrate/seed no ambiente adequado

Observacoes:

- sem Upstash, o fallback de rate limit fica local por instancia
- em producao, prefira sempre Redis distribuido
- use um dominio final consistente para Auth.js, Google OAuth e links de e-mail

## O que foi reaproveitado do legado

- branding da academia
- identidade verbal da Maquina Team
- imagens e referencias visuais principais
- base publica de conteudo de FAQ
- tabela publica de planos e frequencias
- ideia de CTA direto para WhatsApp

## O que foi removido do legado

- paginas HTML soltas
- fluxo visual fragmentado
- dependencias de tela sem integracao com o sistema
- textos com estrutura repetitiva e layout menos responsivo
- pontos de cadastro/comercial nao conectados ao painel real

## Melhorias futuras opcionais

- cobranca recorrente automatizada
- webhook financeiro mais completo
- dashboard com graficos mais avancados
- exportacao XLSX e PDF
- calendario operacional com agenda visual
- notificacoes in-app
- area publica com blog e SEO mais forte
- observabilidade com tracing e alertas
- cobertura de testes E2E com Playwright

## Resumo final da arquitetura

O projeto terminou como uma plataforma modular. O site publico capta e orienta o aluno. A camada de autenticacao controla entrada, confirmacao de e-mail e recuperacao de senha. O dominio e separado por contexto de negocio. O banco Prisma/PostgreSQL sustenta as entidades centrais. A camada transversal garante rate limit, permissoes, validacao e auditoria. O dashboard muda conforme o papel do usuario. Os relatorios consolidam operacao, financeiro e vendas. O resultado e um produto coerente, reaproveitavel e pronto para evolucao.
