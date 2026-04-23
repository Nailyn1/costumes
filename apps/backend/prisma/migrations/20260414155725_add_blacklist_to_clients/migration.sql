-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "blacklist_reason" TEXT,
ADD COLUMN     "is_blacklisted" BOOLEAN NOT NULL DEFAULT false;
