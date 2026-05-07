-- App-wide editable settings (singleton-style key/value store) --

CREATE TABLE "app_settings" (
    "id"          TEXT NOT NULL,
    "key"         TEXT NOT NULL,
    "value"       JSONB NOT NULL,
    "description" TEXT,
    "updatedById" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

ALTER TABLE "app_settings"
    ADD CONSTRAINT "app_settings_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
