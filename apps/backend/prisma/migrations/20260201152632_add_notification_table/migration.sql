-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "visit_id" INTEGER NOT NULL,
    "external_id" TEXT,
    "type" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "error_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_external_id_key" ON "notifications"("external_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
