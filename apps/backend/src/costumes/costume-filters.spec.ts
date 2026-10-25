import { BadRequestException } from '@nestjs/common';
import { assertHeightRange, buildCostumeFilterWhere } from './costume-filters';

describe('buildCostumeFilterWhere', () => {
  it('adds no conditions without filters', () => {
    expect(buildCostumeFilterWhere({})).toEqual([]);
  });

  it('includes subcategories when filtering by a main category', () => {
    expect(buildCostumeFilterWhere({ categoryId: 2 })).toEqual([
      { category: { deletedAt: null, OR: [{ id: 2 }, { parentId: 2 }] } },
    ]);
  });

  it('treats a costume with a deleted category as uncategorized', () => {
    expect(buildCostumeFilterWhere({ withoutCategory: true })).toEqual([
      {
        OR: [{ categoryId: null }, { category: { deletedAt: { not: null } } }],
      },
    ]);
  });

  it('rejects a category together with withoutCategory', () => {
    expect(() =>
      buildCostumeFilterWhere({ categoryId: 2, withoutCategory: true }),
    ).toThrow(BadRequestException);
  });

  it('matches a child height against the range and single-bound costumes', () => {
    expect(buildCostumeFilterWhere({ height: 110 })).toEqual([
      {
        OR: [
          { heightFrom: { lte: 110 }, heightTo: { gte: 110 } },
          { heightFrom: 110, heightTo: null },
          { heightFrom: null, heightTo: 110 },
        ],
      },
    ]);
  });

  it('combines gender with the other filters', () => {
    expect(
      buildCostumeFilterWhere({ gender: 'girl', categoryId: 1 }),
    ).toHaveLength(2);
  });
});

describe('assertHeightRange', () => {
  it('accepts an ordered, equal, single-bound or empty range', () => {
    expect(() => assertHeightRange(104, 116)).not.toThrow();
    expect(() => assertHeightRange(110, 110)).not.toThrow();
    expect(() => assertHeightRange(110, null)).not.toThrow();
    expect(() => assertHeightRange(undefined, undefined)).not.toThrow();
  });

  it('rejects a lower bound above the upper one', () => {
    expect(() => assertHeightRange(120, 104)).toThrow(
      new BadRequestException('Рост «от» не может быть больше роста «до»'),
    );
  });
});
