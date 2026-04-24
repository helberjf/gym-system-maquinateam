# E2E tests (Playwright)

Smoke tests que validam fluxos criticos de ponta a ponta usando o dev server.

## Rodar localmente

1. Instale os browsers do Playwright (so precisa na primeira vez):
   ```
   npm run test:e2e:install
   ```
2. Tenha um `.env` com DATABASE_URL apontando para um banco valido (Supabase local, branch ou postgres local).
3. Rode os testes:
   ```
   npm run test:e2e
   ```

Por padrao a config do Playwright ja inicia `npm run dev -- --port 3000` e reutiliza o server se ja estiver rodando.

## Rodar em CI

O config detecta `process.env.CI` e:
- Falha em `test.only`
- Faz 2 retries por teste
- Usa reporter `github` + html

## Variaveis de ambiente

- `E2E_PORT` (padrao: 3000)
- `E2E_BASE_URL` (padrao: http://127.0.0.1:<E2E_PORT>)
- `E2E_SKIP_WEBSERVER=1` se preferir iniciar o server manualmente
- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` para os testes que autenticam (opcional; se ausentes, os testes que precisam de login fazem `test.skip()`)

## Escopo atual

- `public.spec.ts`: home publica carrega e navega para login
- `auth.spec.ts`: guarda de rota (`/dashboard` redireciona para login) e validacao client-side
- Testes de fluxos autenticados (check-in QR, checkout, etc.) podem ser adicionados
  depois quando houver credenciais de seed padronizadas em CI.
