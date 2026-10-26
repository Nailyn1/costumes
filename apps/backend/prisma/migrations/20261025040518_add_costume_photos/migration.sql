-- CreateTable
CREATE TABLE "costume_photos" (
    "id" SERIAL NOT NULL,
    "costume_id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "thumb_key" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "costume_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "costume_photos_costume_id_deleted_at_sort_order_idx" ON "costume_photos"("costume_id", "deleted_at", "sort_order");

-- AddForeignKey
ALTER TABLE "costume_photos" ADD CONSTRAINT "costume_photos_costume_id_fkey" FOREIGN KEY ("costume_id") REFERENCES "costumes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costume_photos" ADD CONSTRAINT "costume_photos_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
