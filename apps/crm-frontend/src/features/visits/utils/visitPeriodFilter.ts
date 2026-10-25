export type VisitPeriodPreset =
  "all" | "today" | "yesterday" | "week" | "custom";
export interface VisitPeriodFilterValue {
  preset: VisitPeriodPreset;
  from: string;
  to: string;
}
export const allVisitDates: VisitPeriodFilterValue = {
  preset: "all",
  from: "",
  to: "",
};

function plainDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function visitPeriodRange(
  preset: Exclude<VisitPeriodPreset, "custom">,
  now: Date,
): VisitPeriodFilterValue {
  if (preset === "all") return allVisitDates;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  if (preset === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  }
  if (preset === "week")
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return { preset, from: plainDate(start), to: plainDate(end) };
}

export function visitPeriodLabel(value: VisitPeriodFilterValue): string {
  if (value.preset === "all") return "За всё время";
  if (value.preset === "today") return "Сегодня";
  if (value.preset === "yesterday") return "Вчера";
  if (value.preset === "week") return "С начала недели";
  const format = (date: string) => date.split("-").reverse().join(".");
  return `${format(value.from)} — ${format(value.to)}`;
}
