-- CreateEnum
CREATE TYPE "VisitMoneyOperationKind" AS ENUM ('issue_payment', 'debt_payment', 'customer_refund');

-- CreateTable
CREATE TABLE "visit_money_operations" (
    "id" SERIAL NOT NULL,
    "visit_id" INTEGER NOT NULL,
    "kind" "VisitMoneyOperationKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "legacy_imported" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMP(3),

    CONSTRAINT "visit_money_operations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "visit_money_operations_amount_positive" CHECK ("amount" > 0)
);

-- CreateIndex
CREATE INDEX "visit_money_operations_visit_id_voided_at_idx" ON "visit_money_operations"("visit_id", "voided_at");

-- AddForeignKey
ALTER TABLE "visit_money_operations" ADD CONSTRAINT "visit_money_operations_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Previously received issue payments were stored across Order.finalPayment.
-- Import them once per issued/completed visit. Future balance calculations use
-- this ledger and must not add Order.finalPayment again.
INSERT INTO "visit_money_operations" (
    "visit_id", "kind", "amount", "legacy_imported"
)
SELECT
    v."id",
    'issue_payment'::"VisitMoneyOperationKind",
    SUM(o."final_payment")::INTEGER,
    true
FROM "visits" AS v
JOIN "orders" AS o ON o."visit_id" = v."id"
WHERE v."status" IN ('issued', 'completed')
  AND o."deleted_at" IS NULL
  AND o."status" <> 'cancelled'
  AND o."final_payment" IS NOT NULL
GROUP BY v."id"
HAVING SUM(o."final_payment") > 0;
