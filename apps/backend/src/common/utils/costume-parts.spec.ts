import { parseCostumeParts } from './costume-parts';

describe('parseCostumeParts', () => {
  it('returns a valid list as is', () => {
    expect(parseCostumeParts([{ name: 'Повязка', qty: 2 }])).toEqual([
      { name: 'Повязка', qty: 2 },
    ]);
  });

  it('treats a missing value as an empty list', () => {
    expect(parseCostumeParts(null)).toEqual([]);
    expect(parseCostumeParts(undefined)).toEqual([]);
  });

  it('returns an empty list instead of throwing on garbage', () => {
    expect(parseCostumeParts('шапка')).toEqual([]);
    expect(parseCostumeParts([{ name: '', qty: 0 }])).toEqual([]);
    expect(parseCostumeParts({ name: 'Пояс', qty: 1 })).toEqual([]);
  });
});
