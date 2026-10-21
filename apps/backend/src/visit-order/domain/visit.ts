import {
  calculateVisitBalance,
  validateVisitSettlement,
  type VisitBalance,
  type VisitMoneyOperationKind,
  type VisitSettlementKind,
} from './visit-balance';

export type VisitStatus = 'reserved' | 'issued' | 'completed' | 'cancelled';
export type VisitOrderStatus = 'reserved' | 'issued' | 'returned' | 'cancelled';

export interface VisitOrderSnapshot {
  id: number;
  status: VisitOrderStatus;
  rentPrice: number;
  prepaymentAmount: number;
}

export interface VisitSnapshot {
  status: VisitStatus;
  notes: string | null;
  orders: ReadonlyArray<VisitOrderSnapshot>;
  moneyOperations: ReadonlyArray<{
    kind: VisitMoneyOperationKind;
    amount: number;
    voided: boolean;
  }>;
}

export type VisitRuleCode =
  | 'START_AFTER_RETURN'
  | 'DUPLICATE_COSTUME'
  | 'PREPAYMENT_EXCEEDS_RENT'
  | 'INVALID_ISSUE_PAYMENT'
  | 'CANNOT_ISSUE'
  | 'CANNOT_UNISSUE'
  | 'CANNOT_COMPLETE_RETURN'
  | 'ORDERS_NOT_ISSUED'
  | 'CANNOT_CANCEL'
  | 'BALANCE_NOT_AVAILABLE'
  | 'CANNOT_SETTLE';

export class VisitRuleError extends Error {
  constructor(
    readonly code: VisitRuleCode,
    readonly context: Readonly<{
      status?: VisitStatus;
      rentPrice?: number;
      prepaymentAmount?: number;
    }> = {},
  ) {
    super(code);
  }
}

export interface VisitCreationInput {
  startDateTime: Date;
  endDateTime: Date;
  orders: ReadonlyArray<{
    costumeId: number;
    rentPrice: number;
    prepaymentAmount: number;
  }>;
}

export interface VisitIssueDecision {
  visitStatus: 'issued';
  orderStatus: 'issued';
  orderPayments: ReadonlyArray<{ orderId: number; finalPayment: number }>;
  issuePayment: number | null;
  notes: string | null;
}

export interface VisitUnissueDecision {
  visitStatus: 'reserved';
  orderStatus: 'reserved';
  clearFinalPayment: true;
  voidIssuePayments: true;
  softDeleteDeposit: true;
}

export interface VisitCompleteReturnDecision {
  visitStatus: 'completed';
  orderStatus: 'returned';
  notes: string | null;
  settlement: { kind: VisitSettlementKind; amount: number } | null;
  balance: VisitBalance;
}

export interface VisitCancelDecision {
  visitStatus: 'cancelled';
  orderStatus: 'cancelled';
  notes: string | null;
}

export class Visit {
  private constructor(private readonly snapshot: VisitSnapshot) {}

  static from(snapshot: VisitSnapshot): Visit {
    return new Visit(snapshot);
  }

  static validateCreationStructure(input: VisitCreationInput): void {
    if (input.startDateTime > input.endDateTime) {
      throw new VisitRuleError('START_AFTER_RETURN');
    }
    const costumeIds = input.orders.map((order) => order.costumeId);
    if (new Set(costumeIds).size !== costumeIds.length) {
      throw new VisitRuleError('DUPLICATE_COSTUME');
    }
  }

  static validateCreationMoney(orders: VisitCreationInput['orders']): void {
    for (const order of orders) {
      if (order.rentPrice < order.prepaymentAmount) {
        throw new VisitRuleError('PREPAYMENT_EXCEEDS_RENT', {
          rentPrice: order.rentPrice,
          prepaymentAmount: order.prepaymentAmount,
        });
      }
    }
  }

  static validateIssuePayment(additionalPayment: number): void {
    if (!Number.isSafeInteger(additionalPayment) || additionalPayment < 0) {
      throw new VisitRuleError('INVALID_ISSUE_PAYMENT');
    }
  }

  issue(additionalPayment: number, notes?: string | null): VisitIssueDecision {
    Visit.validateIssuePayment(additionalPayment);
    if (this.snapshot.status !== 'reserved') {
      throw new VisitRuleError('CANNOT_ISSUE', {
        status: this.snapshot.status,
      });
    }

    let remainingPayment = additionalPayment;
    const orderPayments = this.snapshot.orders.map((order) => {
      const debt = order.rentPrice - order.prepaymentAmount;
      const finalPayment = Math.min(remainingPayment, debt);
      remainingPayment -= finalPayment;
      return { orderId: order.id, finalPayment };
    });

    return {
      visitStatus: 'issued',
      orderStatus: 'issued',
      orderPayments,
      issuePayment: additionalPayment > 0 ? additionalPayment : null,
      notes: notes
        ? `${this.snapshot.notes ? `${this.snapshot.notes}\n` : ''}${notes}`
        : this.snapshot.notes,
    };
  }

  unissue(): VisitUnissueDecision {
    if (this.snapshot.status !== 'issued') {
      throw new VisitRuleError('CANNOT_UNISSUE');
    }
    return {
      visitStatus: 'reserved',
      orderStatus: 'reserved',
      clearFinalPayment: true,
      voidIssuePayments: true,
      softDeleteDeposit: true,
    };
  }

  completeReturn(
    notes?: string | null,
    settlement?: { kind: VisitSettlementKind; amount: number } | null,
  ): VisitCompleteReturnDecision {
    if (this.snapshot.status !== 'issued') {
      throw new VisitRuleError('CANNOT_COMPLETE_RETURN');
    }
    if (this.snapshot.orders.some((order) => order.status !== 'issued')) {
      throw new VisitRuleError('ORDERS_NOT_ISSUED');
    }
    const balance = this.balance();
    if (settlement) {
      validateVisitSettlement(balance, settlement.kind, settlement.amount);
    }
    return {
      visitStatus: 'completed',
      orderStatus: 'returned',
      notes: notes
        ? `${this.snapshot.notes || ''}\n[Завершение]: ${notes}`.trim()
        : this.snapshot.notes,
      settlement: settlement ?? null,
      balance: settlement ? this.calculateBalance(settlement) : balance,
    };
  }

  cancel(reason?: string | null): VisitCancelDecision {
    if (this.snapshot.status !== 'reserved') {
      throw new VisitRuleError('CANNOT_CANCEL', {
        status: this.snapshot.status,
      });
    }
    return {
      visitStatus: 'cancelled',
      orderStatus: 'cancelled',
      notes: reason
        ? `${this.snapshot.notes || ''}\n[Причина отмены]: ${reason}`.trim()
        : this.snapshot.notes,
    };
  }

  balance(): VisitBalance {
    return this.calculateBalance();
  }

  private calculateBalance(settlement?: {
    kind: VisitSettlementKind;
    amount: number;
  }): VisitBalance {
    return calculateVisitBalance({
      orders: this.snapshot.orders,
      operations: [
        ...this.snapshot.moneyOperations
          .filter((operation) => !operation.voided)
          .map((operation) => ({
            kind: operation.kind,
            amount: operation.amount,
          })),
        ...(settlement ? [settlement] : []),
      ],
    });
  }

  availableBalance(): VisitBalance {
    if (
      this.snapshot.status !== 'issued' &&
      this.snapshot.status !== 'completed'
    ) {
      throw new VisitRuleError('BALANCE_NOT_AVAILABLE');
    }
    return this.balance();
  }

  settle(settlement: {
    kind: VisitSettlementKind;
    amount: number;
  }): VisitBalance {
    if (this.snapshot.status !== 'completed') {
      throw new VisitRuleError('CANNOT_SETTLE');
    }
    validateVisitSettlement(this.balance(), settlement.kind, settlement.amount);
    return this.calculateBalance(settlement);
  }
}
