import {
  buildIdentifierFilters,
  buildPhoneFilters,
  buildWordStartFilters,
  isSearchQueryReady,
  maxScore,
  normalizeSearchQuery,
  scoreIdentifierMatch,
  scorePhoneMatch,
  scoreTextMatch,
  sortBySearchScore,
} from './search.utils';

const q = normalizeSearchQuery;

describe('normalizeSearchQuery', () => {
  it('trims, collapses spaces and lowercases (ru locale)', () => {
    const query = q('  Алия   КАРИМОВА ');

    expect(query.raw).toBe('Алия КАРИМОВА');
    expect(query.text).toBe('алия каримова');
  });

  it('extracts digits from a phone-like query', () => {
    const query = q('+7 (707) 123');

    expect(query.digits).toBe('7707123');
    // 5 нецифровых символов из 12 — это уже не «числовой» запрос
    expect(query.isNumeric).toBe(false);
  });

  it.each([
    ['1648', true],
    ['C-0128', true], // допускается до 2 нецифровых символов (код с префиксом)
    ['Алия', false],
    ['+7707', true],
    ['7', false],
  ])('detects numeric query %s → %s', (raw, expected) => {
    expect(q(raw).isNumeric).toBe(expected);
  });
});

describe('isSearchQueryReady', () => {
  it.each([
    ['', false],
    ['а', false],
    ['ал', true],
    ['16', true],
  ])('"%s" → %s', (raw, expected) => {
    expect(isSearchQueryReady(q(raw))).toBe(expected);
  });
});

describe('scoreTextMatch', () => {
  it('ranks exact > prefix > word start > no match', () => {
    const query = q('аня');

    expect(scoreTextMatch('Аня', query)).toBe(100);
    expect(scoreTextMatch('Анясова', query)).toBe(90);
    expect(scoreTextMatch('Мария Аня', query)).toBe(80);
    expect(scoreTextMatch('Ксюша', query)).toBe(0);
  });

  it('is case-insensitive and ignores extra spaces', () => {
    expect(scoreTextMatch('  ЭЛЬЗА ', q('эльза'))).toBe(100);
  });

  it('treats - . , ( ) / as word separators', () => {
    expect(scoreTextMatch('Анна-Мария', q('мария'))).toBe(80);
  });

  it('returns 0 for empty value or query', () => {
    expect(scoreTextMatch(null, q('аня'))).toBe(0);
    expect(scoreTextMatch('Аня', q(''))).toBe(0);
  });

  // Фиксируем текущее поведение: «Арина» не должна находить «Марина»,
  // потому что поиск идёт только по началу слова, а не по подстроке.
  it('does not match a query in the middle of a word ("Арина" vs "Марина")', () => {
    expect(scoreTextMatch('Марина', q('арина'))).toBe(0);
  });

  it('matches the exact name "Арина"', () => {
    expect(scoreTextMatch('Арина', q('арина'))).toBe(100);
  });

  // T-034: умный поиск — опечатки/«похожие» имена пока не обрабатываются.
  it.todo('ranks "Арина" above "Марина" for the query "Арина" (T-034)');
});

describe('scoreIdentifierMatch', () => {
  it('ranks exact > prefix > substring', () => {
    const query = q('C-0128');

    expect(scoreIdentifierMatch('C-0128', query)).toBe(100);
    expect(scoreIdentifierMatch('C-01289', query)).toBe(85);
    expect(scoreIdentifierMatch('XC-0128', query)).toBe(45);
    expect(scoreIdentifierMatch('C-0001', query)).toBe(0);
  });
});

describe('scorePhoneMatch', () => {
  it('compares digits only', () => {
    const query = q('+7 707 123');

    expect(scorePhoneMatch('+7 (707) 123-45-67', query)).toBe(85);
    expect(scorePhoneMatch('+77071234567', q('77071234567'))).toBe(100);
    expect(scorePhoneMatch('+77071234567', q('1234'))).toBe(55);
    expect(scorePhoneMatch('+77071234567', q('9999'))).toBe(0);
  });

  it('ignores queries with fewer than 2 digits', () => {
    expect(scorePhoneMatch('+77071234567', q('7'))).toBe(0);
  });
});

describe('where-filters', () => {
  it('buildWordStartFilters: prefix + after each separator, insensitive', () => {
    const filters = buildWordStartFilters(q('Аня'));

    expect(filters[0]).toEqual({ startsWith: 'аня', mode: 'insensitive' });
    expect(filters).toContainEqual({
      contains: ' аня',
      mode: 'insensitive',
    });
    expect(filters).toHaveLength(8);
    expect(buildWordStartFilters(q(''))).toEqual([]);
  });

  it('buildIdentifierFilters: startsWith + contains on the raw query', () => {
    expect(buildIdentifierFilters(q('c-01'))).toEqual([
      { startsWith: 'c-01', mode: 'insensitive' },
      { contains: 'c-01', mode: 'insensitive' },
    ]);
  });

  it('buildPhoneFilters: adds startsWith only for "+" queries', () => {
    expect(buildPhoneFilters(q('707'))).toEqual([{ contains: '707' }]);
    expect(buildPhoneFilters(q('+7707'))).toEqual([
      { startsWith: '+7707' },
      { contains: '7707' },
    ]);
    expect(buildPhoneFilters(q('7'))).toEqual([]);
  });
});

describe('maxScore / sortBySearchScore', () => {
  it('maxScore picks the best score, 0 for empty', () => {
    expect(maxScore([0, 85, 45])).toBe(85);
    expect(maxScore([])).toBe(0);
  });

  it('sorts by score desc and keeps original order for ties (stable)', () => {
    const items = [
      { id: 1, score: 80 },
      { id: 2, score: 100 },
      { id: 3, score: 80 },
    ];

    const sorted = sortBySearchScore(items, (item) => item.score);

    expect(sorted.map((i) => i.id)).toEqual([2, 1, 3]);
    expect(items.map((i) => i.id)).toEqual([1, 2, 3]); // исходный массив не мутируется
  });
});
