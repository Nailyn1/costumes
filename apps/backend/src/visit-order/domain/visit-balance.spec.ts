import {
  calculateVisitBalance,
  validateVisitSettlement,
  VisitBalanceError,
} from './visit-balance';

const orders = [
  { rentPrice: 5000, prepaymentAmount: 1000 },
  { rentPrice: 3000, prepaymentAmount: 1000 },
];

describe('visit balance', () => {
  it.each([
    [0, 6000, 0],
    [2500, 3500, 0],
    [6000, 0, 0],
    [7000, 0, 1000],
  ])(
    'keeps the full issue payment %i and exposes debt %i or refund %i',
    (paid, debt, refundDue) => {
      const balance = calculateVisitBalance({
        orders,
        operations: paid ? [{ kind: 'issue_payment', amount: paid }] : [],
      });
      expect(balance).toMatchObject({
        totalRent: 8000,
        totalPrepayment: 2000,
        totalReceived: paid,
        debt,
        refundDue,
      });
    },
  );

  it('subtracts later debt payments and adds customer refunds', () => {
    const balance = calculateVisitBalance({
      orders,
      operations: [
        { kind: 'issue_payment', amount: 7000 },
        { kind: 'customer_refund', amount: 600 },
      ],
    });
    expect(balance).toMatchObject({
      totalReceived: 7000,
      totalRefunded: 600,
      signedBalance: -400,
      refundDue: 400,
    });
  });

  it('ignores voided issue payments after unissue', () => {
    const balance = calculateVisitBalance({
      orders,
      operations: [
        { kind: 'issue_payment', amount: 7000, voidedAt: new Date() },
      ],
    });
    expect(balance).toMatchObject({ totalReceived: 0, debt: 6000 });
  });

  it('rejects a settlement beyond the outstanding side of the balance', () => {
    const balance = calculateVisitBalance({
      orders,
      operations: [{ kind: 'issue_payment', amount: 7000 }],
    });
    expect(() =>
      validateVisitSettlement(balance, 'customer_refund', 1001),
    ).toThrow(VisitBalanceError);
    expect(() => validateVisitSettlement(balance, 'debt_payment', 100)).toThrow(
      VisitBalanceError,
    );
    expect(() =>
      validateVisitSettlement(balance, 'customer_refund', 1000),
    ).not.toThrow();
  });
});
