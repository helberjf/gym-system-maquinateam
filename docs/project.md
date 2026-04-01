# Projeto

## Resumo objetivo

Desenvolvi uma plataforma full-stack de e-commerce com servicos, agendamentos e operacao administrativa. O projeto foi pensado para uso real: SEO-first, checkout para usuario logado ou visitante, pagamentos online, frete, controle operacional e dashboards por perfil.

## O que o sistema cobre

- Autenticacao e acesso: login com email/senha, Google OAuth, verificacao de email, reset de senha e controle de acesso por perfil (`ADMIN`, `STAFF`, `CUSTOMER`).
- Loja e SEO: home, catalogo de produtos, categorias, paginas de produto, catalogo de servicos, filtros, busca, `generateMetadata`, sitemap, robots e dados estruturados.
- Checkout e pedidos: carrinho, checkout para visitante, cupons, criacao de pedidos, consulta de pedido por convidado, historico de compras e acompanhamento de pagamento.
- Pagamentos: Mercado Pago, Pix com AbacatePay, status de pagamento, webhook de confirmacao e atualizacao automatica do pedido.
- Frete e envios: calculo por CEP, Melhor Envio, rastreamento, shipment events e fluxo operacional de envio.
- Servicos e agenda: agendamentos, disponibilidade, agenda da equipe, free call e fluxo de consultoria.
- Operacao interna: dashboards admin, staff e cliente; produtos, servicos, categorias, usuarios, FAQ, notificacoes, carousel, daily offers e cupons.
- Gestao operacional: estoque, movimentacao de estoque, atendimento, fluxo de caixa, graficos e relatorios.
- CRM: leads, tarefas, interacoes, qualificacao e metricas.
- IA: chat FAQ, geracao de respostas para FAQ, geracao de descricao de produto/servico e analise de dados com IA.
- Experiencia do cliente: wishlist, avaliacoes, emails transacionais e notificacoes.
- Confiabilidade: validacao com Zod, regras de negocio no servidor, transacoes no checkout, soft-delete, rate limiting, idempotencia e deduplicacao de webhooks, alem de testes automatizados.

## Stack e escala do projeto

O projeto usa Next.js 16, React 19, TypeScript strict, Prisma 7, PostgreSQL/Supabase, NextAuth, Tailwind CSS, Cloudflare R2, Mailgun, Melhor Envio, Mercado Pago e AbacatePay. Hoje a base concentra cerca de 40 models no Prisma, 81 rotas de API e 117 arquivos de teste.

## Como eu apresentaria para um recrutador tecnico

Eu diria que este projeto nao e apenas uma loja online. Ele centraliza venda de produtos, servicos, pagamentos, frete, estoque, fluxo de caixa, CRM, atendimento, chat com IA e analise de dados com IA em uma mesma base. O ponto que mais me interessa nele e que eu tratei o sistema como operacao real, com preocupacao de SEO, seguranca, integridade de dados, idempotencia de webhooks e manutencao de longo prazo.
