CREATE TABLE "ad_clicks" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "billboard_id" TEXT NOT NULL,
  "visitor_id" TEXT NOT NULL,
  "clicked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "clicked_day" DATE NOT NULL DEFAULT CURRENT_DATE,
  CONSTRAINT "ad_clicks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ad_clicks_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ad_clicks_billboard_id_fkey" FOREIGN KEY ("billboard_id") REFERENCES "billboards"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ad_clicks_booking_id_clicked_at_idx" ON "ad_clicks"("booking_id", "clicked_at");
CREATE INDEX "ad_clicks_billboard_id_clicked_at_idx" ON "ad_clicks"("billboard_id", "clicked_at");
CREATE UNIQUE INDEX "ad_clicks_booking_id_visitor_id_day_key" ON "ad_clicks"("booking_id", "visitor_id", "clicked_day");
