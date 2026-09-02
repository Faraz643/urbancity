-- Prevent more than one user from reaching payment checkout for the same billboard.
CREATE TABLE "checkout_locks" (
  "id" TEXT NOT NULL,
  "billboardId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bookingId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "checkout_locks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "checkout_locks_billboardId_key" ON "checkout_locks"("billboardId");
CREATE UNIQUE INDEX "checkout_locks_bookingId_key" ON "checkout_locks"("bookingId");
CREATE INDEX "checkout_locks_expiresAt_idx" ON "checkout_locks"("expiresAt");
