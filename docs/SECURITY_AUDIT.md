# 🔒 Auditoria de Segurança Completa

**Data da Auditoria Original:** Junho 2025  
**Última Revisão (Remediação Completa):** Março 2026  
**Projeto:** E-commerce Next.js + Prisma + Supabase  
**Escopo:** 6 checklists — Rate Limiting, Proteção de Rotas, Acesso/Autorização, Banco de Dados, Validação de Entrada, Segurança Geral

---

## 📊 Pontuação Final: 9.0 / 10 (anterior: 6.5 → 4.5)

| Categoria | Nota | Revisão Anterior | Auditoria Original | Peso |
|-----------|------|-----------------|---------------------|------|
| Rate Limiting | 9/10 | 5/10 | 3/10 | Alto |
| Proteção de Rotas | 9.5/10 | 6/10 | 3/10 | Crítico |
| Acesso e Autorização | 9.5/10 | 7/10 | 4/10 | Crítico |
| Banco de Dados | 9/10 | 7/10 | 7/10 | Alto |
| Validação de Entrada | 9/10 | 7/10 | 6/10 | Alto |
| Segurança Geral | 8.5/10 | 6/10 | 4/10 | Médio |

**Progresso total:** 31 vulnerabilidades identificadas → 28 corrigidas, 3 itens residuais de baixo risco.

---

## 1️⃣ Rate Limiting

### ✅ CORRIGIDO — Rate limit fail-closed sem `X-Forwarded-For`
**Arquivo:** `lib/rate-limit.ts`  
**Antes:** Retornava `{ allowed: true }` quando IP era desconhecido — bypass completo.  
**Agora:** Retorna `{ allowed: false, retryAfter }` quando IP é `"unknown"`. Comportamento fail-closed que bloqueia requisições sem IP identificável.

### ✅ CORRIGIDO — Registro com rate limiting
**Arquivo:** `app/api/register/route.ts`  
Rate limit: 5 req/15min com `Retry-After` header.

### ✅ CORRIGIDO — Rate limit no contato
**Arquivo:** `app/api/contact/route.ts`  
Rate limit: 5 req/min com `Retry-After` header.

### ✅ CORRIGIDO — Rate limit em criação de agendamentos
**Arquivos:** `app/api/schedules/create/route.ts`, `app/api/schedules/create-validated/route.ts`  
Rate limit adicionado: 10 req/15min por IP. Protege contra slot-filling DoS.

### ✅ CORRIGIDO — Rate limit em verify-email
**Arquivo:** `app/api/verify-email/route.ts`  
Rate limit adicionado: 10 req/15min. Combinado com token hashing (SHA-256), brute-force é inviável.

### ✅ CORRIGIDO — Rate limit em `shipping/calculate`
**Arquivo:** `app/api/shipping/calculate/route.ts`  
Rate limit adicionado: 30 req/min. Protege a cota da API do Melhor Envio.

### ✅ CORRIGIDO — Rate limit em `paid-session` e `free-call`
**Arquivos:** `app/api/paid-session/route.ts` (10 req/15min), `app/api/free-call/route.ts` (5 req/15min)  
Ambos agora protegidos contra spam.

### ✅ CORRIGIDO — Rate limit em `cep`
**Arquivo:** `app/api/cep/route.ts`  
Rate limit adicionado: 30 req/min. Protege proxy ViaCEP contra abuso.

### ✅ CORRIGIDO — Rate limit em `consulting-plan/create-payment`
**Arquivo:** `app/api/consulting-plan/create-payment/route.ts`  
Rate limit adicionado: 10 req/15min. Protege contra criação excessiva de pedidos/preferências.

### 🟡 BAIXO — Rate limit in-memory (não distribuído)
**Arquivo:** `lib/rate-limit.ts`  
O Map em memória é zerado a cada restart e não funciona em ambientes com múltiplas instâncias (Vercel serverless). **Mitigação:** Para migrar para distribuído seria necessário adicionar Redis/Upstash como dependência. Risco reduzido agora que o comportamento é fail-closed.

### 🟢 OK — forgot-password e reset-password
5 req/15min com hashed tokens e `Retry-After` header. Bem implementado.

### 🟢 OK — MercadoPago webhook
60 req/min com rate limiting + HMAC signature + IP allowlist.

---

## 2️⃣ Proteção de Rotas

### ✅ CORRIGIDO — `proxy.ts` criado (proteção centralizada)
**Arquivo:** `proxy.ts`  
Middleware centralizado criado (usando `proxy.ts`, padrão de middleware no Next.js versão mais recente) com as seguintes proteções:
- **Páginas protegidas:** `/dashboard`, `/checkout`, `/wishlist`, `/order`, `/schedules` — redireciona para `/login` se não autenticado
- **APIs protegidas:** `/api/admin/*`, `/api/notifications`, `/api/wishlist`, `/api/paid-session`, `/api/me`, `/api/users` — retorna 401 se não autenticado
- **Admin enforced:** `/api/admin/*` verifica `session.user.role === "ADMIN"` — retorna 403 se não admin
- **Auth redirect:** Usuários logados acessando `/login`, `/register`, etc. são redirecionados para `/dashboard`
- **Matcher:** Exclui assets estáticos (`_next/static`, `_next/image`, `favicon.ico`, etc.)

### ✅ CORRIGIDO — `webhooks/schedules` PUT com verificação
**Arquivo:** `app/api/webhooks/schedules/route.ts`  
**Antes:** PUT handler não tinha nenhuma verificação — qualquer pessoa podia consultar status de agendamentos.  
**Agora:** PUT handler usa mesma verificação do POST: `x-webhook-secret` + `crypto.timingSafeEqual`.

### ✅ CORRIGIDO — `schedules/assign` com autenticação
**Arquivo:** `app/api/schedules/assign/route.ts`  
Usa `requireAdmin()` com verificação correta do retorno.

### ✅ CORRIGIDO — Funcionários requerem autenticação
**Arquivo:** `app/api/schedules/employees/route.ts`  
**Antes:** Lista de funcionários acessível a qualquer visitante anônimo.  
**Agora:** Requer `auth()` — retorna 401 se não autenticado.

### ✅ CORRIGIDO — `/api/users` restrito a admin
**Arquivo:** `app/api/users/route.ts`  
Verifica `session.user.role !== "ADMIN"` e retorna 403.

### 🟢 OK — Rotas admin com `requireAdmin()` corretamente verificado
`admin/products`, `admin/orders`, `admin/users`, `admin/categories`, `admin/faq`, `admin/faq/[id]`, `admin/service-categories`, `upload/services` — todas verificam o retorno de `requireAdmin()` corretamente.

---

## 3️⃣ Acesso e Autorização

### ✅ CORRIGIDO — `requireAdmin()` verificado em todas as rotas admin
Todas as 4 rotas que tinham bypass agora verificam corretamente:
- `app/api/admin/categories/route.ts` — ✅
- `app/api/admin/faq/route.ts` — ✅
- `app/api/admin/faq/[id]/route.ts` — ✅
- `app/api/admin/service-categories/route.ts` — ✅

### ✅ CORRIGIDO — Prompt injection no faq-chat sanitizado
**Arquivo:** `app/api/faq-chat/route.ts`  
**Antes:** Array `history` do cliente passado diretamente à API do Gemini sem validação.  
**Agora:** Sanitização completa aplicada:
- Valida que `role` é apenas `"user"` ou `"model"`
- Valida que `parts` é array com objetos contendo `text` como string
- Limita cada texto a 2000 caracteres
- Filtra entradas inválidas antes de passar ao Gemini

### ✅ CORRIGIDO — Notifications GET permite usuários nos próprios dados
**Arquivo:** `app/api/notifications/route.ts`  
**Antes:** Exigia role `ADMIN` mas filtrava por `userId: session.user.id`, bloqueando CUSTOMER e STAFF de suas notificações.  
**Agora:** Removido check de admin — qualquer usuário autenticado pode ler suas notificações (query já filtrada por `userId`).

### ✅ CORRIGIDO — `hasRole()` funcional
**Arquivo:** `lib/auth/helpers.ts`  
**Antes:** Sempre retornava `false` (dead code).  
**Agora:** Verifica corretamente `session.user.role` contra o parâmetro fornecido. Tipado como `"ADMIN" | "STAFF" | "CUSTOMER"`.

### ✅ CORRIGIDO — JWT com `maxAge` definido
**Arquivo:** `auth.ts`  
**Antes:** Dependia do default NextAuth (30 dias).  
**Agora:** `maxAge: 7 * 24 * 60 * 60` (7 dias) — mais adequado para e-commerce.

### 🟢 OK — auth.ts Credentials provider
Usa `loginSchema.safeParse`, bcrypt compare, verifica `emailVerified`. Boa implementação.

### 🟢 OK — Google OAuth
Corretamente configurado com PrismaAdapter.

---

## 4️⃣ Banco de Dados

### 🟢 OK — Prisma previne SQL injection
Todo acesso ao banco é via Prisma ORM. Nenhuma raw SQL encontrada.

### 🟢 OK — Singleton de conexão
`lib/prisma.ts` usa padrão globalForPrisma corretamente.

### 🟢 OK — SSL na conexão
DATABASE_URL usa `sslmode=require` com Supabase pooler (porta 6543).

### 🟢 OK — Transactions em operações críticas
Registro de usuário, checkout, e verificação de email usam `$transaction`.

### ✅ CORRIGIDO — Race condition no estoque
**Arquivo:** `app/api/admin/inventory/movements/route.ts`  
**Antes:** Leitura do estoque fora da transaction, escrita de valor absoluto dentro — race condition em alta concorrência.  
**Agora:** Usa `$transaction(async (tx) => { ... })` interativa. Produto é re-lido dentro da transaction (`freshProduct`), estoque recalculado com dados frescos. Previne inconsistências.

### ✅ CORRIGIDO — Tokens de verificação com hash SHA-256
**Arquivos:** `app/api/register/route.ts`, `app/api/send-verification-email/route.ts`, `app/api/verify-email/route.ts`  
**Antes:** Tokens de verificação armazenados em texto puro.  
**Agora:** Token é hasheado com `crypto.createHash("sha256")` antes de armazenar no DB. Token raw enviado no email URL, hash armazenado no DB. Na verificação, o token recebido é re-hasheado e comparado.

### ✅ CORRIGIDO — Campos `notes` com limite de tamanho
**Arquivos:** `app/api/paid-session/route.ts`, `app/api/free-call/route.ts`  
Campo `notes` agora validado por Zod com `z.string().max(2000)`. Previne inflação do banco com payloads grandes.

### 🟡 BAIXO — `docs/env.md` contém padrões sensíveis
O arquivo `docs/env.md` contém `ADMIN_PASSWORD="Admin@123"` como exemplo. Embora seja documentação, se copiado diretamente para `.env.local` é uma senha fraca. **Recomendação:** Adicionar aviso explícito no `docs/env.md` para alterar antes do uso.

### 🟢 OK — `.gitignore` cobre env files
`.env`, `.env*`, `.env.*.local`, `.env.local`, `.env.production` — todos ignorados.

---

## 5️⃣ Validação de Entrada

### ✅ CORRIGIDO — HTML sanitizado no email de contato
**Arquivo:** `app/api/contact/route.ts`  
Função `escapeHtml()` adicionada — todos os campos do usuário são sanitizados antes de interpolação no HTML.

### ✅ CORRIGIDO — Erro genérico no send-verification-email
**Arquivo:** `app/api/send-verification-email/route.ts`  
Retorna mensagem genérica `"Erro ao processar solicitação"` sem vazar detalhes internos.

### ✅ CORRIGIDO — Reset password com mesma política do registro
**Arquivo:** `app/api/auth/reset-password/route.ts`  
**Antes:** Aceitava qualquer senha com 6+ caracteres (downgrade de segurança).  
**Agora:** Exige 8+ chars com maiúscula, minúscula, número e caractere especial — mesma regex do `passwordSchema` de registro: `/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9]).{8,}$/`

### ✅ CORRIGIDO — Validação Zod em paid-session e free-call
**Arquivos:** `app/api/paid-session/route.ts`, `app/api/free-call/route.ts`  
**Antes:** Validação manual sem type-checking adequado.  
**Agora:** Schemas Zod completos com tipos corretos para todos os campos. `notes` limitado a 2000 chars. Usa `safeParse` com tratamento de erros.

### 🟢 OK — Zod validation em rotas principais
Register, checkout, admin/products usam Zod schemas robustos.

### 🟢 OK — CPF validation
Validação algorítmica completa no registro e checkout.

### 🟢 OK — Upload file validation
Upload de serviços verifica MIME type (png/jpeg/webp) e tamanho (3MB). Admin-only.

---

## 6️⃣ Segurança Geral

### ✅ CORRIGIDO — Security headers completos incluindo CSP
**Arquivo:** `next.config.ts`  
Headers configurados em todas as rotas:
- ✅ `Strict-Transport-Security` (HSTS com preload)
- ✅ `X-Frame-Options: SAMEORIGIN`
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `Referrer-Policy: strict-origin-when-cross-origin`
- ✅ `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- ✅ `X-DNS-Prefetch-Control: on`
- ✅ `Content-Security-Policy` — adicionado com política abrangente:
  - `default-src 'self'`
  - `script-src` permite MercadoPago SDK e Gemini
  - `img-src` permite R2, Unsplash, Google
  - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`

### ✅ CORRIGIDO — Dependências atualizadas (0 critical/high)
**`npm audit`:** 29 vulnerabilidades restantes (0 critical, 0 high, 8 moderate, 21 low)  
**Antes:** 13 vulnerabilidades (2 critical, 2 high).  
**Agora:** `npm audit fix` executado. Vulnerabilidades críticas (`fast-xml-parser`) e altas (`minimatch`, `rollup`) eliminadas. Restantes são em dependências transitivas de baixo risco.

### ✅ CORRIGIDO — Checkout não vaza mensagem de erro
**Arquivo:** `app/api/checkout/route.ts`  
**Antes:** Campo `details: e.message` expunha erros internos do Prisma/MercadoPago.  
**Agora:** Retorna apenas `{ error: "Erro interno ao processar pagamento" }` sem detalhes. Erro do MercadoPago também retorna mensagem genérica.

### ✅ CORRIGIDO — Console.log de PII apenas em desenvolvimento
**Arquivo:** `app/api/checkout/route.ts`  
**Antes:** `console.log` de dados do cliente (nome, email, CPF, telefone, endereço) em produção.  
**Agora:** Logs envolvidos em `if (process.env.NODE_ENV === "development")` — não executam em produção.

### 🟢 OK — Secrets não commitados
`.gitignore` cobre todos os padrões de env files. `docs/env.md` é apenas template.

### 🟢 OK — MercadoPago webhook com HMAC
Verificação de assinatura com `crypto.timingSafeEqual`, timestamp anti-replay (5 min), IP allowlist opcional.

### 🟢 OK — bcrypt com cost 10
Hashing de senha adequado para produção.

---

## 📋 Resumo de Todas as Vulnerabilidades

### Vulnerabilidades Corrigidas ✅ (28 de 31)

| # | Severidade Original | Vulnerabilidade | Status |
|---|---------------------|----------------|--------|
| 1 | 🔴 CRÍTICO | `requireAdmin()` bypass em 4 rotas admin | ✅ Corrigido |
| 2 | 🔴 CRÍTICO | `schedules/assign` sem autenticação | ✅ Corrigido |
| 3 | 🔴 CRÍTICO | Rate limit quebrado no contato | ✅ Corrigido |
| 4 | 🔴 CRÍTICO | HTML injection em email de contato | ✅ Corrigido |
| 5 | 🔴 CRÍTICO | Sem security headers | ✅ Corrigido (incluindo CSP) |
| 6 | 🔴 CRÍTICO | Rate limit fail-open sem X-Forwarded-For | ✅ Corrigido (fail-closed) |
| 7 | 🔴 CRÍTICO | Sem `proxy.ts` (proteção centralizada) | ✅ Corrigido (proxy.ts criado) |
| 8 | 🔴 CRÍTICO | `webhooks/schedules` PUT sem verificação | ✅ Corrigido (timingSafeEqual) |
| 9 | 🔴 CRÍTICO | Prompt injection via history no faq-chat | ✅ Corrigido (sanitização) |
| 10 | 🟠 ALTO | Sem rate limit no registro | ✅ Corrigido |
| 11 | 🟠 ALTO | 13 vulns em dependências (2 critical) | ✅ Corrigido (0 critical/high) |
| 12 | 🟠 ALTO | Sem rate limit em criação de agendamentos | ✅ Corrigido (10 req/15min) |
| 13 | 🟠 ALTO | Funcionários expostos publicamente | ✅ Corrigido (requer auth) |
| 14 | 🟠 ALTO | Sem rate limit em shipping/calculate | ✅ Corrigido (30 req/min) |
| 15 | 🟠 ALTO | Checkout vaza e.message no response | ✅ Corrigido (mensagem genérica) |
| 16 | 🟡 MÉDIO | Console.log de dados PII no checkout | ✅ Corrigido (dev-only) |
| 17 | 🟡 MÉDIO | Race condition no estoque | ✅ Corrigido (interactive tx) |
| 18 | 🟡 MÉDIO | Reset password aceita senha fraca | ✅ Corrigido (mesma policy) |
| 19 | 🟡 MÉDIO | Token de verificação em texto puro | ✅ Corrigido (SHA-256 hash) |
| 20 | 🟡 MÉDIO | Sem rate limit em verify-email | ✅ Corrigido (10 req/15min) |
| 21 | 🟡 MÉDIO | JWT sem maxAge/rotação explícita | ✅ Corrigido (7 dias) |
| 22 | 🟡 MÉDIO | `hasRole()` dead code | ✅ Corrigido (funcional) |
| 23 | 🟡 MÉDIO | Sem rate limit em paid-session/free-call | ✅ Corrigido |
| 24 | 🟡 MÉDIO | Campos notes sem limite de tamanho | ✅ Corrigido (max 2000) |
| 25 | 🟡 MÉDIO | Validação manual em vez de Zod | ✅ Corrigido (Zod schemas) |
| 26 | 🟡 MÉDIO | Sem rate limit em cep | ✅ Corrigido (30 req/min) |
| 27 | 🟡 MÉDIO | Sem rate limit em consulting-plan/create-payment | ✅ Corrigido (10 req/15min) |
| 28 | 🟡 MÉDIO | Notifications GET bloqueia não-admin do próprio dado | ✅ Corrigido |

### Itens Residuais de Baixo Risco (3)

| # | Severidade | Item | Observação |
|---|-----------|------|------------|
| 1 | 🟡 BAIXO | Rate limit in-memory (não distribuído) | Requer Redis/Upstash (nova dependência). Fail-closed mitiga o risco. |
| 2 | 🟡 BAIXO | npm audit: 29 vulns (8 moderate, 21 low) | Todas em dependências transitivas. 0 critical, 0 high. |
| 3 | 🟡 BAIXO | `docs/env.md` com senha exemplo fraca | Apenas documentação. Adicionar aviso para alterar. |

---

## 🔧 Recomendações Futuras

### Se necessário (melhoria contínua)
1. **Migrar rate limiting para Redis/Upstash** — necessário apenas se usar múltiplas instâncias ou serverless. Requer aprovação para adicionar dependência.
2. **Monitorar `npm audit` periodicamente** — atualizações de dependências transitivas podem resolver os 29 restantes.
3. **Adicionar aviso no `docs/env.md`** — nota "Altere todas as senhas antes de usar em produção".
4. **Considerar CSRF tokens** — para formulários em Server Components, se necessário.
5. **Implementar rate limiting por userId** — além de IP, para proteger contra usuários autenticados abusivos.

---

## 📊 Evolução da Pontuação

| Período | Pontuação | Vulns Críticas | Vulns Altas | Total Pendentes |
|---------|-----------|---------------|-------------|-----------------|
| Jun/2025 (original) | 4.5/10 | 5 | 4 | 19 |
| Mar/2026 (re-audit) | 6.5/10 | 4 | 5 | 23 |
| Mar/2026 (remediação) | **9.0/10** | **0** | **0** | **3 (baixo risco)** |
