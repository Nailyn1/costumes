import dayjs from "dayjs";
import type { CreateVisitRequestDto } from "@costumes/shared";
import type { BookingFormValues, VisitOrder } from "../types/visitTypes";

/** Пустой заказ формы брони — дефолт для первого и добавляемых заказов. */
export function createEmptyOrder(): VisitOrder {
  return {
    childId: null,
    costumeId: null,
    rentPrice: undefined,
    prepaymentAmount: undefined,
    notes: "",
  };
}

/**
 * Предоплата после смены аренды: если внесено больше новой аренды,
 * она ограничивается арендой (domain.md §3, п. 4). Иначе остаётся как есть.
 */
export function clampPrepayment(
  rentPrice: number,
  prepayment: number | undefined,
): number | undefined {
  return (prepayment || 0) > rentPrice ? rentPrice : prepayment;
}

/**
 * Умный ввод даты: `11` → 11-е число ближайшего месяца (если день уже прошёл —
 * следующий месяц), `15.05` → 15 мая текущего года. Иначе `undefined`.
 */
export function parseSmartDate(
  raw: string,
  now: dayjs.Dayjs = dayjs(),
): string | undefined {
  const dayMatch = raw.match(/^\d{1,2}$/);
  if (dayMatch) {
    const day = parseInt(dayMatch[0], 10);
    if (day >= 1 && day <= 31) {
      let smartDate = now.date(day).startOf("day");

      if (smartDate.isBefore(now, "day")) {
        smartDate = smartDate.add(1, "month");
      }

      return smartDate.isValid() ? smartDate.format("YYYY-MM-DD") : undefined;
    }
  }

  const fullMatch = raw.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (fullMatch) {
    const day = parseInt(fullMatch[1], 10);
    const month = parseInt(fullMatch[2], 10) - 1; // в JS месяцы 0-11
    const smartDate = now.month(month).date(day).startOf("day");

    return smartDate.isValid() ? smartDate.format("YYYY-MM-DD") : undefined;
  }

  return undefined;
}

/** Дата в формате `YYYY-MM-DD` по локальным компонентам (без конвертации часовых поясов). */
export function toISODateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Авто-дата возврата: выдача + 1 день. `null`, если дата выдачи некорректна. */
export function nextDayISO(startDate: string): string | null {
  const dateObj = new Date(startDate);
  if (isNaN(dateObj.getTime())) return null;

  const nextDay = new Date(dateObj);
  nextDay.setDate(nextDay.getDate() + 1);
  return toISODateString(nextDay);
}

/** Тело `POST /visits` из значений формы брони. */
export function buildCreateVisitPayload(
  values: BookingFormValues,
): CreateVisitRequestDto {
  return {
    visitCode: values.visitCode || "",
    startDateTime: values.startDateTime || "",
    endDateTime: values.endDateTime || "",
    issueTimeFrom: values.issueTimeFrom || "",
    issueTimeTo: values.issueTimeTo || "",
    returnTimeUntil: values.returnTimeUntil || "",
    clientId: Number(values.clientId),
    notes: values.notes || "",
    orders: values.orders.map((order) => ({
      childId: Number(order.childId),
      costumeId: Number(order.costumeId),
      rentPrice: Number(order.rentPrice) || 0,
      prepaymentAmount: Number(order.prepaymentAmount) || 0,
      notes: order.notes || "",
    })),
  };
}
