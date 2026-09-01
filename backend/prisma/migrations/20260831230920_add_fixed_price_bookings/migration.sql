-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "billboardId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL,
    "companyName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bookings_billboardId_fkey" FOREIGN KEY ("billboardId") REFERENCES "billboards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "bookings_billboardId_status_endDate_idx" ON "bookings"("billboardId", "status", "endDate");

-- CreateIndex
CREATE INDEX "bookings_userId_createdAt_idx" ON "bookings"("userId", "createdAt");
