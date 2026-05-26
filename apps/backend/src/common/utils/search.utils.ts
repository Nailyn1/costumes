import { Prisma } from '../../prisma/generated/client';

export interface NormalizedSearchQuery {
  raw: string;
  text: string;
  digits: string;
  isNumeric: boolean;
}

const WORD_SEPARATORS = [' ', '-', '.', ',', '(', ')', '/'];

export function normalizeSearchQuery(query: string): NormalizedSearchQuery {
  const raw = query.trim().replace(/\s+/g, ' ');
  const digits = raw.replace(/\D/g, '');
  const text = raw.toLocaleLowerCase('ru-RU');

  return {
    raw,
    text,
    digits,
    isNumeric: digits.length >= 2 && digits.length >= raw.length - 2,
  };
}

export function isSearchQueryReady(query: NormalizedSearchQuery): boolean {
  return query.text.length >= 2 || query.digits.length >= 2;
}

export function buildWordStartFilters(
  query: NormalizedSearchQuery,
): Prisma.StringFilter[] {
  if (!query.text) return [];

  return [
    { startsWith: query.text, mode: 'insensitive' },
    ...WORD_SEPARATORS.map((separator) => ({
      contains: `${separator}${query.text}`,
      mode: 'insensitive' as const,
    })),
  ];
}

export function buildIdentifierFilters(
  query: NormalizedSearchQuery,
): Prisma.StringFilter[] {
  if (!query.raw) return [];

  return [
    { startsWith: query.raw, mode: 'insensitive' },
    { contains: query.raw, mode: 'insensitive' },
  ];
}

export function buildPhoneFilters(
  query: NormalizedSearchQuery,
): Prisma.StringFilter[] {
  if (query.digits.length < 2) return [];

  const filters: Prisma.StringFilter[] = [{ contains: query.digits }];

  if (query.raw.startsWith('+')) {
    filters.unshift({ startsWith: query.raw });
  }

  return filters;
}

function normalizeValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU');
}

function startsWithWord(value: string, query: string): boolean {
  const normalizedValue = normalizeValue(value);

  return (
    normalizedValue.startsWith(query) ||
    WORD_SEPARATORS.some((separator) =>
      normalizedValue.includes(`${separator}${query}`),
    )
  );
}

export function scoreTextMatch(
  value: string | null | undefined,
  query: NormalizedSearchQuery,
): number {
  if (!value || !query.text) return 0;

  const normalizedValue = normalizeValue(value);

  if (normalizedValue === query.text) return 100;
  if (normalizedValue.startsWith(query.text)) return 90;
  if (startsWithWord(normalizedValue, query.text)) return 80;

  return 0;
}

export function scoreIdentifierMatch(
  value: string | null | undefined,
  query: NormalizedSearchQuery,
): number {
  if (!value || !query.raw) return 0;

  const normalizedValue = normalizeValue(value);
  const normalizedQuery = query.raw.toLocaleLowerCase('ru-RU');

  if (normalizedValue === normalizedQuery) return 100;
  if (normalizedValue.startsWith(normalizedQuery)) return 85;
  if (normalizedValue.includes(normalizedQuery)) return 45;

  return 0;
}

export function scorePhoneMatch(
  value: string | null | undefined,
  query: NormalizedSearchQuery,
): number {
  if (!value || query.digits.length < 2) return 0;

  const digits = value.replace(/\D/g, '');

  if (digits === query.digits) return 100;
  if (digits.startsWith(query.digits)) return 85;
  if (digits.includes(query.digits)) return 55;

  return 0;
}

export function maxScore(scores: number[]): number {
  return scores.reduce((max, score) => Math.max(max, score), 0);
}

export function sortBySearchScore<T>(
  items: T[],
  getScore: (item: T) => number,
): T[] {
  return [...items]
    .map((item, index) => ({ item, index, score: getScore(item) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}
