import type { VisitReadDetailDto } from "@costumes/shared";

export interface AddIssuedRentLine {
  rentPrice: number;
}

export interface AddIssuedBalancePreview {
  currentSignedBalance: number;
  addedRent: number;
  existingPrepayment: number;
  additionalPaymentsBefore: number;
  receivedNow: number;
  totalRentAfter: number;
  totalReceivedAfter: number;
  totalRefundedAfter: number;
  signedBalanceAfter: number;
  debtAfter: number;
  refundDueAfter: number;
}

function toAmount(value: number | string): number {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function getCurrentSignedBalance(visit: VisitReadDetailDto): number {
  if (visit.balance) return visit.balance.signedBalance;

  const totalReceived = visit.moneyOperations
    .filter((operation) => !operation.voidedAt && operation.kind !== "customer_refund")
    .reduce((total, operation) => total + operation.amount, 0);
  const totalRefunded = visit.moneyOperations
    .filter((operation) => !operation.voidedAt && operation.kind === "customer_refund")
    .reduce((total, operation) => total + operation.amount, 0);

  return visit.totals.totalRent - visit.totals.totalPrepayment - totalReceived + totalRefunded;
}

/** Preview the whole-visit balance after the new orders and money received now. */
export function calculateAddIssuedBalance(
  visit: VisitReadDetailDto,
  orders: readonly AddIssuedRentLine[],
  receivedNow: number | string,
): AddIssuedBalancePreview {
  const addedRent = orders.reduce((total, order) => total + toAmount(order.rentPrice), 0);
  const receivedAmount = toAmount(receivedNow);
  const currentSignedBalance = getCurrentSignedBalance(visit);
  const totalRefundedAfter = visit.balance?.totalRefunded ?? visit.moneyOperations
    .filter((operation) => !operation.voidedAt && operation.kind === "customer_refund")
    .reduce((total, operation) => total + operation.amount, 0);
  const totalReceivedAfter = (visit.balance?.totalReceived ?? visit.moneyOperations
    .filter((operation) => !operation.voidedAt && operation.kind !== "customer_refund")
    .reduce((total, operation) => total + operation.amount, 0)) + receivedAmount;
  const signedBalanceAfter = currentSignedBalance + addedRent - receivedAmount;

  return {
    currentSignedBalance,
    addedRent,
    existingPrepayment: visit.totals.totalPrepayment,
    additionalPaymentsBefore: totalReceivedAfter - receivedAmount,
    receivedNow: receivedAmount,
    totalRentAfter: visit.totals.totalRent + addedRent,
    totalReceivedAfter,
    totalRefundedAfter,
    signedBalanceAfter,
    debtAfter: Math.max(signedBalanceAfter, 0),
    refundDueAfter: Math.max(-signedBalanceAfter, 0),
  };
}
