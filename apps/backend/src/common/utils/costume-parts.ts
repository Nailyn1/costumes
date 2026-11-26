import { Logger } from '@nestjs/common';
import { CostumePartsSchema } from '@costumes/shared';

const logger = new Logger('CostumeParts');

/** Часть состава без «лишних» полей схемы — безопасно кладётся в Json-колонку. */
// type, а не interface: нужна неявная index-сигнатура для Json и catchall-схем
export type CostumePart = { name: string; qty: number };

/**
 * Читает состав из Json-колонки. Мусор в JSON не должен ронять ответ:
 * возвращаем пустой список и пишем предупреждение в лог.
 */
export function parseCostumeParts(raw: unknown): CostumePart[] {
  if (raw === null || raw === undefined) return [];
  const parsed = CostumePartsSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data.map(({ name, qty }) => ({ name, qty }));
  }
  logger.warn('Некорректный состав костюма в БД — отдаём пустой список');
  return [];
}

/**
 * Состав заказа: снимок на момент выдачи, а у заказов без снимка
 * (не выданных или выданных до T-110) — текущий состав костюма.
 */
export function orderCostumeParts(order: {
  issuedParts?: unknown;
  costume: { parts?: unknown };
}): CostumePart[] {
  return parseCostumeParts(
    order.issuedParts === null || order.issuedParts === undefined
      ? order.costume.parts
      : order.issuedParts,
  );
}
