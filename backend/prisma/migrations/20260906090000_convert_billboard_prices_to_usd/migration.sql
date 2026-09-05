-- UrbanCity pricing is now stored in USD.
-- minBid is the editable 30-minute base price used by checkout and the admin dashboard.
-- Preserve the existing inventory IDs while converting the launch prices.

UPDATE "billboards" SET "minBid" = 0.21 WHERE "id" IN ('102','207','102-L','102-R','207-L','207-R');
UPDATE "billboards" SET "minBid" = 1.05 WHERE "id" IN ('501','502','503','504','W01','W02','W03','W04','W05','W06','W07','W08','W09','W10','W11');

-- New database-created boards should also start in USD.
ALTER TABLE "billboards" ALTER COLUMN "minBid" SET DEFAULT 0.21;

-- Existing payment records represent the UrbanCity system currency.
UPDATE "payments" SET "currency" = 'USD' WHERE "currency" = 'INR';
