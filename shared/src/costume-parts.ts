import { schemas } from "./schemas.js";
import { z } from "zod";

export type CostumePartDto = z.infer<typeof schemas.Costumes_CostumePart>;
export const CostumePartSchema = schemas.Costumes_CostumePart;
export const CostumePartsSchema = z.array(CostumePartSchema);

export const MAX_COSTUME_PARTS = 20;

/** Быстрые варианты частей состава (чипсы в форме костюма). */
export const COSTUME_PART_SUGGESTIONS: readonly string[] = [
  "Головной убор",
  "Накидка",
  "Повязка",
  "Фартук",
  "Саукеле",
  "Пояс",
  "Жилет",
  "Корона",
  "Маска",
  "Крылья",
];

/** Состав нового костюма в форме по умолчанию (снимается одним нажатием). */
export const DEFAULT_COSTUME_PARTS: readonly CostumePartDto[] = [
  { name: "Головной убор", qty: 1 },
];

const partKey = (name: string) => name.trim().toLocaleLowerCase("ru-RU");

/** Обрезает пробелы в названиях и убирает пустые части. */
export function normalizeCostumeParts(
  parts: readonly CostumePartDto[],
): CostumePartDto[] {
  return parts
    .map((part) => ({ name: part.name.trim(), qty: part.qty }))
    .filter((part) => part.name.length > 0);
}

/** Название первой повторяющейся части (без учёта регистра) или `null`. */
export function findDuplicateCostumePart(
  parts: readonly CostumePartDto[],
): string | null {
  const seen = new Set<string>();
  for (const part of parts) {
    const key = partKey(part.name);
    if (seen.has(key)) return part.name.trim();
    seen.add(key);
  }
  return null;
}

/** Сравнение названий частей без учёта регистра и крайних пробелов. */
export function isSameCostumePartName(a: string, b: string): boolean {
  return partKey(a) === partKey(b);
}
