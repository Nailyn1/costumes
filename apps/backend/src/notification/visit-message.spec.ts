import { buildVisitMessage } from '../common/utils/visit-message.utils';
import type { VisitWithDetails } from './notification.service';

const makeOrder = (
  childName: string,
  costumeName: string,
  rentPrice: number,
  prepaymentAmount: number,
) => ({
  rentPrice,
  prepaymentAmount,
  child: { name: childName },
  costume: { name: costumeName },
});

const makeVisit = (orders: ReturnType<typeof makeOrder>[]) =>
  ({
    visitCode: '4821',
    startDateTime: new Date('2026-12-20T00:00:00Z'),
    endDateTime: new Date('2026-12-21T00:00:00Z'),
    issueTimeFrom: '10:00',
    issueTimeTo: '19:00',
    returnTimeUntil: '18:00',
    client: { name: 'Алия' },
    orders,
  }) as unknown as VisitWithDetails;

describe('buildVisitMessage', () => {
  const single = () =>
    buildVisitMessage(makeVisit([makeOrder('Маша', 'Эльза', 5000, 1000)]));

  it('greets the client and shows the issue code', () => {
    const text = single();
    expect(text).toContain('Здравствуйте, Алия!');
    expect(text).toContain('Код выдачи: *4821*');
  });

  it('lists each child with costume, price and prepayment', () => {
    const text = buildVisitMessage(
      makeVisit([
        makeOrder('Маша', 'Эльза', 5000, 1000),
        makeOrder('Миша', 'Человек-паук', 4000, 4000),
      ]),
    );
    expect(text).toContain('1. *Маша*: Эльза');
    expect(text).toContain('  Цена: 5000 | Внесено: 1000');
    expect(text).toContain('2. *Миша*: Человек-паук');
    expect(text).toContain('  Цена: 4000 | Внесено: 4000');
  });

  it('adds totals and balance for several orders', () => {
    const text = buildVisitMessage(
      makeVisit([
        makeOrder('Маша', 'Эльза', 5000, 1000),
        makeOrder('Миша', 'Человек-паук', 4000, 500),
      ]),
    );
    expect(text).toContain('Общая стоимость: 9000');
    expect(text).toContain('Всего внесено: 1500');
    expect(text).toContain('Остаток к оплате: *7500*');
  });

  it('shows only the balance for a single order with debt', () => {
    const text = single();
    expect(text).toContain('Остаток к оплате: *4000*');
    expect(text).not.toContain('ИТОГО');
  });

  it('shows no balance for a fully prepaid single order', () => {
    const text = buildVisitMessage(
      makeVisit([makeOrder('Маша', 'Эльза', 5000, 5000)]),
    );
    expect(text).not.toContain('Остаток к оплате');
    expect(text).not.toContain('ИТОГО');
  });

  it('states the rental conditions', () => {
    const text = single();
    expect(text).toContain('залог при выдаче — от 5 000 ₸');
    expect(text).toContain('предоплата не возвращается');
  });

  it('shows issue and return schedule', () => {
    const text = single();
    expect(text).toContain('Выдача: 20.12.2026 (с 10:00 до 19:00)');
    expect(text).toContain('Возврат: 21.12.2026 (до 18:00)');
  });

  it('asks the client to reply to confirm', () => {
    expect(single()).toContain('ответьте на это сообщение');
  });
});
