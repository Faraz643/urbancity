CREATE TABLE "billboard_footfall" (
  "billboardId" TEXT NOT NULL,
  "total" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billboard_footfall_pkey" PRIMARY KEY ("billboardId")
);