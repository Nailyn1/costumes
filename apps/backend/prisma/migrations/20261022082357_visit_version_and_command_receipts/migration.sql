-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "command_receipts" (
    "id" SERIAL NOT NULL,
    "command_id" TEXT NOT NULL,
    "actor_user_id" INTEGER NOT NULL,
    "command_path" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "command_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "command_receipts_command_id_key" ON "command_receipts"("command_id");

-- CreateIndex
CREATE INDEX "command_receipts_actor_user_id_created_at_idx" ON "command_receipts"("actor_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "command_receipts" ADD CONSTRAINT "command_receipts_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
