CREATE SEQUENCE IF NOT EXISTS costume_code_seq START 1;

CREATE OR REPLACE FUNCTION generate_costume_code()
RETURNS TEXT AS $$
BEGIN
    RETURN 'C-' || LPAD(nextval('costume_code_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- CreateEnum
CREATE TYPE "CostumeStatus" AS ENUM ('available', 'issued');

-- CreateTable
CREATE TABLE "costumes" (
    "id" SERIAL NOT NULL,
    "inventory_code" TEXT NOT NULL DEFAULT generate_costume_code(),
    "name" TEXT NOT NULL,
    "status" "CostumeStatus" NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "costumes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "costumes_inventory_code_key" ON "costumes"("inventory_code");
