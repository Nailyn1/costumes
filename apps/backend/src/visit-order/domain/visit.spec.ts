import { Visit, VisitRuleError, type VisitSnapshot } from './visit';

const reserved: VisitSnapshot = {
  status: 'reserved',
  notes: 'Исходная заметка',
  orders: [
    { id: 1, status: 'reserved', rentPrice: 5000, prepaymentAmount: 1000 },
    { id: 2, status: 'reserved', rentPrice: 3000, prepaymentAmount: 500 },
  ],
  moneyOperations: [],
};

describe('Visit creation rules', () => {
  const creation = {
    startDateTime: new Date('2026-12-20T10:00:00Z'),
    endDateTime: new Date('2026-12-21T18:00:00Z'),
    orders: [
      { costumeId: 1, rentPrice: 5000, prepaymentAmount: 0 },
      { costumeId: 2, rentPrice: 3000, prepaymentAmount: 500 },
    ],
  };

  it('accepts zero prepayment and separate costumes', () => {
    expect(() => Visit.validateCreationStructure(creation)).not.toThrow();
    expect(() => Visit.validateCreationMoney(creation.orders)).not.toThrow();
  });

  it('rejects reversed dates, repeated costume and excessive prepayment', () => {
    expect(() =>
      Visit.validateCreationStructure({
        ...creation,
        startDateTime: new Date('2026-12-22T10:00:00Z'),
      }),
    ).toThrow(new VisitRuleError('START_AFTER_RETURN'));
    expect(() =>
      Visit.validateCreationStructure({
        ...creation,
        orders: [creation.orders[0], creation.orders[0]],
      }),
    ).toThrow(new VisitRuleError('DUPLICATE_COSTUME'));
    expect(() =>
      Visit.validateCreationMoney([
        { costumeId: 1, rentPrice: 100, prepaymentAmount: 101 },
      ]),
    ).toThrow(
      new VisitRuleError('PREPAYMENT_EXCEEDS_RENT', {
        rentPrice: 100,
        prepaymentAmount: 101,
      }),
    );
  });
});

describe('Visit transitions', () => {
  it('adds issued orders to an issued visit without changing old order payments', () => {
    const snapshot = {
      ...reserved,
      status: 'issued' as const,
      orders: reserved.orders.map((order) => ({
        ...order,
        status: 'issued' as const,
      })),
    };
    expect(
      Visit.from(snapshot).addAndIssue(
        [
          { costumeId: 3, rentPrice: 4000 },
          { costumeId: 4, rentPrice: 3000 },
        ],
        5000,
        [1, 2],
      ),
    ).toEqual({
      addedOrders: [
        { costumeId: 3, finalPayment: 4000 },
        { costumeId: 4, finalPayment: 1000 },
      ],
      issuePayment: 5000,
    });
    expect(() =>
      Visit.from(snapshot).addAndIssue(
        [{ costumeId: 1, rentPrice: 100 }],
        0,
        [1, 2],
      ),
    ).toThrow(new VisitRuleError('DUPLICATE_COSTUME'));
  });

  it('rejects add-and-issue unless the visit and all old orders are issued', () => {
    expect(() =>
      Visit.from(reserved).addAndIssue([{ costumeId: 3, rentPrice: 100 }], 0),
    ).toThrow(
      new VisitRuleError('CANNOT_ADD_AND_ISSUE', { status: 'reserved' }),
    );
    expect(() =>
      Visit.from({
        ...reserved,
        status: 'issued',
        orders: [{ ...reserved.orders[0], status: 'reserved' }],
      }).addAndIssue([{ costumeId: 3, rentPrice: 100 }], 0),
    ).toThrow(new VisitRuleError('ORDERS_NOT_ISSUED'));
  });

  it('issues every order, caps historic finalPayment but records full payment', () => {
    const decision = Visit.from(reserved).issue(9000, 'Выдано');
    expect(decision).toEqual({
      visitStatus: 'issued',
      orderStatus: 'issued',
      orderPayments: [
        { orderId: 1, finalPayment: 4000 },
        { orderId: 2, finalPayment: 2500 },
      ],
      issuePayment: 9000,
      notes: 'Исходная заметка\nВыдано',
    });
    expect(Visit.from(reserved).issue(0).issuePayment).toBeNull();
  });

  it('rejects a second issue but does not add an order-status gate', () => {
    expect(() =>
      Visit.from({ ...reserved, status: 'issued' }).issue(0),
    ).toThrow(new VisitRuleError('CANNOT_ISSUE', { status: 'issued' }));
    expect(
      Visit.from({
        ...reserved,
        orders: [{ ...reserved.orders[0], status: 'returned' }],
      }).issue(0).orderStatus,
    ).toBe('issued');
  });

  it('unissues only an issued visit and voids the issue payment', () => {
    expect(Visit.from({ ...reserved, status: 'issued' }).unissue()).toEqual({
      visitStatus: 'reserved',
      orderStatus: 'reserved',
      clearFinalPayment: true,
      voidIssuePayments: true,
      softDeleteDeposit: true,
    });
    expect(() => Visit.from(reserved).unissue()).toThrow(
      new VisitRuleError('CANNOT_UNISSUE'),
    );
  });

  it('returns all orders and settles an overpayment without considering the deposit', () => {
    const visit = Visit.from({
      ...reserved,
      status: 'issued',
      orders: reserved.orders.map((order) => ({ ...order, status: 'issued' })),
      moneyOperations: [{ kind: 'issue_payment', amount: 9000, voided: false }],
    });
    const decision = visit.completeReturn('Всё вернули', {
      kind: 'customer_refund',
      amount: 2500,
    });
    expect(decision.visitStatus).toBe('completed');
    expect(decision.orderStatus).toBe('returned');
    expect(decision.notes).toBe('Исходная заметка\n[Завершение]: Всё вернули');
    expect(decision.balance.signedBalance).toBe(0);
    expect(decision.settlement).toEqual({
      kind: 'customer_refund',
      amount: 2500,
    });
  });

  it('blocks return when any order is not issued, but allows an open debt', () => {
    const issued = { ...reserved, status: 'issued' as const };
    expect(() => Visit.from(issued).completeReturn()).toThrow(
      new VisitRuleError('ORDERS_NOT_ISSUED'),
    );
    const ready = Visit.from({
      ...issued,
      orders: reserved.orders.map((order) => ({ ...order, status: 'issued' })),
    });
    expect(ready.completeReturn().balance.debt).toBe(6500);
  });

  it('cancels only a reserved visit and preserves the existing note format', () => {
    expect(Visit.from(reserved).cancel('Ошибка')).toEqual({
      visitStatus: 'cancelled',
      orderStatus: 'cancelled',
      notes: 'Исходная заметка\n[Причина отмены]: Ошибка',
    });
    expect(() =>
      Visit.from({ ...reserved, status: 'issued' }).cancel(),
    ).toThrow(new VisitRuleError('CANNOT_CANCEL', { status: 'issued' }));
  });

  it('settles only completed visits against active money operations', () => {
    const completed = Visit.from({
      ...reserved,
      status: 'completed',
      moneyOperations: [
        { kind: 'issue_payment', amount: 3000, voided: true },
        { kind: 'issue_payment', amount: 2000, voided: false },
      ],
    });
    expect(completed.balance().debt).toBe(4500);
    expect(completed.settle({ kind: 'debt_payment', amount: 1500 }).debt).toBe(
      3000,
    );
    expect(() =>
      Visit.from(reserved).settle({ kind: 'debt_payment', amount: 1 }),
    ).toThrow(new VisitRuleError('CANNOT_SETTLE'));
    expect(() => Visit.from(reserved).availableBalance()).toThrow(
      new VisitRuleError('BALANCE_NOT_AVAILABLE'),
    );
  });
});
