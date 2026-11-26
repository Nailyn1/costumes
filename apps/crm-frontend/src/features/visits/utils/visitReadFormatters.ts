import type { VisitReadDetailDto } from "@costumes/shared";

export const visitStatusLabels: Record<VisitReadDetailDto["status"], string> = {
  reserved: "Забронирован",
  issued: "Выдан",
  completed: "Завершён",
  cancelled: "Отменён",
};

export function formatVisitMoney(amount: number): string {
  return `${new Intl.NumberFormat("ru-KZ", { maximumFractionDigits: 0 }).format(amount)} ₸`;
}

/** Rent dates are stored as UTC-as-local date strings; keep their calendar date unchanged. */
export function formatVisitDate(date: string): string {
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

export function formatVisitDateTime(date: string): string {
  return new Intl.DateTimeFormat("ru-KZ", {
    timeZone: "Asia/Qyzylorda",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function formatVisitPeriod(start: string, end: string): string {
  return `${formatVisitDate(start)} — ${formatVisitDate(end)}`;
}
