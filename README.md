# Maquina Team — Sistema de Academia

Sistema full-stack profissional para academia de luta **Maquina Team** (Juiz de Fora - MG).

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| Linguagem | TypeScript |
| Estilo | Tailwind CSS v4 |
| Banco de dados | PostgreSQL |
| ORM | Prisma |
| Autenticação | Auth.js v5 (NextAuth) |
| Validação | Zod + React Hook Form |
| Hashing | bcryptjs |
| Pagamento | Mercado Pago SDK |
| Storage | Cloudflare R2 |
| E-mail | Mailgun |
| Deploy | Vercel |

## Estrutura de pastas

\\\
src/
  app/
    (public)/          # Páginas públicas: home, faq
    (auth)/            # Login, cadastro
    (dashboard)/       # Área logada: painel, check-ins, pagamentos
    api/               # API Routes (Next.js)
  components/
    layout/            # Navbar, Footer
    ui/                # Button, Input, Card...
  features/            # Módulos de negócio (Fase 2+)
  lib/
    constants/         # brand.ts, plans.ts
  types/               # Tipos globais TypeScript
prisma/
  schema.prisma        # Schema completo do banco
public/
  images/              # Logo, fotos da academia
\\\

## Roadmap

| Fase | Descrição | Status |
|---|---|---|
| **Fase 1** | Base arquitetural (Next.js, Tailwind, Prisma schema, placeholders) | ? Concluída |
| **Fase 2** | Autenticação completa (Auth.js v5, PostgreSQL, cadastro real) | ? Planejada |
| **Fase 3** | Planos, matrículas e pagamentos (Mercado Pago) | ? Planejada |
| **Fase 4** | Check-in/check-out de alunos | ? Planejada |
| **Fase 5** | Relatórios e dashboard analytics | ? Planejada |
| **Fase 6** | Notificações (Mailgun) e upload (Cloudflare R2) | ? Planejada |

## Como rodar

\\\ash
npm install
cp .env.example .env.local   # preencher as variáveis
npm run dev
\\\

## Branding

- **Nome**: Maquina Team
- **Slogan**: Se transforme em uma Máquina!
- **Modalidades**: Muay Thai, Kickboxing, Funcional, Boxe Team
- **Endereço**: R. Fonseca Hermes, 5 - Centro, Juiz de Fora - MG
- **Contato**: (32) 99150-7929 | maquinateam.adm@gmail.com
