## DATABASE
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"

## AUTH / NEXTAUTH
AUTH_SECRET="<32+ chars>"
NEXTAUTH_SECRET="<same or another secret>"
NEXTAUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST=true

## GOOGLE OAUTH
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

## BASE URL (usado em emails e checkout)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
# opcional (fallback)
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
# modo produtos-only: use false para ocultar e bloquear servicos, agendamentos e consultoria
NEXT_PUBLIC_ENABLE_SERVICES="true"

## MAILGUN (emails)
MAILGUN_API_KEY=""
MAILGUN_DOMAIN=""
MAILGUN_FROM="Mailgun Sandbox <postmaster@domain>"
MAILGUN_API_BASE_URL="https://api.mailgun.net"
MAILGUN_FROM_NAME="Seu App"
MAILGUN_FROM_EMAIL="no-reply@domain"
CONTACT_EMAIL="contato@dominio.com"

## MERCADOPAGO
MP_ACCESS_TOKEN=""
MP_PUBLIC_KEY=""
MP_INTEGRATOR_ID=""
MP_ACCOUNT_EMAIL=""
MP_MAX_INSTALLMENTS=12
MP_EXCLUDED_PAYMENT_METHODS=""
# Opcional (se não definido, usa BASE URL + /api/mercadopago/webhook)
MP_WEBHOOK_URL=""
# Opcional (validação de assinatura do webhook)
MP_WEBHOOK_SECRET=""
# Opcional (allowlist de IPs)
MP_WEBHOOK_ALLOWED_IPS="1.2.3.4, 5.6.7.8"

## ABACATEPAY (PIX)
ABACATEPAY_API_KEY=""
# Opcional
ABACATEPAY_BASE_URL="https://api.abacatepay.com"

## ADMIN (seed)
ADMIN_PASSWORD="Admin@123"

## POSTGRES / PGADMIN (docker local)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=""
POSTGRES_DB=mydb
PGADMIN_EMAIL=admin@admin.com
PGADMIN_PASSWORD=""

## STORAGE (R2)
USE_R2=true
STORAGE_DRIVER=r2
R2_ENDPOINT="https://<accountid>.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME=""
R2_PUBLIC_URL="https://<public-domain>/<bucket>"
NEXT_PUBLIC_R2_PUBLIC_URL="https://<public-domain>/<bucket>"
# Por padrao o projeto faz upload direto do servidor para o R2.
# Defina como false apenas se voce quiser usar URL assinada no navegador e ja tiver CORS liberado no bucket.
R2_DIRECT_UPLOAD=true
R2_ACCOUNT_ID=""
TOKEN_VALUE=""

## MELHOR ENVIO
# OAuth oficial do Melhor Envio
MELHOR_ENVIO_CLIENT_ID=""
MELHOR_ENVIO_CLIENT_SECRET=""
# Local:  http://localhost:3000/api/admin/melhor-envio/oauth/callback
# Producao: https://vendaprodutosonline.vercel.app/api/admin/melhor-envio/oauth/callback
MELHOR_ENVIO_REDIRECT_URI="http://localhost:3000/api/admin/melhor-envio/oauth/callback"
MELHOR_ENVIO_SCOPES="shipping-calculate shipping-checkout shipping-generate shipping-tracking"

# Opcional: token fixo. Se informado, bypassa o OAuth salvo no banco.
MELHOR_ENVIO_TOKEN=""
MELHOR_ENVIO_BASE_URL="https://sandbox.melhorenvio.com.br"
SHIPPING_ORIGIN_ZIPCODE="36015000"
MELHOR_ENVIO_FROM_NAME="Minha Loja"
MELHOR_ENVIO_FROM_EMAIL="expedicao@minhaloja.com"
MELHOR_ENVIO_FROM_PHONE="32999999999"
MELHOR_ENVIO_FROM_DOCUMENT="00000000000"
MELHOR_ENVIO_FROM_COMPANY_DOCUMENT=""
MELHOR_ENVIO_FROM_STATE_REGISTER=""
SHIPPING_ORIGIN_STREET="Rua da Loja"
SHIPPING_ORIGIN_NUMBER="100"
SHIPPING_ORIGIN_COMPLEMENT=""
SHIPPING_ORIGIN_DISTRICT="Centro"
SHIPPING_ORIGIN_CITY="Juiz de Fora"
SHIPPING_ORIGIN_STATE="MG"
SHIPPING_ORIGIN_COUNTRY="BR"
MELHOR_ENVIO_NON_COMMERCIAL_DEFAULT=false

## GITHUB ACTIONS / VERCEL SYNC
# Workflow: .github/workflows/sync-vercel-env.yml
# Crie os GitHub Environments: development, preview e production.
# Em cada environment do GitHub, cadastre estes secrets:
# VERCEL_TOKEN
# VERCEL_PROJECT_ID
# VERCEL_TEAM_ID ou VERCEL_TEAM_SLUG
# ABACATEPAY_API_KEY
# ABACATEPAY_BASE_URL
# MELHOR_ENVIO_CLIENT_ID
# MELHOR_ENVIO_CLIENT_SECRET
# MELHOR_ENVIO_REDIRECT_URI
# MELHOR_ENVIO_SCOPES
# MELHOR_ENVIO_TOKEN
# MELHOR_ENVIO_BASE_URL
# SHIPPING_ORIGIN_ZIPCODE


