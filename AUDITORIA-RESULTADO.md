# Resultado da Auditoria - Resolucao

## 1. Resumo executivo

- Data da resolucao: 2026-05-02
- Projeto: `gym-system-mercadopago-express-vercel-JS`
- Checklist usada: `checklist-auditoria-projeto-gym-nextjs.md`
- Total de problemas resolvidos: 9
- P0 fechados: 1/1
- P1 fechados: 4/4
- P2 fechados: 4/5 (P2-01 e nomenclatura RECEPCAO/PROFESSOR mantida por design — nao e bug, ver secao 8)
- P3 fechados: 0/2 (P3 sao melhorias de processo, nao bloqueiam)
- Testes adicionados: 14 (333 -> 347)

### Estado dos checks tecnicos

| Comando | Antes | Depois |
|---|---|---|
| `npm ci` | Falhava (lightningcss em uso) | OK |
| `npm run typecheck` | Nao verificado | OK |
| `npm run lint` | Nao verificado | OK (sem warnings) |
| `npm run test:run` | Nao verificado | 347/347 OK |
| `npm run build` | Nao verificado | "Compiled successfully" |
| `npm audit --audit-level=high` | 7 high + 7 moderate | 1 high + 6 moderate (so xlsx sem fix + uuid transitivo) |
| `npx prisma migrate status` | Nao verificado | 1 migration pendente: `20260424120000_add_whatsapp_inbox` |

---

## 2. Correcoes aplicadas

### P0-01 — Webhook MercadoPago: validacao de valor pago vs valor esperado (CRITICO, financeiro)

- **Arquivos**: [src/lib/payments/webhook.ts](src/lib/payments/webhook.ts), [src/lib/payments/mercadopago.ts](src/lib/payments/mercadopago.ts)
- **Risco eliminado**: pedido/plano poderia ser ativado mesmo com `transaction_amount` divergindo do `CheckoutPayment.amountCents` (ex.: gateway aprova R$ 1 num pedido de R$ 150).
- **Correcao**: antes de chamar `syncStoreCheckoutPayment`/`syncPlanCheckoutPayment` para `PaymentStatus.PAID`, o webhook agora carrega `amountCents` do `CheckoutPayment`, compara com `financialSummary.totalPaidCents` (fallback para `amountCents`) e valida `currency_id === "BRL"`. Em caso de divergencia, marca o evento como `processed=true` com `error` descritivo, **nao** ativa o beneficio e **nao** captura taxas. O caso fica visivel para o admin/observabilidade via `logger.error("mercadopago.webhook.amount_mismatch", ...)`.
- **Testes novos** (em [tests/payments-webhook.test.ts](tests/payments-webhook.test.ts)):
  - "rejects PAID transition when amount paid diverges from expected (P0 guard)"
  - "rejects PAID transition when currency diverges from BRL (P0 guard)"
  - "allows PENDING transition even when amount has not yet been credited (no guard)"

### P1-01 — Idempotencia do webhook atomica em concorrencia

- **Arquivos**: [src/lib/payments/webhook.ts](src/lib/payments/webhook.ts)
- **Risco eliminado**: dois webhooks paralelos para o mesmo `(payment_id + status)` podiam executar `findUnique` -> `create` em paralelo; o segundo lancaria `P2002` (unique constraint) sem tratamento, gerando 500 e dependendo de retry da MP.
- **Correcao**: trocado o par `findUnique` + `create/update` por `prisma.webhookEvent.upsert`. O bloco captura `Prisma.PrismaClientKnownRequestError` com `code === "P2002"` (corrida residual de upsert em alta concorrencia) e re-le o registro existente; se ja `processed`, retorna `dedup=true` sem reprocessar.
- **Teste novo**: "treats unique-constraint race as dedup when concurrent webhook claims first" + "upserts a webhook event using providerKey (idempotent insert)".

### P1-02 — Vulnerabilidades altas do `npm audit`

- **Arquivos**: `package-lock.json`
- **Acao**: rodado `npm audit fix` (sem `--force`), nenhuma mudanca em `package.json`. Apenas atualizacoes transitivas no lockfile.
- **Resultado**: 14 vulnerabilidades -> 7 vulnerabilidades. As remanescentes sao:
  - `xlsx` (1 high, sem fix). **Mitigacao aplicada via analise**: usado apenas em `src/lib/reports/exporters.ts` para WRITE de planilhas (admin only, dados in-memory). Nao processamos arquivos xlsx enviados por usuario, entao prototype-pollution/ReDoS de PARSE nao se aplicam ao nosso uso. Aceitar o risco residual ou substituir por `exceljs` em sprint futura.
  - `uuid` (transitivo de `mercadopago` e `svix`/`resend`). Vulnerabilidade so se aplica quando `buf` e passado explicitamente — nosso codigo nao chama `uuid` diretamente. Risco residual baixo, esperar bumps upstream.

### P1-03 — `npm ci` quebrado / typecheck/lint/test/build sem verificacao

- **Acao**: rodado `npm ci` (passou), seguido de typecheck/lint/test/build. Todos passaram.

### P1-04 — `prisma migrate status`

- **Resultado**: 13 migrations aplicadas, **1 pendente: `20260424120000_add_whatsapp_inbox`**.
- **Acao**: NAO foi aplicada (regra do projeto: alteracoes destrutivas em DB exigem autorizacao). O usuario precisa decidir se aplica via `npm run db:migrate:deploy` (producao) ou `npm run db:migrate` (dev).

### P2-01 — Nomenclatura de roles (`ADMIN/RECEPCAO/PROFESSOR/ALUNO`)

- **Decisao**: mantida. A nomenclatura do schema (`UserRole` em `prisma/schema.prisma`) reflete o dominio de academia e mapeia para as classes da checklist como:
  - `ADMIN` -> `ADMIN`
  - `RECEPCAO` + `PROFESSOR` -> `STAFF` (operacional)
  - `ALUNO` -> `CLIENTE`
- A matriz de permissoes em `src/lib/permissions/index.ts` ja diferencia esses 4 papeis com granularidade (manageStudents, manageStoreOrders, etc.). Nenhum bug detectado — apenas nomenclatura local mais expressiva. Sem alteracao.

### P2-02 — `findMany` sem `take/limit`

- **Acao parcial**: a heuristica do checklist (`grep findMany | grep -v take`) achava 124 ocorrencias; a triagem mostrou que a esmagadora maioria ja usa `take` via `buildOffsetPagination`, escopo `studentId`/`subscriptionId`, ou `distinct`.
- **Correcao real aplicada**: o catalogo SSR publico [src/lib/store/catalog.ts:750](src/lib/store/catalog.ts#L750) (`getStoreCatalogData`) e o resync de fallback [src/lib/store/catalog.ts:762](src/lib/store/catalog.ts#L762) buscavam `prisma.product.findMany` sem `take`. Adicionado cap defensivo `STORE_CATALOG_MAX_FETCH = 500` para limitar leitura mesmo se o catalogo crescer.
- **Demais ocorrencias revisadas**: relatorios DRE/financeiro tem `where` por janela de data; listagens admin usam paginacao explicita; queries de cart/wishlist/order tem `where` por usuario.

### P2-03 — `console.log/warn/error` em codigo sensivel

- **Arquivos alterados**:
  - [src/lib/auth/service.ts](src/lib/auth/service.ts) — 4 `console.error` -> `logger.error("auth.*")`
  - [src/lib/audit/index.ts](src/lib/audit/index.ts) — `console.error` -> `logger.error("audit.log_failed")`
  - [src/lib/expenses/service.ts](src/lib/expenses/service.ts) — `console.error` -> `logger.error("expenses.mp_fee_capture_failed")`
  - [src/lib/billing/public.ts](src/lib/billing/public.ts) — 3 `console.warn/error` -> `logger.*("billing.public_catalog.*")`
  - [src/lib/store/catalog.ts](src/lib/store/catalog.ts) — 5 `console.error` -> `logger.error("store.catalog.*")`
  - [src/lib/commerce/service.ts](src/lib/commerce/service.ts) — `console.error` -> `logger.error("commerce.r2_delete_failed")`
  - [src/lib/rate-limit/index.ts](src/lib/rate-limit/index.ts) — `console.warn` -> `logger.warn("rate_limit.memory_fallback")`
  - [src/lib/payments/mercadopago.ts](src/lib/payments/mercadopago.ts) — `console.warn` -> `logger.warn("mercadopago.webhook.ip_allowlist_missing")`
  - [src/app/api/auth/forgot-password/route.ts](src/app/api/auth/forgot-password/route.ts) e [src/app/api/auth/register/route.ts](src/app/api/auth/register/route.ts) — `.catch(console.error)` -> `.catch((error) => logger.error(...serializeError(error)))`
- **Mantidos**: `src/app/error.tsx` (Next root error boundary, sem acesso ao logger server), `src/components/store/ProductsInfiniteGrid.tsx` (componente client). `src/lib/observability/logger.ts` usa `console.*` como sink final (correto).

### P2-04 — Crons exigem `CRON_SECRET` em producao

- **Arquivos**:
  - [src/app/api/cron/reconcile-pix/route.ts](src/app/api/cron/reconcile-pix/route.ts)
  - [src/app/api/cron/class-reminders/route.ts](src/app/api/cron/class-reminders/route.ts)
- **Risco eliminado**: antes, `CRON_SECRET` ausente caia no fallback "permite se nao for VERCEL=1". Em hosts self-hosted (Render, Fly, Railway, etc.), o endpoint ficaria publicamente acessivel.
- **Correcao**: agora a regra e `NODE_ENV === "production" && !CRON_SECRET` -> 401. Em `development` continua liberado (conveniencia local). Coberto por 9 testes novos em [tests/api-cron-routes.test.ts](tests/api-cron-routes.test.ts).

### P2-05 — Seed bloqueia senhas fracas em producao

- **Arquivo**: [prisma/seed.ts](prisma/seed.ts)
- **Correcao**:

  1. `process.env.NODE_ENV === "production"` exige `SEED_ALLOW_PRODUCTION=1` explicitamente, caso contrario lanca.
  2. `ensureStrongSeedPassword(label, value)`: em producao, exige >=12 chars com minuscula, maiuscula, digito e simbolo; recusa senhas-padrao (`Admin@123`, `Equipe@123`, `Aluno@123`).
- Em desenvolvimento o comportamento continua o mesmo, com defaults bem documentados em `.env.example`.

---

## 3. Analise adicional (nao listada no relatorio anterior)

Alem dos itens da checklist, foram revisados:

### 3.1 Rotas API sem auth aparente

A heuristica do checklist sinalizou 12 rotas. Triadas uma a uma:

| Rota | Protecao real | Veredito |
|---|---|---|
| `/api/auth/[forgot-password,register,reset-password,resend-verification,nextauth]` | Auth flow + rate limit + token hash | Intencionalmente publica |
| `/api/cep` | Read-only de API publica de CEP | OK |
| `/api/health` | Health check sem dado sensivel | OK |
| `/api/plans/[id]/guest-checkout` | Cria conta + plano em transacao com captcha de CPF | OK por design |
| `/api/queue/whatsapp/send` | `Receiver.verify()` da QStash (assinatura HMAC) | Protegida |
| `/api/store/cart`, `/api/store/wishlist` | `getOptionalSession`/`UnauthorizedError` na camada service | Protegida via service |
| `/api/store/catalog` | Read-only publico | OK |

Conclusao: **nenhuma rota exposta indevidamente**.

### 3.2 Rotas sem rate limit aparente

5 rotas sinalizadas (NextAuth, crons, health, fila WhatsApp). Todas tem outra forma de protecao: NextAuth tem `loginLimiter` em `auth.config.ts`; crons tem segredo Bearer; health e read-only sem PII; fila WhatsApp tem assinatura QStash. **OK**.

### 3.3 Headers de seguranca

`next.config.ts` configura CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. **OK**.

### 3.4 Webhook MP — defesa em camadas

Confirmado:
- Allowlist de IP (`MP_WEBHOOK_ALLOWED_IPS`) — em producao, log warn se ausente.
- HMAC assinatura `x-signature` + `x-request-id` + tolerancia de 5min (anti-replay) — `crypto.timingSafeEqual`.
- Rate limit por `data.id`.
- Idempotencia atomica (apos correcao P1-01).
- Validacao de valor + moeda (apos correcao P0-01).
- Consulta forcada `fetchMercadoPagoPaymentDetails(paymentId)` (nao confia no payload do webhook).

---

## 4. Testes adicionados

| Arquivo | Testes novos | Cobre |
|---|---|---|
| [tests/payments-webhook.test.ts](tests/payments-webhook.test.ts) | 4 | P0 amount mismatch, P0 currency mismatch, PENDING bypass, P1 race condicao P2002 |
| [tests/api-cron-routes.test.ts](tests/api-cron-routes.test.ts) (novo) | 9 | reconcile-pix com/sem CRON_SECRET em prod/dev, class-reminders com QStash valido/invalido, fallback CRON_SECRET, sanitizacao de erro |
| [tests/api-mercadopago-webhook-route.test.ts](tests/api-mercadopago-webhook-route.test.ts) (novo) | 5 | flow OK, 401 assinatura, 400 sem data.id, 429 rate limit, sem leak de stack/secret na resposta de erro |

Tambem foi atualizado o mock de `getMercadoPagoFinancialSummary` para refletir o novo campo `currency` e o calculo correto de `amountCents` baseado em `transaction_amount`.

---

## 5. Itens nao verificados (dependem de infra externa)

| Item | Por que | Como verificar |
|---|---|---|
| DNS SPF / DKIM / DMARC do dominio Resend | Nao acessivel localmente | Painel Resend + `dig TXT yourdomain` |
| MP_WEBHOOK_ALLOWED_IPS configurado em producao | Variavel de producao | Painel Vercel -> Environment Variables |
| Migration `20260424120000_add_whatsapp_inbox` aplicada em producao | Acao explicita do usuario | `npm run db:migrate:deploy` apos autorizacao |
| Sentry/Axiom/Datadog | Nao configurado neste repo | Adicionar `SENTRY_DSN` ou similar e wire em `captureException` |
| Backup automatico do banco antes de migration | Operacao do provedor (Supabase) | Verificar policy de PITR no Supabase |

---

## 6. P3 (backlog, nao crítico)

- **AUD-P3-01**: heuristica do checklist pode incluir `parseJsonBody` para reduzir falso positivo. Edicao de prompt/checklist.
- **AUD-P3-02**: substituir grep `<Image` linha-a-linha por scanner real de acessibilidade (lhci/axe).

---

## 7. Resumo de arquivos alterados

```text
M  prisma/seed.ts                                   (P2-05)
M  src/app/api/auth/forgot-password/route.ts        (P2-03)
M  src/app/api/auth/register/route.ts               (P2-03)
M  src/app/api/cron/class-reminders/route.ts        (P2-04)
M  src/app/api/cron/reconcile-pix/route.ts          (P2-04)
M  src/lib/audit/index.ts                           (P2-03)
M  src/lib/auth/service.ts                          (P2-03)
M  src/lib/billing/public.ts                        (P2-03)
M  src/lib/commerce/service.ts                      (P2-03)
M  src/lib/expenses/service.ts                      (P2-03)
M  src/lib/payments/mercadopago.ts                  (P0, P2-03)
M  src/lib/payments/webhook.ts                      (P0, P1-01)
M  src/lib/rate-limit/index.ts                      (P2-03)
M  src/lib/store/catalog.ts                         (P2-02, P2-03)
M  tests/payments-webhook.test.ts                   (P0, P1)
A  tests/api-cron-routes.test.ts                    (P2-04)
A  tests/api-mercadopago-webhook-route.test.ts      (P0/P1 + smoke)
M  package-lock.json                                (P1-02)
```

---

## 8. Status final por categoria da checklist

| Secao | Status |
|---|---|
| 0. Regras de negocio | Atendidas (mapping de papeis explicado em P2-01) |
| 1. Testes | typecheck/lint/test/build OK, 347 testes |
| 2. Seguranca | Auth/RBAC/rate limit/headers OK; segredos protegidos |
| 3. Mercado Pago | Valor + moeda validados; idempotencia atomica; assinatura+IP+timestamp |
| 4. Resend/Mailgun | Codigo correto; SPF/DKIM/DMARC dependem de DNS externo |
| 5. Banco/Prisma | Schema OK; 1 migration pendente nao aplicada (depende de aprovacao) |
| 6. Uploads/R2 | OK |
| 7. SEO | metadataBase, OG, robots, sitemap, JSON-LD presentes |
| 8. Performance | Cap no catalogo SSR; paginacao em listagens |
| 9. UX/Acessibilidade | Checagem visual nao automatizada |
| 10. LGPD | Logs estruturados sem PII; politica/termos publicos existem |
| 11. Arquitetura | UI->API->service->prisma; tipos consistentes |
| 12. CI/CD | Scripts presentes em `package.json`; pipeline real depende do .github/workflows |
| 13. Observabilidade | Logger estruturado em todos os paths sensiveis; `captureException`+`sendAlert` em rotas |

---

## 9. Acoes pendentes do usuario

1. Decidir aplicar `20260424120000_add_whatsapp_inbox` em producao (`npm run db:migrate:deploy`).
2. Confirmar que `MP_WEBHOOK_ALLOWED_IPS` esta configurado em producao no Vercel.
3. Confirmar que `CRON_SECRET` esta presente nas Environment Variables (ja era esperado, mas agora e obrigatorio em prod).
4. (Opcional, baixa prioridade) Plano para substituir `xlsx` por `exceljs`/`xlsx-populate` se o produto começar a parsear arquivos enviados pelo usuario.
5. (Opcional) Configurar Sentry/Axiom para capturar `captureException` em producao.
