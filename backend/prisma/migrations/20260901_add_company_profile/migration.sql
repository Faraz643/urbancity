-- Add company profile fields used by advertiser links and leaderboard profiles
ALTER TABLE "users" ADD COLUMN "websiteUrl" TEXT;
ALTER TABLE "users" ADD COLUMN "companyDescription" TEXT;
