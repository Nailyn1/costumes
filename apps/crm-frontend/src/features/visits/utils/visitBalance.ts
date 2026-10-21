export function issueBalance(remainingToPay: number, additionalPayment: number) {
  const signedBalance = remainingToPay - additionalPayment;
  return {
    debt: Math.max(0, signedBalance),
    refundDue: Math.max(0, -signedBalance),
  };
}
