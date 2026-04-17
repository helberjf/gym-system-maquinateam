# Production Readiness — Maquina Team Gym System

Data da análise: 2026-04-17

Auditoria completa para subir o sistema em produção (Vercel + Supabase + MercadoPago + Resend). Itens marcados com ✅ já estão prontos, ⚠️ parciais, ❌ faltam.

Prioridades: **P0** bloqueia o deploy, **P1** resolver antes do go-live real, **P2** polimento pós-lançamento.

---

## 1. Segurança

| Item | Status | Observação |
|------|--------|------------|
| Security headers (CSP, HSTS, Permissions-Policy) | ✅ | [next.config.ts](next.config.ts) com CSP completa incluindo MercadoPago. |
| NextAuth v5 + `trustHost` + AUTH_SECRET | ✅ | [auth.ts](auth.ts) configurado. |
| Rate limit (login/register/forgot/reset/webhook) | ✅ | [src/lib/rate-limit](src/lib/rate-limit) com Upstash + fallback memória, fail-closed. |
| Webhook MercadoPago com HMAC timingSafeEqual | ✅ | [src/lib/payments/mercadopago.ts](src/lib/payments/mercadopago.ts). |
| Validação zod em rotas de API | ✅ | [src/lib/validators](src/lib/validators). |
| Bcrypt 10 rounds | ✅ | Aceitável. Subir para 12 quando o custo de CPU permitir. |
| Email verification + reset token hash | ✅ | Tokens expiráveis com índice em `expiresAt`. |
| Middleware centralizado | ⚠️ | Existe `proxy.ts` em vez de `middleware.ts` — confirmar que o Next 16 está executando (padrão é `middleware.ts`). **P1** |
| CSRF em rotas customizadas | ⚠️ | NextAuth protege auth; auditar endpoints que alteram estado fora do NextAuth. **P1** |
| Brute-force por e-mail no login | ⚠️ | Tem rate-limit por IP/chave; reforçar lock por e-mail (5/15min). **P1** |

---

## 2. Observabilidade / Erros

| Item | Status | Observação |
|------|--------|------------|
| `src/app/error.tsx` (boundary de rota) | ✅ | Tema brand. |
| `src/app/global-error.tsx` | ✅ | **Criado nesta auditoria** com tema brand. |
| `src/app/not-found.tsx` | ✅ | Tema brand. |
| Padrão de erro JSON unificado (`{ ok, error, code }`) | ✅ | [src/lib/errors](src/lib/errors). |
| Sentry / Axiom / Logtail | ❌ | **P1** — adicionar SDK (recomendo Sentry). Integrar no `global-error.tsx` e em handlers de webhook. |
| Logger estruturado (Pino/Winston) | ❌ | **P1** — hoje é `console.error`. Criar `src/lib/logger.ts` com JSON + níveis. |
| Alertas de falha de pagamento / webhook | ❌ | **P1** — alerta quando webhook falha 3x seguidas. |

---

## 3. Banco de Dados (Prisma / Supabase)

| Item | Status | Observação |
|------|--------|------------|
| Client Prisma singleton | ✅ | [src/lib/prisma.ts](src/lib/prisma.ts). |
| `DATABASE_URL` (pooler) + `DIRECT_URL` (migrations) | ✅ | Padrão Supabase correto. |
| Índices em campos quentes | ✅ | User, PasswordResetToken, StudentProfile. |
| Migrations versionadas | ⚠️ | Confirmar se `prisma/migrations/*` está commitado. **P0 se faltar.** |
| Seed idempotente | ✅ | [prisma/seed.ts](prisma/seed.ts). |
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
| Build passa localmente | ⚠️ | Há erros de tipo em `tests/api-auth-and-misc-routes.test.ts` (não afetam runtime). **P1** — corrigir. |
| `vercel.json` com timeouts e regiões | ❌ | **P1** — criar com `functions: { "src/app/api/mercadopago/webhook/route.ts": { maxDuration: 30 } }`, `"regions": ["gru1"]`. |
| Variáveis no Vercel | ⚠️ | Checklist de variáveis críticas: `AUTH_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_*`, `RESEND_API_KEY`, `RESEND_FROM`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `UPSTASH_REDIS_*`, `R2_*`, `SEED_*`. |
| Cron (reconciliação / limpeza tokens expirados) | ❌ | **P2** — `vercel.json` cron para rodar daily. |
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
| Favicon / manifest PWA | ⚠️ | Verificar `app/icon.png`, criar `manifest.webmanifest`. **P2** |

---

## 9. Conformidade / Legal

| Item | Status | Observação |
|------|--------|------------|
| LGPD — Política de Privacidade | ❌ | **P0** — obrigatório coletando CPF, endereço, dados de saúde. Página `/privacidade`. |
| Termos de Uso | ❌ | **P0** — `/termos` com regras de cancelamento/reembolso. |
| Consentimento de cookies | ⚠️ | Se usar analytics → banner de consentimento. **P1** |
| Aviso de contrato de adesão (academia) | ❌ | **P1** — PAR-Q / termo de responsabilidade antes do primeiro treino. |

---

## Plano de ação sugerido (próximas 2 semanas)

### Semana 1 — Unblockers (P0/P1)
1. Criar `vercel.json` com timeouts + região `gru1`.
2. Confirmar migrations commitadas e rodar `npm run db:migrate:deploy` no staging.
3. Corrigir erros de tipo em `tests/api-auth-and-misc-routes.test.ts`.
4. Adicionar Sentry (`@sentry/nextjs`) com source maps habilitados.
5. Criar `src/lib/logger.ts` e substituir `console.error` em rotas de webhook/payment.
6. Publicar páginas legais `/privacidade` e `/termos`.
7. Confirmar templates de e-mail transacional (aprovado / cancelado / reset).

### Semana 2 — Go-live (P1/P2)
1. Playwright: happy-path login → compra → webhook.
2. Brute-force guard por e-mail no login (complementar IP).
3. Cron job diário para expirar tokens de reset e reconciliar pagamentos pendentes.
4. Auditoria de LCP (adicionar `priority` nas imagens hero).
5. Bundle analyzer + remover libs não usadas.
6. Testar domínio custom + DKIM do Resend.

---

## Mudanças aplicadas nesta auditoria

1. **Login redesign**:
   - [src/app/(auth)/login/page.tsx](src/app/(auth)/login/page.tsx) agora usa `AuthCard`.
   - [src/components/auth/LoginForm.tsx](src/components/auth/LoginForm.tsx) usa estilos brand (`authInputClassName`, `authPrimaryButtonClassName`), password visibility toggle, divisor "ou" elegante, link "Esqueci" inline, botão Google consistente.

2. **Cadastro redesign**:
   - [src/app/(auth)/cadastro/page.tsx](src/app/(auth)/cadastro/page.tsx) usa `AuthCard size="lg"`.
   - [src/components/auth/RegisterForm.tsx](src/components/auth/RegisterForm.tsx) adota paleta brand (preto + vermelho + cinza), senha/confirmar em 2 colunas, validação visual verde/vermelho.

3. **AuthCard flexível**:
   - [src/components/auth/AuthCard.tsx](src/components/auth/AuthCard.tsx) ganhou prop `size="sm" | "md" | "lg"` com padding responsivo.

4. **Global error boundary**:
   - [src/app/global-error.tsx](src/app/global-error.tsx) criado no tema brand, com código de digest exposto para suporte.
