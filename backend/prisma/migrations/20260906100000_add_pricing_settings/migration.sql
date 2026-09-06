CREATE TABLE "pricing_settings" (
  "id" TEXT NOT NULL,
  "main_per30_usd" DECIMAL(12,4) NOT NULL DEFAULT 0.50,
  "main_one_day_usd" DECIMAL(12,4) NOT NULL DEFAULT 10.58,
  "wall_per30_usd" DECIMAL(12,4) NOT NULL DEFAULT 0.30,
  "wall_one_day_usd" DECIMAL(12,4) NOT NULL DEFAULT 3.71,
  "corner_per30_usd" DECIMAL(12,4) NOT NULL DEFAULT 0.20,
  "corner_one_day_usd" DECIMAL(12,4) NOT NULL DEFAULT 3.17,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pricing_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "pricing_settings" ("id") VALUES ('default') ON CONFLICT ("id") DO NOTHING;
