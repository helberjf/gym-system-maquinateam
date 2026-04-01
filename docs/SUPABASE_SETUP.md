# Guia Completo: Configurando o Supabase com este Projeto

Este guia ensina passo a passo como criar um projeto no Supabase, obter as credenciais e configurar tudo para funcionar com este sistema (Next.js + Prisma 7 + PostgreSQL).

---

## Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Criando uma conta no Supabase](#2-criando-uma-conta-no-supabase)
3. [Criando o projeto](#3-criando-o-projeto)
4. [Obtendo as URLs de conexão](#4-obtendo-as-urls-de-conexão)
5. [Configurando o .env.local](#5-configurando-o-envlocal)
6. [Enviando as tabelas para o Supabase](#6-enviando-as-tabelas-para-o-supabase)
7. [Rodando o Seed (dados iniciais)](#7-rodando-o-seed-dados-iniciais)
8. [Configurando na Vercel (produção)](#8-configurando-na-vercel-produção)
9. [Entendendo a arquitetura de conexão](#9-entendendo-a-arquitetura-de-conexão)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Pré-requisitos

- **Node.js** 18+ instalado
- **npm** ou **yarn**
- Dependências do projeto instaladas (`npm install`)
- Uma conta no [Supabase](https://supabase.com) (gratuita)

---

## 2. Criando uma conta no Supabase

1. Acesse [https://supabase.com](https://supabase.com)
2. Clique em **"Start your project"**
3. Faça login com **GitHub** (recomendado) ou crie uma conta com email/senha
4. Após o login, você será redirecionado para o **Dashboard**

---

## 3. Criando o projeto

1. No Dashboard, clique em **"New Project"**
2. Preencha:
   - **Organization**: selecione sua org (ou crie uma nova)
   - **Name**: nome do seu projeto (ex: `minha-loja`)
   - **Database Password**: crie uma senha forte — **ANOTE ESSA SENHA!** Você vai precisar dela
   - **Region**: escolha a região mais próxima dos seus usuários (ex: `South America (São Paulo) - sa-east-1`)
   - **Pricing Plan**: Free tier é suficiente para desenvolvimento
3. Clique em **"Create new project"**
4. Aguarde ~2 minutos para o projeto ser provisionado

> ⚠️ **IMPORTANTE**: Guarde a senha do banco de dados. Ela NÃO pode ser recuperada depois. Se perder, terá que resetar.

---

## 4. Obtendo as URLs de conexão

Após o projeto estar pronto:

1. No menu lateral, vá em **Project Settings** (ícone de engrenagem)
2. Clique em **Database**
3. Role até a seção **"Connection string"**

Você verá duas abas importantes:

### 4.1. Transaction Pooler (para a aplicação)

Selecione a aba **"Transaction"** e copie a **Connection string**. Ela terá este formato:

```
postgresql://postgres.[PROJECT_REF]:[SUA_SENHA]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres
```

**Características:**
- Porta **6543**
- Usa PgBouncer (connection pooler)
- Ideal para a aplicação em **produção** e **desenvolvimento**
- Suporta muitas conexões simultâneas
- **NÃO suporta** DDL (CREATE TABLE, ALTER TABLE, migrations)

### 4.2. Direct Connection (para migrations)

Selecione a aba **"Direct"** e copie a **Connection string**. Ela terá este formato:

```
postgresql://postgres.[PROJECT_REF]:[SUA_SENHA]@db.[PROJECT_REF].supabase.co:5432/postgres
```

**Características:**
- Porta **5432**
- Conexão direta ao PostgreSQL (sem pooler)
- Necessária para **migrations** e **db push** (operações de schema)
- Limite de conexões simultâneas menor

> 💡 **Dica**: Se sua senha tiver caracteres especiais (como `@`, `#`, `!`), eles precisam ser **URL-encoded**. Por exemplo, `@` vira `%40`.

---

## 5. Configurando o .env.local

1. Na raiz do projeto, copie o arquivo `.env.example` para `.env.local`:

```bash
cp .env.example .env.local
```

2. Abra `.env.local` e preencha as duas URLs do banco de dados:

```env
# Transaction Pooler - usado pela aplicação (runtime)
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[SUA_SENHA]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"

# Direct Connection - usado para migrations e db push
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[SUA_SENHA]@db.[PROJECT_REF].supabase.co:5432/postgres?sslmode=require"
```

**Substitua:**
- `[PROJECT_REF]` → o identificador do seu projeto (ex: `vsudlfipaxpjopevexkd`)
- `[SUA_SENHA]` → a senha que você definiu ao criar o projeto (URL-encoded se tiver caracteres especiais)

### Onde encontrar o PROJECT_REF?

- No Dashboard do Supabase, vá em **Project Settings** > **General**
- O **Reference ID** é o seu `PROJECT_REF`
- Ele também aparece na URL do dashboard: `https://supabase.com/dashboard/project/[PROJECT_REF]`

### Exemplo real (com dados fictícios):

```env
DATABASE_URL="postgresql://postgres.abcdefghijklmnop:MinhaSenh%40123@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"

DIRECT_URL="postgresql://postgres.abcdefghijklmnop:MinhaSenh%40123@db.abcdefghijklmnop.supabase.co:5432/postgres?sslmode=require"
```

> Note que `@` na senha virou `%40`

---

## 6. Enviando as tabelas para o Supabase

O schema deste projeto está definido em `prisma/schema.prisma`. Para criar todas as tabelas no Supabase, é necessário usar a **URL direta** (porta 5432).

### Opção A: Usando db push (recomendado para setup inicial)

```bash
# Windows (PowerShell)
node -e "require('dotenv').config({path:'.env.local'}); const {execSync}=require('child_process'); execSync('npx prisma db push', {stdio:'inherit', env:{...process.env, DATABASE_URL: process.env.DIRECT_URL}})"
```

```bash
# Linux / macOS
DATABASE_URL=$(grep DIRECT_URL .env.local | cut -d'"' -f2) npx prisma db push
```

### Opção B: Usando migrations

```bash
# Windows (PowerShell)
node -e "require('dotenv').config({path:'.env.local'}); const {execSync}=require('child_process'); execSync('npx prisma migrate deploy', {stdio:'inherit', env:{...process.env, DATABASE_URL: process.env.DIRECT_URL}})"
```

```bash
# Linux / macOS
DATABASE_URL=$(grep DIRECT_URL .env.local | cut -d'"' -f2) npx prisma migrate deploy
```

### Saída esperada:

```
Prisma schema loaded from prisma/schema.prisma.
Datasource "db": PostgreSQL database "postgres", schema "public" at "aws-1-sa-east-1.pooler.supabase.com:5432"

Your database is now in sync with your Prisma schema. Done in 4.37s
```

> ✅ Após isso, todas as tabelas estarão criadas no seu Supabase. Você pode verificar no Dashboard > **Table Editor**.

---

## 7. Rodando o Seed (dados iniciais)

O seed cria dados de exemplo: usuários, produtos, serviços, pedidos, etc.

```bash
# Windows (PowerShell)
node -e "require('dotenv').config({path:'.env.local'}); const {execSync}=require('child_process'); execSync('npx tsx prisma/seed.ts', {stdio:'inherit', env:{...process.env, DATABASE_URL: process.env.DIRECT_URL}})"
```

```bash
# Linux / macOS
DATABASE_URL=$(grep DIRECT_URL .env.local | cut -d'"' -f2) npx tsx prisma/seed.ts
```

### Credenciais criadas pelo seed:

| Perfil   | Email                  | Senha       |
|----------|------------------------|-------------|
| Admin    | admin@applestore.com   | Admin@123   |
| Staff    | lucas@applestore.com   | Staff@123   |
| Staff    | fernanda@applestore.com| Staff@123   |
| Cliente  | joao@example.com       | Cliente@123 |
| Cliente  | maria@example.com      | Cliente@123 |

---

## 8. Configurando na Vercel (produção)

### 8.1. Variáveis de ambiente

No painel da Vercel, vá em **Settings** > **Environment Variables** e adicione:

| Variável       | Valor                           | Ambientes              |
|----------------|---------------------------------|------------------------|
| `DATABASE_URL` | URL do Transaction Pooler (6543)| Production, Preview    |
| `DIRECT_URL`   | URL da Direct Connection (5432) | Production, Preview    |
| `AUTH_SECRET`   | string aleatória longa          | Production, Preview    |
| `NEXTAUTH_URL` | https://seu-dominio.vercel.app  | Production             |

> Adicione também todas as outras variáveis listadas em `.env.example` que sejam necessárias para o seu ambiente.

### 8.2. Build Command

O script de build do projeto **não** executa migrations (isso é intencional):

```json
"build": "prisma generate && next build"
```

Migrations devem ser executadas **separadamente** — nunca durante o build da Vercel.

### 8.3. Rodando migrations em produção

Execute localmente apontando para o banco de produção:

```bash
# Defina temporariamente a URL direta de produção
DATABASE_URL="postgresql://postgres.[REF]:[SENHA]@db.[REF].supabase.co:5432/postgres?sslmode=require" npx prisma migrate deploy
```

Ou configure um **Deploy Hook / CI pipeline** separado para executar migrations.

---

## 9. Entendendo a arquitetura de conexão

```
┌─────────────────────────────────────────────────────┐
│                    Sua Aplicação                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  lib/prisma.ts (PrismaPg adapter)                   │
│  └─ DATABASE_URL (pooler:6543)                      │
│     └─ Conexão via PgBouncer                        │
│        └─ Suporte a muitas conexões simultâneas     │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  prisma db push / migrate (schema)                  │
│  └─ DIRECT_URL (direct:5432)                        │
│     └─ Conexão direta ao PostgreSQL                 │
│        └─ Necessário para DDL (CREATE/ALTER TABLE)  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Por que duas URLs?

| Aspecto         | Pooler (6543)           | Direta (5432)         |
|-----------------|-------------------------|-----------------------|
| **Uso**         | Aplicação (queries)     | Migrations/schema     |
| **Protocolo**   | PgBouncer               | PostgreSQL nativo     |
| **DDL**         | ❌ Não suporta          | ✅ Suporta            |
| **Conexões**    | ✅ Muitas (pooled)      | ⚠️ Limitadas          |
| **Performance** | ✅ Melhor para apps     | ⚠️ Conexão por req.  |

### Arquivos de configuração relevantes:

| Arquivo              | Função                                                |
|----------------------|-------------------------------------------------------|
| `prisma.config.ts`   | Configura datasource URL para o Prisma 7              |
| `prisma/schema.prisma` | Define modelos/tabelas do banco de dados            |
| `lib/prisma.ts`      | Singleton do PrismaClient com adapter PrismaPg        |
| `.env.local`         | Variáveis de ambiente (credenciais)                   |
| `.env.example`       | Template com todas as variáveis necessárias           |

---

## 10. Troubleshooting

### Erro: P1001 — Can't reach database server

**Causa**: URL de conexão incorreta ou banco não acessível.

**Soluções**:
- Verifique se o `[PROJECT_REF]` está correto
- Verifique se a senha está URL-encoded
- Confirme a região na URL (ex: `aws-1-sa-east-1`)
- Verifique se o projeto Supabase está ativo (não pausado)

### Erro: prepared statement "s0" already exists

**Causa**: Você está rodando migrations/schema push pela URL do pooler (6543).

**Solução**: Use sempre a `DIRECT_URL` (porta 5432) para operações de schema:

```bash
# Use DIRECT_URL no lugar de DATABASE_URL para migrations
node -e "require('dotenv').config({path:'.env.local'}); const {execSync}=require('child_process'); execSync('npx prisma db push', {stdio:'inherit', env:{...process.env, DATABASE_URL: process.env.DIRECT_URL}})"
```

### Erro: password authentication failed

**Causa**: Senha incorreta ou não está URL-encoded.

**Solução**:
- No Supabase Dashboard > **Project Settings** > **Database** > clique em **"Reset database password"**
- Use a nova senha e lembre de fazer URL-encode de caracteres especiais:
  - `@` → `%40`
  - `#` → `%23`
  - `!` → `%21`
  - `$` → `%24`
  - `&` → `%26`

### Erro: relation "User" does not exist

**Causa**: As tabelas ainda não foram criadas no banco.

**Solução**: Execute o `db push` conforme a [Seção 6](#6-enviando-as-tabelas-para-o-supabase).

### Projeto Supabase pausado

Projetos no plano gratuito são pausados após **1 semana de inatividade**.

**Solução**: Acesse o Dashboard e clique em **"Restore project"**.

### Verificando as tabelas no Supabase

1. Acesse o Dashboard do seu projeto
2. No menu lateral, clique em **"Table Editor"**
3. Você deve ver todas as tabelas criadas (User, Product, Order, etc.)
4. Também pode usar o **"SQL Editor"** para queries manuais:

```sql
-- Listar todas as tabelas
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Contar usuários
SELECT COUNT(*) FROM "User";

-- Ver produtos
SELECT id, name, price FROM "Product" LIMIT 10;
```

---

## Resumo Rápido (Cheat Sheet)

```bash
# 1. Copiar variáveis de ambiente
cp .env.example .env.local

# 2. Preencher DATABASE_URL e DIRECT_URL no .env.local

# 3. Instalar dependências
npm install

# 4. Criar tabelas no Supabase (Windows)
node -e "require('dotenv').config({path:'.env.local'}); const {execSync}=require('child_process'); execSync('npx prisma db push', {stdio:'inherit', env:{...process.env, DATABASE_URL: process.env.DIRECT_URL}})"

# 5. Rodar seed
node -e "require('dotenv').config({path:'.env.local'}); const {execSync}=require('child_process'); execSync('npx tsx prisma/seed.ts', {stdio:'inherit', env:{...process.env, DATABASE_URL: process.env.DIRECT_URL}})"

# 6. Iniciar o servidor
npm run dev
```

---

*Última atualização: Fevereiro 2026*
