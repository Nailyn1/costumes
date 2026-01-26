-- AlterTable
ALTER TABLE "child" ADD COLUMN     "delete_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "child_delete_at_idx" ON "child"("delete_at");
