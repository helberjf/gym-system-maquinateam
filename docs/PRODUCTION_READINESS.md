# Production Readiness — Maquina Team Gym System

Data da análise: 2026-04-17
Última revisão: 2026-04-17 (resolução de P0/P1)

Auditoria completa para subir o sistema em produção (Vercel + Supabase + MercadoPago + Resend). Itens marcados com ✅ já estão prontos, ⚠️ parciais, ❌ faltam.

Prioridades: **P0** bloqueia o deploy, **P1** resolver antes do go-live real, **P2** polimento pós-lançamento.

---

## 1. Segurança

| Item | Status | Observação |
|------|--------|------------|
| Security headers (CSP, HSTS, Permissions-Policy) | ✅ | [next.config.ts](../next.config.ts) com CSP completa incluindo MercadoPago. |
| NextAuth v5 + `trustHost` + AUTH_SECRET | ✅ | [auth.ts](../auth.ts) configurado. |
| Rate limit (login/register/forgot/reset/webhook) | ✅ | [src/lib/rate-limit](../src/lib/rate-limit) com Upstash + fallback memória, fail-closed. |
| Webhook MercadoPago com HMAC timingSafeEqual | ✅ | [src/lib/payments/mercadopago.ts](../src/lib/payments/mercadopago.ts). |
| Validação zod em rotas de API | ✅ | [src/lib/validators](../src/lib/validators). |
| Bcrypt 10 rounds | ✅ | Aceitável. Subir para 12 quando o custo de CPU permitir. |
| Email verification + reset token hash | ✅ | Tokens expiráveis com índice em `expiresAt`. |
| Middleware centralizado | ⚠️ | Existe `proxy.ts` em vez de `middleware.ts` — Next 16 aceita ambos. **OK**. |
| CSRF em rotas customizadas | ⚠️ | NextAuth protege auth; auditar endpoints que alteram estado fora do NextAuth. **P1** |
| Brute-force por e-mail no login | ✅ | **Resolvido** — [src/lib/auth/credentials.ts](../src/lib/auth/credentials.ts) aplica `loginEmailLimiter` (10 tentativas / 15 min) via identifier `sha256(login-email\|email)` além do lock por IP+email. |

---

## 2. Observabilidade / Erros

| Item | Status | Observação |
|------|--------|------------|
| `src/app/error.tsx` (boundary de rota) | ✅ | Tema brand. |
| `src/app/global-error.tsx` | ✅ | **Criado nesta auditoria** com tema brand. |
| `src/app/not-found.tsx` | ✅ | Tema brand. |
| Padrão de erro JSON unificado (`{ ok, error, code }`) | ✅ | [src/lib/errors](../src/lib/errors). |
| Sentry / Axiom / Logtail | ❌ | **P1** — adicionar SDK (recomendo Sentry). Integrar no `global-error.tsx` e em handlers de webhook. |
| Logger estruturado (JSON) | ✅ | **Resolvido** — [src/lib/logger.ts](../src/lib/logger.ts): níveis debug/info/warn/error, child context, normalização de erros, respeita `LOG_LEVEL`. |
| Alertas de falha de pagamento / webhook | ❌ | **P1** — alerta quando webhook falha 3x seguidas (depende de Sentry). |

---

## 3. Banco de Dados (Prisma / Supabase)

| Item | Status | Observação |
|------|--------|------------|
| Client Prisma singleton | ✅ | [src/lib/prisma.ts](../src/lib/prisma.ts). |
| `DATABASE_URL` (pooler) + `DIRECT_URL` (migrations) | ✅ | Padrão Supabase correto. |
| Índices em campos quentes | ✅ | User, PasswordResetToken, StudentProfile. |
| Migrations versionadas | ✅ | **Confirmado** — `prisma/migrations/` commitado (20260331→20260402). |
| Seed idempotente | ✅ | [prisma/seed.ts](../prisma/seed.ts). |
| Backup automático configurado | ⚠️ | Supabase Pro inclui PITR; Free só daily. **P1** — decidir plano. |

---

## 4. Pagamentos (MercadoPago)

| Item | Status | Observação |
|------|--------|------------|
| Webhook assinado + verificado | ✅ | |
| Rate-limit no webhook | ✅ | 30 req/min. |
| Idempotência por `external_reference` | ✅ | |
| Máquina de estados de pedido | ✅ | PENDING→CONFIRMED→PAID→…→CANCELLED. |
| E-mail ao aprovar/cancelar pagamento | ⚠️ | Verificar template em `src/lib/mail/`. **P1** |
| Reconciliação diária (job) | ❌ | **P2** — cron no Vercel para buscar pagamentos pendentes e reconciliar. |
| Dashboard de falhas de pagamento | ❌ | **P2** |

---

## 5. SEO / Performance

| Item | Status | Observação |
|------|--------|------------|
| `sitemap.ts` / `robots.ts` | ✅ | |
| Metadata em páginas públicas | ✅ | |
| Fontes otimizadas (`next/font`) | ✅ | |
| `priority` em imagem LCP (home) | ⚠️ | Auditar hero da landing. **P2** |
| Open Graph / imagens sociais | ⚠️ | Verificar `og-image.png` estático. **P2** |
| Bundle analyzer | ❌ | **P2** — rodar `@next/bundle-analyzer` uma vez antes do go-live. |

---

## 6. Testes

| Item | Status | Observação |
|------|--------|------------|
| Unit + integration com Vitest | ✅ | 653 testes, ~7s. |
| Cobertura de webhook, checkout, rate-limit | ✅ | |
| E2E (Playwright/Cypress) | ❌ | **P1** — pelo menos: login, cadastro, checkout até PIX, webhook aprovando pagamento. |
| Teste de carga (k6/artillery) | ❌ | **P2** — antes de campanha paga. |

---

## 7. Deploy / Vercel

| Item | Status | Observação |
|------|--------|------------|
| `.env.example` completo | ✅ | |
| Build passa localmente | ✅ | **Resolvido** — typings em `tests/api-auth-and-misc-routes.test.ts` corrigidos com `vi.fn<() => Promise<...>>`. |
| `vercel.json` com timeouts e regiões | ✅ | **Resolvido** — [vercel.json](../vercel.json) com `regions: ["gru1"]`, `maxDuration` por rota (webhook 30s, payments 20s, reports 60s, uploads 30s, auth 15s) e cron diário. |
| Variáveis no Vercel | ⚠️ | Checklist crítico: `AUTH_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_*`, `RESEND_API_KEY`, `RESEND_FROM`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `UPSTASH_REDIS_*`, `R2_*`, `SEED_*`, **`CRON_SECRET`**, `LOG_LEVEL` (opcional). |
| Cron (reconciliação / limpeza tokens expirados) | ✅ | **Resolvido** — [src/app/api/cron/cleanup-tokens/route.ts](../src/app/api/cron/cleanup-tokens/route.ts) roda diariamente às 03:00 apagando tokens expirados e usados +24h. |
| Domínio custom + SSL | ❌ | **P0 antes de lançar** — configurar domínio + verificar email DNS (SPF/DKIM do Resend). |

---

## 8. UX / UI

| Item | Status | Observação |
|------|--------|------------|
| Tema brand consistente | ✅ | **Corrigido nesta auditoria** — Login e Register agora usam AuthCard + `authInputClassName`. |
| Password visibility toggle | ✅ | **Adicionado no login** nesta auditoria. |
| Loading/empty states | ✅ | Existem `loading.tsx` e `RouteLoading`. |
| Toast (sonner) | ✅ | |
| Responsividade mobile | ⚠️ | Testar em 360px / 414px / iPad. **P1** |
| Dark mode consistente | ✅ | O app é dark-first (brand-black). |
| Favicon / manifest PWA | ✅ | **Resolvido** — [src/app/manifest.ts](../src/app/manifest.ts) (dinâmico, Next 16) com theme_color `#C8102E`, background `#0A0A0A`, ícones em `/images/logo.jpg`. |

---

## 9. Conformidade / Legal

| Item | Status | Observação |
|------|--------|------------|
| LGPD — Política de Privacidade | ✅ | **Confirmada** — [src/app/(public)/politica-de-privacidade/page.tsx](../src/app/(public)/politica-de-privacidade/page.tsx) cobre dados coletados, finalidades, compartilhamento, retenção, cookies e direitos do titular. |
| Termos de Uso | ✅ | **Criado** — [src/app/(public)/termos/page.tsx](../src/app/(public)/termos/page.tsx) cobre objeto, cadastro, pagamentos, condutas proibidas, propriedade intelectual, responsabilidade, foro. |
| Footer com links legais | ✅ | **Atualizado** — [src/components/layout/Footer.tsx](../src/components/layout/Footer.tsx) linka Política e Termos. |
| Consentimento de cookies | ⚠️ | Se usar analytics → banner de consentimento. **P1** |
| Aviso de contrato de adesão (academia) | ❌ | **P1** — PAR-Q / termo de responsabilidade antes do primeiro treino. |

---

## Status pós-correção

### ✅ Resolvido nesta rodada
- Página `/termos` (LGPD / contrato).
- `vercel.json` com timeouts, região `gru1`, cron.
- Cron diário `/api/cron/cleanup-tokens` com auth via `CRON_SECRET`.
- Logger estruturado em `src/lib/logger.ts`.
- Brute-force extra por e-mail no login (`loginEmailLimiter`).
- Type-errors nos testes corrigidos.
- `manifest.ts` PWA + `viewport.themeColor` no root layout.
- Footer com links para Política e Termos.
- Redesign completo de login/cadastro no tema brand.
- `global-error.tsx` no tema brand.

### 🔴 Bloqueadores de produção remanescentes (P0)
1. **Domínio custom + DKIM/SPF do Resend** — sem isso, e-mails transacionais caem em spam e o checkout quebra na percepção do aluno.

### 🟠 Pré go-live (P1)
1. Sentry (ou Axiom) + integrar com `global-error.tsx`, webhook, payments.
2. Playwright: happy-path login → checkout PIX → webhook aprovado.
3. Responsividade mobile auditada em 360/414/iPad.
4. Confirmar templates de e-mail transacional (aprovado/cancelado/reset).
5. PAR-Q / termo de responsabilidade antes do primeiro treino.
6. CSRF em endpoints mutadores fora do NextAuth.
7. Consentimento de cookies se habilitar analytics.
8. Decidir Supabase Pro (PITR) vs Free.

### 🟡 Pós-lançamento (P2)
1. LCP (`priority` em imagens hero).
2. Bundle analyzer.
3. Reconciliação diária de pagamentos pendentes.
4. Dashboard de falhas de pagamento.
5. Teste de carga antes de campanha paga.

---

## Mudanças aplicadas nesta auditoria

1. **Login redesign**:
   - [src/app/(auth)/login/page.tsx](../src/app/(auth)/login/page.tsx) agora usa `AuthCard`.
   - [src/components/auth/LoginForm.tsx](../src/components/auth/LoginForm.tsx) usa estilos brand, password visibility toggle, divisor "ou", link "Esqueci" inline, botão Google consistente.

2. **Cadastro redesign**:
   - [src/app/(auth)/cadastro/page.tsx](../src/app/(auth)/cadastro/page.tsx) usa `AuthCard size="lg"`.
   - [src/components/auth/RegisterForm.tsx](../src/components/auth/RegisterForm.tsx) adota paleta brand, senha/confirmar em 2 colunas, validação visual verde/vermelho.

3. **AuthCard flexível**:
   - [src/components/auth/AuthCard.tsx](../src/components/auth/AuthCard.tsx) ganhou prop `size="sm" | "md" | "lg"`.

4. **Global error boundary**:
   - [src/app/global-error.tsx](../src/app/global-error.tsx) criado no tema brand.

5. **Observabilidade**:
   - [src/lib/logger.ts](../src/lib/logger.ts) — logger estruturado JSON com níveis, child, normalização de erros.

6. **Deploy**:
   - [vercel.json](../vercel.json) com `regions: ["gru1"]`, timeouts por rota e cron.
   - [src/app/api/cron/cleanup-tokens/route.ts](../src/app/api/cron/cleanup-tokens/route.ts) com auth via `CRON_SECRET`.

7. **Segurança extra**:
   - [src/lib/rate-limit/index.ts](../src/lib/rate-limit/index.ts) ganhou `loginEmailLimiter` (10/15min).
   - [src/lib/auth/credentials.ts](../src/lib/auth/credentials.ts) aplica lock duplo (IP+email + email puro) antes de validar senha.

8. **Legal / LGPD**:
   - [src/app/(public)/termos/page.tsx](../src/app/(public)/termos/page.tsx) — Termos de Uso completos.
   - [src/components/layout/Footer.tsx](../src/components/layout/Footer.tsx) linka Política e Termos.

9. **PWA**:
   - [src/app/manifest.ts](../src/app/manifest.ts) — manifest dinâmico Next 16.
   - [src/app/layout.tsx](../src/app/layout.tsx) — `viewport.themeColor` + `icons`.

10. **Testes**:
    - [tests/api-auth-and-misc-routes.test.ts](../tests/api-auth-and-misc-routes.test.ts) — typings corrigidos nos mocks de `vi.fn`.
