-- UrbanCity pricing is stored in USD.
-- minBid is an inventory display/base value; authoritative booking prices are stored in pricing_settings.

UPDATE "billboards" SET "minBid" = 0.50 WHERE "id" IN ('102','207','102-L','102-R','207-L','207-R');
UPDATE "billboards" SET "minBid" = 0.30 WHERE "id" IN ('W01','W02','W03','W04','W05','W06','W07','W08','W09','W10','W11');
UPDATE "billboards" SET "minBid" = 0.20 WHERE "id" IN ('501','502','503','504');
ALTER TABLE "billboards" ALTER COLUMN "minBid" SET DEFAULT 0.50;
UPDATE "payments" SET "currency" = 'USD' WHERE "currency" = 'INR';
