# 🧪 Documentação de Testes

**653 testes** em **30 suítes**, cobrindo lógica de negócio, validação, segurança, domínio e-commerce, webhooks de pagamento, componentes UI e configuração.

```bash
npm test              # Watch mode
npm run test:run      # Execução única (CI)
```

**Tempo de execução:** ~7s (sem banco, sem rede, sem serviços externos)

---

## Índice

- [Resumo por Categoria](#resumo-por-categoria)
- [Componentes UI (31 testes)](#componentes-ui-31-testes)
- [Autenticação & Autorização (75 testes)](#autenticação--autorização-75-testes)
- [Lógica de Negócio & Domínio (258 testes)](#lógica-de-negócio--domínio-258-testes)
- [Webhooks & Pagamentos (83 testes)](#webhooks--pagamentos-83-testes)
- [API & Validação de Rotas (64 testes)](#api--validação-de-rotas-64-testes)
- [Utilitários & Infraestrutura (120 testes)](#utilitários--infraestrutura-120-testes)
- [Configuração (21 testes)](#configuração-21-testes)
- [Smoke (1 teste)](#smoke-1-teste)
- [Filosofia de Teste](#filosofia-de-teste)

---

## Resumo por Categoria

| Categoria | Arquivos | Testes | Cobertura principal |
|-----------|----------|--------|---------------------|
| Componentes UI | 3 | 31 | Button, Input, StatusBadge — renderização, variantes, props, acessibilidade |
| Autenticação & Autorização | 3 | 75 | Schemas Zod, CPF, guards de sessão, roles |
| Lógica de Negócio & Domínio | 9 | 258 | Estoque, preços, pedidos, checkout, carrinho, shipping, agendamentos |
| Webhooks & Pagamentos | 3 | 83 | HMAC-SHA256, MercadoPago, pipeline de pagamento, deduplicação |
| API & Validação de Rotas | 3 | 64 | Contato, CEP, chat FAQ, sanitização, profanidade, email templates |
| Utilitários & Infraestrutura | 7 | 120 | Formatação, validação, rate limiting, tokens, paginação |
| Configuração | 1 | 21 | 4 sidebars, links, ícones, permissões por role |
| Smoke | 1 | 1 | Verificação mínima de ambiente |
| **Total** | **30** | **653** | |

---

## Componentes UI (31 testes)

### Button.test.tsx — 6 testes

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | should render with correct text | Renderização básica com texto |
| 2 | should apply default classes | Classes CSS padrão |
| 3 | should apply additional classes | Merge de className customizado |
| 4 | should be disabled when disabled prop is true | Estado disabled |
| 5 | should call onClick when clicked | Callback de clique |
| 6 | should not call onClick when disabled | Proteção contra clique em disabled |

### Input.test.tsx — 10 testes

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | should render an input element | Renderização do elemento |
| 2 | should apply the data-slot attribute | Atributo data-slot |
| 3 | should accept and display a value | Exibição de valor |
| 4 | should accept type prop | Prop type (email, text) |
| 5 | should accept password type | Input de senha |
| 6 | should be disabled when disabled prop is passed | Estado disabled |
| 7 | should apply custom className | Classes customizadas |
| 8 | should have default styling classes | Classes de estilo padrão |
| 9 | should forward ref and additional props | Forwarding de ref e props |
| 10 | should support required prop | Atributo required |

### StatusBadge.test.tsx — 15 testes

| # | Teste | O que valida |
|---|-------|-------------|
| 1-5 | correct label for PENDING/CONFIRMED/CANCELLED/COMPLETED/NO_SHOW | Label por status |
| 6 | should apply md size classes by default | Tamanho padrão |
| 7-8 | should apply sm/lg size classes | Variantes de tamanho |
| 9-13 | correct color classes for cada status | Cores por status |
| 14 | should have inline-flex and rounded-full classes | Layout base |
| 15 | should render an icon SVG element | Ícone renderizado |

---

## Autenticação & Autorização (75 testes)

### auth-validation.test.ts — 12 testes

Valida schemas Zod de login, registro, esqueci senha e reset de senha.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| loginSchema | 3 | Email válido, email inválido, senha vazia |
| registerSchema | 4 | Dados válidos, email inválido, senha curta, senhas diferentes |
| forgotPasswordSchema | 2 | Email válido, email inválido |
| resetPasswordSchema | 3 | Reset válido, senha curta, senhas incompatíveis |

### auth-register.test.ts — 47 testes

Cobertura abrangente de todo o fluxo de registro, incluindo validação de CPF brasileiro.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| Email Schema | 4 | Lowercase, trim, rejeição de formato inválido |
| Name Schema | 5 | Primeiro + sobrenome, 3 nomes, rejeição de nome único |
| Password Schema | 6 | Força da senha (maiúsc, minúsc, número, especial) |
| Login Schema | 4 | Schema completo de login |
| Register Schema | 11 | Registro completo, senhas, telefone, data, gênero, CEP, UF, endereço BR e não-BR |
| Forgot Password Schema | 3 | Email válido/inválido/ausente |
| Reset Password Schema | 3 | Senhas matching, incompatíveis, fracas |
| CPF Validation | 7 | CPFs válidos, all-same-digit, check digits, opcional |
| onlyDigits Helper | 4 | Extração de dígitos, null handling |

### auth-helpers.test.ts — 16 testes

Testa guards de autenticação e autorização.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| isAuthenticated | 5 | Session com email, null, sem user, sem email, email vazio |
| getUserId | 4 | ID presente, null session, sem ID, sem user |
| hasRole | 7 | ADMIN, STAFF, CUSTOMER, role errado, null session, sem user, sem role |

---

## Lógica de Negócio & Domínio (258 testes)

### business-rules.test.ts — 61 testes

O maior arquivo de testes. Cobre as regras centrais do e-commerce.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| Stock Management | 8 | Decremento, estoque insuficiente, negativo, reembolso |
| Price Integrity | 7 | Cálculo de total, desconto, rounding, histórico |
| Order Status Transitions | 7 | PENDING→PAID, PAID→REFUNDED, imutabilidade |
| Product Visibility | 5 | Ativo, inativo, soft-deleted, sem estoque |
| CPF Validation | 6 | Algoritmo de validação de CPF brasileiro |
| Product Schema (Zod) | 10 | Criação, preprocess de string→number, defaults, negativos |
| Schedule Validators | 5 | Datas passadas, cálculo de fim, imutabilidade |
| Pagination | 9 | Page, take, cap 100, skip, envelope, página vazia |
| Monetary Integrity | 4 | Aritmética em centavos, prevenção de float errors |

### order-creation.test.ts — 36 testes

Fluxo completo de criação de pedido.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| Checkout Schema Validation | 11 | Multi-item, legacy, guest, array vazio, quantidades, email |
| Price Calculation | 6 | Sem desconto, 10%, 50%, 100%, rounding |
| Order Items Building | 5 | Preços corretos, produto não encontrado, estoque insuficiente |
| Total Calculation | 5 | Subtotal, array vazio, shipping, pedidos grandes |
| Checkout Data Normalization | 2 | Multi-item para array, legacy single-item para array |
| MercadoPago Items Building | 4 | unit_price em reais, shipping como item separado |
| Guest Validation Rules | 3 | Guest obrigatório para não-logados, opcional para logados |

### checkout-validation.test.ts — 22 testes

Validação específica do checkout e dados de pagador.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| Guest Address Schema | 5 | Endereço válido, default BR, complemento opcional |
| Guest Schema | 5 | Guest válido, email, CPF, telefone, nome |
| CPF Validation for Guest | 2 | CPF válido/inválido no checkout |
| Price Calculation | 6 | Desconto, 100%, rounding, subtotal, shipping |
| Payer Data Building | 4 | Telefone, CPF, formatos curtos → undefined |

### session-booking.test.ts — 26 testes

Sessões pagas e avaliações gratuitas.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| Paid Session Schema | 10 | Dados válidos, employeeId opcional, notas, campos obrigatórios |
| Free Call Schema | 6 | Dados válidos, notas opcionais, limite de chars, campos obrigatórios |
| Date/Time Parsing | 5 | Parsing válido, formatos inválidos, cálculo de fim |
| Plan Validation | 5 | Plano ativo, expirado, ownership |

### schedule-creation.test.ts — 25 testes

Criação de agendamentos com detecção de conflitos.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| Input Validation | 8 | Campos obrigatórios, formato de data |
| Date/Time Parsing | 3 | Parsing correto, meia-noite, fim do dia |
| Duration & End Time | 4 | 15min, 30min, 60min, cross-hour |
| Conflict Detection | 8 | Sobreposição (diversas variantes), adjacente OK, slot exato |
| Past Time Validation | 2 | Data passada/futura |

### cart-logic.test.ts — 33 testes

Operações do carrinho de compras.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| addItem | 6 | Carrinho vazio, incremento, tipos diferentes, serviço sem duplicata |
| updateQuantity | 5 | Incremento, decremento (mín 1), tipo correto |
| removeItem | 3 | Remover por ID+type, carrinho vazio, tipo errado |
| getItemCount | 2 | Vazio, soma de quantidades |
| getProducts / getServices | 2 | Filtro por tipo |
| ProductCard Price Calculation | 7 | Sem desconto, 10%, 50%, 100%, rounding, null |
| normalizeImageUrl | 8 | null/undefined/vazio → placeholder, https/http/relativo as-is, bare domain |

### inventory.test.ts — 17 testes

Controle de estoque e movimentações.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| Movement Validation | 7 | IN/OUT/ADJUSTMENT válidos, tipo inválido, quantidade zero/negativa |
| Stock Calculation | 5 | Incremento, decremento, ajuste absoluto |
| Negative Stock Prevention | 5 | OUT excede estoque, dentro do estoque, exato, ADJUSTMENT negativo |

### shipping.test.ts — 20 testes

Cálculo de frete e validação de dimensões para Correios.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| CEP Validation | 4 | CEP 8 dígitos, formatado, curto, letras |
| Request Validation | 5 | Request válido, CEP ausente/inválido, produtos ausentes/vazios |
| Weight Calculation | 3 | Produto único, múltiplos, array vazio |
| Dimension Calculation | 3 | Largura, altura, comprimento máximos |
| Minimum Size Check (Correios) | 5 | Tamanho mínimo válido, dimensões insuficientes |

### product-schema.test.ts — 18 testes

Schemas avançados de produto incluindo campos MercadoPago.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| MercadoPago Fields | 6 | mp_enabled default, null metadata, mp_price_decimal, negativo |
| Payment Methods | 2 | Default vazio, array de métodos |
| Partial Update Schema | 6 | Update parcial (nome, preço, estoque, active), negativos rejeitados |
| Edge Cases | 4 | Preço 0, descrição longa, null, float→int |

---

## Webhooks & Pagamentos (83 testes)

### mercadopago-webhook.test.ts — 35 testes

Segurança e processamento de webhooks do MercadoPago.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| Signature Parsing | 5 | Header x-signature válido, vazio, sem ts, sem v1, whitespace |
| Signature ID Normalization | 3 | Lowercase alfanumérico, CUIDs com chars especiais |
| HMAC Verification | 4 | HMAC válido, mismatched, vazio, tamanhos diferentes |
| Payment Method Mapping | 8 | pix→PIX, credit_card, debit_card, ticket/bolbradesco/pec/atm→BOLETO |
| Payment Status Mapping | 8 | approved→PAID, pending/in_process/authorized→PENDING, cancelled, refunded, charged_back |
| Order Status Mapping | 5 | PAID→PAID, REFUNDED→REFUNDED, CANCELLED, FAILED→CANCELLED, PENDING |
| End-to-end Signature | 2 | Webhook assinado corretamente, ID adulterado |

### webhook-processing.test.ts — 36 testes

Pipeline completo de processamento de pagamento via webhook.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| Complete Signature Validation | 7 | Assinatura válida, timestamp expirado, boundary 5min, futuro, NaN, secret errado, ID adulterado |
| Payment ID Extraction | 6 | data.id, top-level id, preferência, null, numérico, string "0" |
| Amount Conversion | 5 | BRL→centavos, inteiro, null→0, string, rounding |
| Order Status Transitions | 10 | PENDING→PAID, já PAID, re-pagamento, restauro de estoque (CANCELLED, REFUNDED) |
| Full Payment Processing Pipeline | 5 | approved, refunded, cancelled, charged_back, in_process |
| Deduplication Logic | 3 | Evento já processado, novo evento, sem external_reference |

### webhook-schedules.test.ts — 12 testes

Verificação de segurança de webhooks de agendamento.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| Secret Verification | 5 | Secret correto, incorreto, null, não configurado, `timingSafeEqual` com buffers diferentes |
| Body Validation | 7 | scheduleId + CONFIRM, orderId + CANCEL, ambos, ausentes, action ausente/inválida/vazia |

---

## API & Validação de Rotas (64 testes)

### api-validation.test.ts — 37 testes

Validação de input em endpoints públicos.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| Contact Form Schema | 4 | Dados válidos, name/subject/message vazios |
| HTML Escaping | 6 | Escape de `<>`, `&`, `"`, `'`, texto limpo, string vazia |
| CEP Validation | 5 | 8 dígitos, formatado, curto, longo, letras |
| FAQ Chat Message | 7 | Mensagem válida, vazia, null, non-string, whitespace, >500 chars, exato 500 |
| FAQ Chat History Sanitization | 9 | History válido, roles inválidos, sem parts, parts vazias, >2000 chars, non-string, non-array, mixed |
| Synonym Expansion | 6 | Expansão de sinônimos (celular, capa, fone), sem match, múltiplos, substring |

### email-templates.test.ts — 13 testes

Templates de email transacional.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| Verification Email Template | 7 | Nome, link, HTML válido, alt text, URL completa, título, estilo inline |
| Order Confirmation Helpers | 6 | Cabeçalho com número, itens formatados, total em BRL, endereço, tracking info, data |

### profanity.test.ts — 14 testes

Filtro de profanidade pt-BR com evasion detection.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| Basic Matches | 6 | Detecção de palavrões comuns, texto limpo, string vazia |
| Leetspeak Evasion | 3 | `1d10t@`→idiota, `p@lh@c0`→palhaço, `m3rd@`→merda |
| Accented Variations | 3 | `otário`, `palhaço`, `cuzão` |
| Edge Cases | 2 | Palavras parciais dentro de palavras legítimas, standalone |

---

## Utilitários & Infraestrutura (120 testes)

### utils.test.ts — 5 testes

Helper `cn()` para merge de classes Tailwind.

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | merge class names correctly | clsx + tailwind-merge |
| 2 | filter out falsy values | false, null, undefined |
| 3 | handle empty inputs | Sem argumentos |
| 4 | handle single class | Classe única |
| 5 | handle mixed types | Tipos mistos |

### utils-extended.test.ts — 57 testes

Suite abrangente de utilitários de formatação e validação.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| formatName | 7 | "First L.", nome único, null→"Anonymous User", whitespace |
| removeAccents | 3 | Acentos portugueses, ASCII, vazio |
| normalizeText (Anti-Leetspeak) | 5 | Leetspeak, repetições, lowercase, acentos, combinado |
| hasSurname | 5 | Nome + sobrenome, 3 nomes, único, single-char |
| validateCep | 4 | CEP válido, formatado, curto, longo |
| validatePhone | 5 | Fixo 10 dígitos, móvel 11 dígitos, curto, longo |
| validateEmail | 4 | Válido, sem @, sem domínio, trim |
| validatePassword | 7 | Forte, curta, sem minúsc/maiúsc/número/especial, vazia |
| formatCpfDisplay | 3 | CPF 11 dígitos, não-11 as-is, strip non-digits |
| formatCep | 2 | CEP 8 dígitos, não-8 as-is |
| formatPhone | 3 | Fixo 10, móvel 11, inválido as-is |
| toE164 | 4 | BR→E.164, country code custom, strip +, curto→throw |
| validateBirthDate | 5 | Passada válida, futura, >150 anos, idade mínima |

### format.test.ts — 9 testes

Formatadores de data, hora e moeda (locale pt-BR).

| Describe | Testes | O que valida |
|----------|--------|-------------|
| formatDate | 3 | Date object, ISO string, string date |
| formatTime | 2 | HH:MM, padding de hora |
| formatCurrency | 4 | BRL, zero, valores grandes, negativos |

### formatters.test.ts — 17 testes

Formatadores progressivos de CPF e telefone.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| onlyDigits | 4 | CPF, telefone, sem dígitos, já limpo |
| formatCpf (progressive) | 7 | 3/6/9/11 dígitos, strip, vazio, truncate 11 |
| formatPhoneBR | 6 | Móvel 11, fixo 10, DDD parcial, vazio |

### rate-limit.test.ts — 16 testes

Rate limiter IP-based com namespace por prefix.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| Basic Behavior | 4 | Primeira request, até o limite, acima do limite, IPs independentes |
| Fail-Closed Behavior | 4 | IP desconhecido, null, vazio, retryAfter |
| Window Expiry | 1 | Reset do contador após janela |
| retryAfter Calculation | 1 | retryAfter <= windowMs em segundos |
| Prefix Namespacing | 2 | Prefixed independente de unprefixed, prefixes diferentes independentes |
| Remaining Count | 4 | Remaining na primeira request, decremento, 0 quando bloqueado, 0 para IP desconhecido |

### token.test.ts — 8 testes

Geração e hashing de tokens criptográficos.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| Generation | 3 | 64-char hex (32 bytes), unicidade, entropia |
| Hashing (SHA-256) | 5 | 64-char hash, determinístico, diferentes inputs, não-reversível, compatibilidade Node.js crypto |

### cursor-pagination.test.ts — 8 testes

Paginação por cursor para APIs públicas.

| Describe | Testes | O que valida |
|----------|--------|-------------|
| parseCursorParams | 8 | Cursor + take, default take=20, cursor undefined, cap take=100, non-numeric, zero, negativo, sem params |

---

## Configuração (21 testes)

### sidebar-config.test.ts — 21 testes

Configuração das 4 sidebars (público, cliente, staff, admin).

| Describe | Testes | O que valida |
|----------|--------|-------------|
| publicSidebar | 7 | Non-empty, Início primeiro, Produtos, Chat IA, dividers, hrefs válidos, ícones |
| customerSidebar | 4 | Non-empty, Dashboard primeiro, itens de cliente, sem itens admin |
| staffSidebar | 4 | Non-empty, itens de staff, SEM Chat IA, acesso a inventário |
| adminSidebar | 4 | Non-empty, itens admin, dashboard admin primeiro, hrefs válidos |
| all sidebars | 2 | Todas têm WhatsApp, NavItem é divider ou label+href+icon |

---

## Smoke (1 teste)

### hello-world.test.ts — 1 teste

Verificação mínima de que o ambiente de teste funciona.

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | should return true for a simple assertion | Vitest funcional |

---

## Filosofia de Teste

### O que testamos

Os testes extraem **funções puras** dos route handlers e testam sem banco de dados nem rede:

```typescript
// Extrai regra de negócio do route handler
function calculateFinalPrice(priceCents: number, discountPercent: number | null): number {
  if (!discountPercent || discountPercent <= 0) return priceCents;
  return Math.round(priceCents * (1 - discountPercent / 100));
}

// Testa isoladamente
it("should apply 15% discount correctly", () => {
  expect(calculateFinalPrice(9990, 15)).toBe(8492); // R$84.92 exact
});
```

### Por que essa abordagem

| Princípio | Benefício |
|-----------|----------|
| **Velocidade** | 653 testes em ~7s |
| **Isolamento** | Sem dependência de banco, rede ou serviços externos |
| **Confiabilidade** | Resultados determinísticos, sem flakiness |
| **Cobertura real** | Testa as mesmas regras que rodam em produção |
| **Segurança** | Rate limiting, sanitização de input, validação de webhooks, hashing de tokens |

### O que NÃO testamos (ainda)

| Tipo | Motivo | Plano |
|------|--------|-------|
| E2E (Playwright) | Complexidade de setup, custo de manutenção | Futuro (fluxos críticos: checkout, login) |
| API integration | Requer banco rodando | Futuro (test containers) |
| Visual regression | Custo vs benefício para fase atual | Avaliar após estabilização de design |

### Ferramentas

| Ferramenta | Uso |
|------------|-----|
| **Vitest** | Test runner (ESM-native, fast) |
| **@testing-library/react** | Renderização e queries de componentes |
| **jsdom** | Ambiente DOM simulado |
| **Zod** | Validação de schemas testada diretamente |

---

## Como executar

```bash
# Todos os testes (watch mode)
npm test

# Execução única (CI)
npm run test:run

# Teste específico
npx vitest run __tests__/business-rules.test.ts

# Com verbose
npx vitest run --reporter=verbose

# Apenas testes de um describe
npx vitest run -t "Stock Management"
```
