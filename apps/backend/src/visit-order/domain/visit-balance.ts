export type VisitMoneyOperationKind =
  'issue_payment' | 'debt_payment' | 'customer_refund';

export interface VisitMoneyOperationInput {
  kind: VisitMoneyOperationKind;
  amount: number;
  voidedAt?: Date | null;
}

export interface VisitBalanceInput {
  orders: ReadonlyArray<{ rentPrice: number; prepaymentAmount: number }>;
  operations: ReadonlyArray<VisitMoneyOperationInput>;
}

export interface VisitBalance {
  [key: string]: unknown;
  totalRent: number;
  totalPrepayment: number;
  totalReceived: number;
  totalRefunded: number;
  signedBalance: number;
  debt: number;
  refundDue: number;
}

export type VisitSettlementKind = 'debt_payment' | 'customer_refund';

export class VisitBalanceError extends Error {
  constructor(
    readonly code:
      'INVALID_AMOUNT' | 'NO_DEBT' | 'NO_REFUND_DUE' | 'EXCEEDS_BALANCE',
  ) {
    super(code);
  }
}

export function calculateVisitBalance(input: VisitBalanceInput): VisitBalance {
  const totalRent = input.orders.reduce(
    (sum, order) => sum + order.rentPrice,
    0,
  );
  const totalPrepayment = input.orders.reduce(
    (sum, order) => sum + order.prepaymentAmount,
    0,
  );
  const activeOperations = input.operations.filter(
    (operation) => !operation.voidedAt,
  );
  const totalReceived = activeOperations.reduce(
    (sum, operation) =>
      operation.kind === 'customer_refund' ? sum : sum + operation.amount,
    0,
  );
  const totalRefunded = activeOperations.reduce(
    (sum, operation) =>
      operation.kind === 'customer_refund' ? sum + operation.amount : sum,
    0,
  );
  const signedBalance =
    totalRent - totalPrepayment - totalReceived + totalRefunded;
  return {
    totalRent,
    totalPrepayment,
    totalReceived,
    totalRefunded,
    signedBalance,
    debt: Math.max(signedBalance, 0),
    refundDue: Math.max(-signedBalance, 0),
  };
}

export function validateVisitSettlement(
  balance: VisitBalance,
  kind: VisitSettlementKind,
  amount: number,
): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new VisitBalanceError('INVALID_AMOUNT');
  }
  if (kind === 'debt_payment') {
    if (balance.debt === 0) throw new VisitBalanceError('NO_DEBT');
    if (amount > balance.debt) throw new VisitBalanceError('EXCEEDS_BALANCE');
    return;
  }
  if (balance.refundDue === 0) throw new VisitBalanceError('NO_REFUND_DUE');
  if (amount > balance.refundDue)
    throw new VisitBalanceError('EXCEEDS_BALANCE');
}
