CREATE TYPE "PaymentProvider" AS ENUM ('MERCADO_PAGO');

CREATE TYPE "CheckoutPaymentKind" AS ENUM ('STORE_ORDER', 'PLAN_SUBSCRIPTION');

CREATE TABLE "checkout_payments" (
    "id" TEXT NOT NULL,
    "kind" "CheckoutPaymentKind" NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MERCADO_PAGO',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" "PaymentMethod",
    "externalReference" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "providerPreferenceId" TEXT,
    "providerPaymentId" TEXT,
    "checkoutUrl" TEXT,
    "rawPayload" JSONB,
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "subscriptionId" TEXT,
    "planId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkout_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MERCADO_PAGO',
    "providerKey" TEXT NOT NULL,
    "providerObjectId" TEXT,
    "eventType" TEXT,
    "payload" JSONB,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "checkout_payments_externalReference_key" ON "checkout_payments"("externalReference");
CREATE UNIQUE INDEX "checkout_payments_providerPreferenceId_key" ON "checkout_payments"("providerPreferenceId");
CREATE UNIQUE INDEX "checkout_payments_providerPaymentId_key" ON "checkout_payments"("providerPaymentId");
CREATE UNIQUE INDEX "checkout_payments_orderId_key" ON "checkout_payments"("orderId");
CREATE UNIQUE INDEX "checkout_payments_subscriptionId_key" ON "checkout_payments"("subscriptionId");
CREATE INDEX "checkout_payments_userId_kind_status_idx" ON "checkout_payments"("userId", "kind", "status");
CREATE INDEX "checkout_payments_status_createdAt_idx" ON "checkout_payments"("status", "createdAt");
CREATE INDEX "checkout_payments_planId_idx" ON "checkout_payments"("planId");

CREATE UNIQUE INDEX "webhook_events_providerKey_key" ON "webhook_events"("providerKey");
CREATE INDEX "webhook_events_provider_processed_createdAt_idx" ON "webhook_events"("provider", "processed", "createdAt");

ALTER TABLE "checkout_payments" ADD CONSTRAINT "checkout_payments_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "checkout_payments" ADD CONSTRAINT "checkout_payments_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "checkout_payments" ADD CONSTRAINT "checkout_payments_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "checkout_payments" ADD CONSTRAINT "checkout_payments_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
