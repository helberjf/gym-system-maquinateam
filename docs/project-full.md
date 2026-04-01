# Projeto Full

## Resumo

Este projeto e uma plataforma full-stack de e-commerce com servicos, agendamentos e operacao administrativa. A aplicacao foi pensada como sistema real de negocio, nao apenas como vitrine: ela unifica catalogo, checkout, pagamentos, frete, estoque, fluxo de caixa, CRM, notificacoes, IA e dashboards em uma base unica.

## Escopo funcional completo

- Autenticacao com email/senha, Google OAuth, verificacao de email, recuperacao de senha e controle por perfil.
- Catalogo publico de produtos e servicos com SEO, filtros, busca e paginas indexaveis.
- Carrinho e checkout para usuario autenticado e para visitante.
- Pagamentos com Mercado Pago e Pix com AbacatePay.
- Pedidos, consulta de pedido por convidado e historico do cliente.
- Calculo de frete por CEP, operacao com Melhor Envio, rastreamento e shipment events.
- Cupons, wishlist, avaliacoes, notificacoes e emails transacionais.
- Agendamentos, disponibilidade, agenda staff, free calls e consultoria.
- CRUD administrativo de produtos, servicos, categorias, FAQ, usuarios, pedidos, carousel e daily offers.
- Estoque, movimentacao de estoque, atendimento, relatorios, graficos e fluxo de caixa.
- CRM com leads, tarefas, interacoes, qualificacao e dashboards.
- Chat FAQ com IA, geracao de resposta FAQ com IA, geracao de descricao com IA e analise de dados com IA.
- Seguranca e resiliencia com validacao, controle de acesso, rate limiting, idempotencia, deduplicacao de webhooks e testes.

## Stack principal

- Next.js 16 com App Router
- React 19
- TypeScript strict
- Prisma 7
- PostgreSQL / Supabase
- NextAuth
- Tailwind CSS
- Cloudflare R2
- Mailgun
- Melhor Envio
- Mercado Pago
- AbacatePay
- Gemini 2.5 Flash
- Vitest + Testing Library

## Arquitetura em uma frase

Eu organizei o projeto para manter a UI mais apresentacional e a regra de negocio nas rotas, servicos e camada de dados, com foco em SEO, previsibilidade operacional e integracao com servicos externos reais.

## Modulos e exemplos de arquivos envolvidos

### 1. Autenticacao e controle de acesso

Implementei login com email e senha, Google OAuth, sessao com NextAuth, verificacao de email, reset de senha e protecao de rotas por perfil.

Exemplos de arquivos envolvidos/alterados nessa frente:
- `auth.ts`
- `app/api/auth/[...nextauth]/route.ts`
- `app/(auth)/login/LoginForm.tsx`
- `app/(auth)/register/RegisterForm.tsx`
- `app/api/register/route.ts`
- `app/api/forgot-password/route.ts`
- `app/api/auth/reset-password/route.ts`
- `app/api/send-verification-email/route.ts`
- `app/api/verify-email/route.ts`
- `proxy.ts`
- `lib/auth/require-admin.ts`
- `lib/auth/require-staff-or-admin.ts`

### 2. Loja publica, catalogo e SEO

Implementei home, listagem de produtos, categorias, pagina de produto, catalogo de servicos e estrutura SEO-first com metadata, sitemap, robots e dados estruturados.

Exemplos de arquivos envolvidos/alterados nessa frente:
- `app/page.tsx`
- `app/products/page.tsx`
- `app/products/[slug]/page.tsx`
- `app/categories/page.tsx`
- `app/services/page.tsx`
- `app/services/[id]/page.tsx`
- `components/products/ProductGridClient.tsx`
- `components/products/ProductCard.tsx`
- `components/products/ProductCategoryFilter.tsx`
- `components/products/ProductPriceFilter.tsx`
- `app/sitemap.ts`
- `app/robots.ts`

### 3. Carrinho, checkout, pedidos e cupons

Implementei fluxo de compra completo com carrinho, checkout para visitante, validacao de cupom, criacao de pedido, consulta de pedido por convidado e paginas de acompanhamento.

Exemplos de arquivos envolvidos/alterados nessa frente:
- `contexts/CartContext.tsx`
- `app/checkout/page.tsx`
- `app/checkout/payment/page.tsx`
- `app/checkout/guest/page.tsx`
- `app/checkout/guest/GuestCheckoutClient.tsx`
- `app/api/checkout/route.ts`
- `app/api/coupons/validate/route.ts`
- `lib/coupons.ts`
- `app/order/search/page.tsx`
- `app/order/guest/[id]/page.tsx`
- `app/order/[id]/page.tsx`
- `lib/orders/guest-access.ts`

### 4. Pagamentos, Pix, webhook e idempotencia

Implementei pagamento com Mercado Pago, Pix com AbacatePay, polling/status de Pix, webhook de confirmacao e tratamento idempotente para evitar processamento duplicado. No webhook do Mercado Pago existe persistencia de `WebhookEvent` por `providerId` e saida antecipada quando o evento ja foi processado. No webhook de frete existe deduplicacao de `ShipmentEvent`.

Exemplos de arquivos envolvidos/alterados nessa frente:
- `app/api/checkout/route.ts`
- `app/api/mercadopago/webhook/route.ts`
- `app/checkout/pix/page.tsx`
- `app/checkout/pix/CheckoutPixClient.tsx`
- `app/api/checkout/pix/status/route.ts`
- `lib/abacatepay.ts`
- `app/api/consulting-plan/create-payment/route.ts`
- `app/api/staff/schedules/create-payment/route.ts`
- `prisma/schema.prisma`
- `__tests__/api-mercadopago-webhook.route.test.ts`
- `__tests__/mercadopago-webhook.test.ts`
- `__tests__/checkout-validation.test.ts`

### 5. Frete, envios e rastreamento

Implementei calculo de frete por CEP, integracao com Melhor Envio, webhook de atualizacao logistica, tela administrativa de envios e rastreamento por shipment events.

Exemplos de arquivos envolvidos/alterados nessa frente:
- `lib/melhor-envio.ts`
- `lib/melhor-envio-oauth.ts`
- `app/api/shipping/calculate/route.ts`
- `app/api/shipping/webhook/route.ts`
- `lib/admin/melhor-envio-cart.ts`
- `lib/admin/shipments.ts`
- `app/dashboard/admin/shipments/page.tsx`
- `app/dashboard/admin/shipments/[id]/page.tsx`
- `__tests__/api-shipping-webhook.route.test.ts`
- `__tests__/admin-shipments.test.ts`
- `__tests__/admin-melhor-envio-cart.test.ts`

### 6. Servicos, agendamentos, free call e consultoria

Implementei catalogo de servicos, criacao e cancelamento de agendamentos, validacao de disponibilidade, agenda staff, free call e conversao de atendimento em consultoria paga.

Exemplos de arquivos envolvidos/alterados nessa frente:
- `app/services/page.tsx`
- `app/services/[id]/page.tsx`
- `components/services/ServiceBookingModal.tsx`
- `components/SchedulingFlow.tsx`
- `app/schedules/page.tsx`
- `app/api/schedules/available-times/route.ts`
- `app/api/schedules/create/route.ts`
- `app/api/schedules/cancel/route.ts`
- `app/api/schedules/assign/route.ts`
- `app/free-call/page.tsx`
- `components/FreeCallBookingFlow.tsx`
- `app/api/free-call/route.ts`
- `app/dashboard/admin/free-calls/page.tsx`
- `app/dashboard/staff/agenda/page.tsx`
- `app/dashboard/consulting/page.tsx`

### 7. Dashboard e operacao por perfil

Separei a experiencia por perfil, com dashboards especificos para admin, staff e cliente, organizando navegacao, atalhos e paginas de operacao.

Exemplos de arquivos envolvidos/alterados nessa frente:
- `app/dashboard/layout.tsx`
- `app/dashboard/admin/layout.tsx`
- `app/dashboard/staff/layout.tsx`
- `app/dashboard/page.tsx`
- `sidebar.config.ts`
- `components/Sidebar.tsx`
- `components/SidebarNav.tsx`
- `components/PublicBottomNav.tsx`
- `app/dashboard/orders/page.tsx`
- `app/dashboard/payments/page.tsx`
- `app/dashboard/profile/page.tsx`
- `app/dashboard/notifications/page.tsx`

### 8. Gestao administrativa de catalogo, conteudo e midia

Implementei CRUD de produtos, servicos, categorias, FAQ, carousel, daily offers, usuarios e uploads de imagem para a operacao administrativa.

Exemplos de arquivos envolvidos/alterados nessa frente:
- `app/api/admin/products/route.ts`
- `app/api/admin/services/route.ts`
- `app/api/admin/service-categories/route.ts`
- `app/api/admin/categories/route.ts`
- `components/admin/ProductForm.tsx`
- `components/admin/ServiceForm.tsx`
- `components/admin/ImageEditor.tsx`
- `app/api/admin/products/uploads/product-image/route.ts`
- `app/api/admin/services/uploads/service-image/route.ts`
- `app/dashboard/admin/carousel/page.tsx`
- `app/api/admin/carousel/route.ts`
- `app/dashboard/admin/daily-offers/page.tsx`
- `app/api/admin/daily-offers/route.ts`
- `app/dashboard/admin/faq/page.tsx`
- `app/dashboard/admin/faq/FaqForm.tsx`
- `app/api/admin/faq/route.ts`
- `app/dashboard/admin/users/page.tsx`

### 9. Estoque, movimentacao, atendimento e fluxo de caixa

Implementei monitoramento de estoque, movimentacao manual, graficos operacionais, indicadores de atendimento e fluxo de caixa administrativo. O fluxo de caixa considera entradas por pagamentos, saidas por reembolsos e custo real de frete.

Exemplos de arquivos envolvidos/alterados nessa frente:
- `app/api/admin/inventory/route.ts`
- `app/api/admin/inventory/movements/route.ts`
- `app/dashboard/inventory/page.tsx`
- `components/admin/StockMovementAdmin.tsx`
- `components/inventory/InventoryCharts.tsx`
- `app/api/admin/attendance/route.ts`
- `app/dashboard/attendance/page.tsx`
- `components/attendance/AttendanceCharts.tsx`
- `lib/admin/cash-flow.ts`
- `app/api/admin/cash-flow/route.ts`
- `app/dashboard/admin/cash-flow/page.tsx`
- `app/dashboard/admin/dashboard/page.tsx`
- `__tests__/api-admin-inventory.route.test.ts`
- `__tests__/api-admin-inventory-movements.route.test.ts`
- `__tests__/admin-cash-flow.test.ts`
- `__tests__/admin-cash-flow.page.test.tsx`

### 10. CRM

Implementei CRM com pipeline de leads, tarefas, interacoes, qualificacao, atribuicao para staff e dashboards administrativos e operacionais.

Exemplos de arquivos envolvidos/alterados nessa frente:
- `app/api/crm/leads/route.ts`
- `app/api/crm/leads/[id]/route.ts`
- `app/api/crm/leads/[id]/interactions/route.ts`
- `app/api/crm/leads/[id]/qualify/route.ts`
- `app/api/crm/tasks/route.ts`
- `app/api/crm/stats/route.ts`
- `components/admin/crm/AdminCrmDashboard.tsx`
- `components/admin/crm/AdminTaskBoard.tsx`
- `components/admin/crm/AdminLeadsList.tsx`
- `components/admin/crm/LeadDetail.tsx`
- `components/staff/crm/StaffLeadsList.tsx`
- `components/staff/crm/StaffTaskList.tsx`
- `app/dashboard/admin/crm/page.tsx`
- `app/dashboard/staff/crm/leads/page.tsx`
- `__tests__/crm-leads.test.ts`
- `__tests__/crm-tasks.test.ts`

### 11. IA aplicada ao produto e a operacao

Implementei quatro frentes de IA: chat FAQ para cliente, geracao de resposta FAQ para admin, geracao de descricao de produto/servico e analise de dados com IA para a administracao.

Exemplos de arquivos envolvidos/alterados nessa frente:
- `app/api/faq-chat/route.ts`
- `components/FaqChatWidget.tsx`
- `components/ChatPageClient.tsx`
- `knowledge/faq.md`
- `app/api/admin/ai-faq-answer/route.ts`
- `app/dashboard/admin/faq/FaqForm.tsx`
- `app/api/admin/ai-description/route.ts`
- `components/admin/ProductForm.tsx`
- `components/admin/ServiceForm.tsx`
- `app/api/admin/analytics-chat/route.ts`
- `components/admin/AdminAnalyticsChat.tsx`
- `app/dashboard/admin/analytics/page.tsx`

### 12. Notificacoes, wishlist, avaliacoes e comunicacao

Implementei recursos de engajamento e pos-venda, como notificacoes em dashboard, wishlist, pedidos com email transacional e suporte a avaliacoes no dominio.

Exemplos de arquivos envolvidos/alterados nessa frente:
- `app/api/notifications/route.ts`
- `app/api/notifications/[id]/read/route.ts`
- `app/api/notifications/[id]/unread/route.ts`
- `app/api/notifications/[id]/delete/route.ts`
- `lib/notifications/dashboard-notifications.ts`
- `components/admin/NotificationList.tsx`
- `app/api/wishlist/route.ts`
- `app/wishlist/page.tsx`
- `app/wishlist/WishlistClient.tsx`
- `lib/mailgun.ts`
- `lib/email-templates/order-confirmation.ts`
- `prisma/schema.prisma`

### 13. Seguranca, validacao, performance e testes

Implementei protecao de rotas, validacao de entrada, rate limiting, regras de negocio no servidor, soft-delete, testes de rotas/UI/dominio e tratamento de webhooks com deduplicacao. Tambem mantive preocupacao com SEO e com queries mais enxutas via Prisma.

Exemplos de arquivos envolvidos/alterados nessa frente:
- `proxy.ts`
- `lib/rate-limit.ts`
- `lib/security/csp.ts`
- `lib/validators/product.ts`
- `lib/validators/scheduleValidators.ts`
- `app/api/mercadopago/webhook/route.ts`
- `app/api/shipping/webhook/route.ts`
- `app/api/webhooks/schedules/route.ts`
- `prisma/schema.prisma`
- `README.md`
- `docs/TESTS.md`
- `__tests__/api-webhooks-schedules.route.test.ts`
- `__tests__/webhook-processing.test.ts`
- `__tests__/business-rules.test.ts`
- `__tests__/csp.test.ts`

## Diferenciais tecnicos que eu destacaria em entrevista

- O projeto cobre nao so venda, mas tambem operacao interna: estoque, fluxo de caixa, atendimento, CRM, envios e dashboards.
- O checkout e tratado como fluxo critico, com validacao, transacao e integracao de pagamento real.
- Existe preocupacao com idempotencia e deduplicacao em webhooks, o que e importante em cenarios com pagamentos e logistica.
- A camada de IA nao esta isolada como demo: ela aparece em suporte ao cliente, operacao administrativa e cadastro de conteudo.
- A base tem foco em manutencao e previsibilidade: TypeScript strict, Prisma, validacoes, roles, rate limit e testes.

## Como eu resumiria o projeto para um recrutador tecnico

Eu diria que este projeto demonstra minha capacidade de construir um sistema full-stack de negocio de ponta a ponta, unindo e-commerce, servicos, CRM, estoque, fluxo de caixa, IA e integracoes externas com preocupacao real de SEO, seguranca, idempotencia e operacao.
