-- CreateEnum
CREATE TYPE "CostumeGender" AS ENUM ('girl', 'boy', 'unisex');

-- AlterTable
ALTER TABLE "costumes" ADD COLUMN     "category_id" INTEGER,
ADD COLUMN     "gender" "CostumeGender",
ADD COLUMN     "height_from" INTEGER,
ADD COLUMN     "height_to" INTEGER,
ADD COLUMN     "size_label" TEXT;

-- CreateTable
CREATE TABLE "costume_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "costume_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "costume_categories_parent_id_idx" ON "costume_categories"("parent_id");

-- CreateIndex
CREATE INDEX "costumes_category_id_idx" ON "costumes"("category_id");

-- AddForeignKey
ALTER TABLE "costumes" ADD CONSTRAINT "costumes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "costume_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costume_categories" ADD CONSTRAINT "costume_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "costume_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Стартовый справочник категорий (дальше редактируется в интерфейсе)
INSERT INTO "costume_categories" ("name", "parent_id", "sort_order", "updated_at")
SELECT v.name, NULL, v.sort_order, CURRENT_TIMESTAMP
FROM (VALUES ('Национальные', 1), ('Новогодние', 2)) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM "costume_categories" c
  WHERE c."name" = v.name AND c."parent_id" IS NULL AND c."deleted_at" IS NULL
);

INSERT INTO "costume_categories" ("name", "parent_id", "sort_order", "updated_at")
SELECT v.name, p."id", v.sort_order, CURRENT_TIMESTAMP
FROM (VALUES
  ('Национальные', 'Кавказские', 1),
  ('Национальные', 'Татарские', 2),
  ('Национальные', 'Немецкие', 3),
  ('Национальные', 'Русские', 4),
  ('Национальные', 'Белорусские', 5),
  ('Национальные', 'Украинские', 6),
  ('Национальные', 'Казахские', 7),
  ('Новогодние', 'Супергерои', 1),
  ('Новогодние', 'Классические', 2),
  ('Новогодние', 'Животные', 3),
  ('Новогодние', 'Снеговики', 4)
) AS v(parent_name, name, sort_order)
JOIN "costume_categories" p
  ON p."name" = v.parent_name AND p."parent_id" IS NULL AND p."deleted_at" IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM "costume_categories" c
  WHERE c."name" = v.name AND c."parent_id" = p."id" AND c."deleted_at" IS NULL
);
