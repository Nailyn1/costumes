-- AlterTable
ALTER TABLE "costumes" ADD COLUMN     "parts" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "issued_parts" JSONB;
