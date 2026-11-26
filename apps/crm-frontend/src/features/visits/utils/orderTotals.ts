import type { VisitOrder } from "../types/visitTypes";

export interface OrderTotals {
  rent: number;
  prepayment: number;
  remaining: number;
}

/** Итоги визита по заказам формы брони: аренда, внесено, осталось (domain.md §1). */
export function calcOrderTotals(
  orders: Pick<VisitOrder, "rentPrice" | "prepaymentAmount">[],
): OrderTotals {
  const { rent, prepayment } = orders.reduce(
    (acc, order) => ({
      rent: acc.rent + (Number(order.rentPrice) || 0),
      prepayment: acc.prepayment + (Number(order.prepaymentAmount) || 0),
    }),
    { rent: 0, prepayment: 0 },
  );

  return { rent, prepayment, remaining: rent - prepayment };
}
