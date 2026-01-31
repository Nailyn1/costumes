/*
  Warnings:

  - You are about to drop the column `delete_at` on the `clients` table. All the data in the column will be lost.
  - You are about to drop the column `delete_at` on the `costumes` table. All the data in the column will be lost.
  - You are about to drop the `child` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DepositType" AS ENUM ('document', 'cash', 'none');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('reserved', 'issued', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('reserved', 'issued', 'returned');

-- CreateEnum
CREATE TYPE "TagStatus" AS ENUM ('written', 'not_written');

-- DropForeignKey
ALTER TABLE "child" DROP CONSTRAINT "child_client_id_fkey";

-- AlterTable
ALTER TABLE "clients" DROP COLUMN "delete_at",
ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "costumes" DROP COLUMN "delete_at",
ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- DropTable
DROP TABLE "child";

-- DropTable
DROP TABLE "user";

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "login" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "children" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "client_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" SERIAL NOT NULL,
    "visit_code" TEXT NOT NULL,
    "client_id" INTEGER NOT NULL,
    "start_date_time" TIMESTAMP(3) NOT NULL,
    "end_date_time" TIMESTAMP(3) NOT NULL,
    "issue_time_from" TEXT NOT NULL,
    "issue_time_to" TEXT NOT NULL,
    "return_time_until" TEXT NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'reserved',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "visit_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "child_id" INTEGER NOT NULL,
    "costume_id" INTEGER NOT NULL,
    "start_date_time" TIMESTAMP(3) NOT NULL,
    "end_date_time" TIMESTAMP(3) NOT NULL,
    "rent_price" INTEGER NOT NULL,
    "prepayment_amount" INTEGER NOT NULL DEFAULT 0,
    "tag_status" "TagStatus" NOT NULL DEFAULT 'not_written',
    "status" "OrderStatus" NOT NULL DEFAULT 'reserved',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposits" (
    "id" SERIAL NOT NULL,
    "visit_id" INTEGER NOT NULL,
    "type" "DepositType" NOT NULL DEFAULT 'none',
    "returned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_login_key" ON "users"("login");

-- CreateIndex
CREATE INDEX "children_deleted_at_idx" ON "children"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "visits_visit_code_key" ON "visits"("visit_code");

-- CreateIndex
CREATE UNIQUE INDEX "deposits_visit_id_key" ON "deposits"("visit_id");

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_costume_id_fkey" FOREIGN KEY ("costume_id") REFERENCES "costumes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
