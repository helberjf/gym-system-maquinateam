CREATE TYPE "ExpenseCategory" AS ENUM (
    'MP_FEE',
    'RENT',
    'PAYROLL',
    'MARKETING',
    'UTILITIES',
    'INFRASTRUCTURE',
    'TAXES',
    'SUPPLIES',
    'OTHER'
);

CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "incurredAt" DATE NOT NULL,
    "notes" TEXT,
    "sourceCheckoutPaymentId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "expenses_sourceCheckoutPaymentId_key"
    ON "expenses"("sourceCheckoutPaymentId");

CREATE INDEX "expenses_category_incurredAt_idx"
    ON "expenses"("category", "incurredAt");

CREATE INDEX "expenses_incurredAt_idx"
    ON "expenses"("incurredAt");

ALTER TABLE "expenses"
ADD CONSTRAINT "expenses_sourceCheckoutPaymentId_fkey"
FOREIGN KEY ("sourceCheckoutPaymentId") REFERENCES "checkout_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expenses"
ADD CONSTRAINT "expenses_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
