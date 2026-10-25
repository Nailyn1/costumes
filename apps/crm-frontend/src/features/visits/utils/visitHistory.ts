import type { VisitHistoryEventDto } from "@costumes/shared";

export interface VisitHistoryGroup {
  commandId: string;
  events: VisitHistoryEventDto[];
}

export interface VisitHistoryGroupPresentation {
  title: string;
  details: string[];
  occurredAt: string;
  actor: string;
}

function compareEvents(a: VisitHistoryEventDto, b: VisitHistoryEventDto) {
  const timeDifference = Date.parse(a.occurredAt) - Date.parse(b.occurredAt);
  return timeDifference || a.id - b.id;
}

export function groupVisitHistoryEvents(
  events: readonly VisitHistoryEventDto[],
): VisitHistoryGroup[] {
  const groups = new Map<string, VisitHistoryGroup>();

  for (const event of [...events].sort(compareEvents)) {
    const group = groups.get(event.commandId);
    if (group) {
      if (!group.events.some((item) => item.id === event.id)) {
        group.events.push(event);
      }
    } else {
      groups.set(event.commandId, {
        commandId: event.commandId,
        events: [event],
      });
    }
  }

  return [...groups.values()];
}

export function formatVisitHistoryInstant(occurredAt: string): string {
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) return occurredAt;

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Qyzylorda",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatVisitHistoryRentalPeriod(
  startDate: string,
  endDate: string,
): string {
  const formatDate = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
  };

  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function formatHistoryDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

function formatMoney(amount: number): string {
  return `${amount.toLocaleString("ru-RU")} ₸`;
}

function formatDeposit(type: string, amount: number): string {
  if (type === "cash") return `Наличный залог: ${formatMoney(amount)}`;
  if (type === "document") return "Залог: документ";
  return "Без залога";
}

function formatReturnedDeposit(
  type: string,
  amount: number,
): string | undefined {
  if (type === "cash") return `Залог возвращён: ${formatMoney(amount)}`;
  if (type === "document") return "Залог возвращён: документ";
  return undefined;
}

function formatVisitEditDetails(
  payload: Extract<VisitHistoryEventDto["payload"], { kind: "visit.updated" }>,
): string[] {
  const details: string[] = [];
  const fields = payload.changedFields;
  if (fields.startDateTime || fields.endDateTime) {
    if (fields.startDateTime && fields.endDateTime) {
      const { before: beforeStart, after: afterStart } = fields.startDateTime;
      const { before: beforeEnd, after: afterEnd } = fields.endDateTime;
      details.push(
        `Срок аренды: ${formatVisitHistoryRentalPeriod(beforeStart, beforeEnd)} → ${formatVisitHistoryRentalPeriod(afterStart, afterEnd)}`,
      );
    } else if (fields.startDateTime) {
      details.push(
        `Дата выдачи: ${formatHistoryDate(fields.startDateTime.before)} → ${formatHistoryDate(fields.startDateTime.after)}`,
      );
    } else if (fields.endDateTime) {
      details.push(
        `Дата возврата: ${formatHistoryDate(fields.endDateTime.before)} → ${formatHistoryDate(fields.endDateTime.after)}`,
      );
    }
  }
  for (const [key, label] of [
    ["issueTimeFrom", "Выдача с"],
    ["issueTimeTo", "Выдача до"],
    ["returnTimeUntil", "Возврат до"],
  ] as const) {
    const change = fields[key];
    if (change) details.push(`${label}: ${change.before} → ${change.after}`);
  }
  if (fields.notes) {
    const before = fields.notes.before?.trim() || "—";
    const after = fields.notes.after?.trim() || "—";
    details.push(`Примечание: ${before} → ${after}`);
  }

  for (const change of payload.orderChanges) {
    const before = change.before;
    const after = change.after;
    const snapshot = after ?? before;
    if (!snapshot) continue;
    if (change.change === "added") {
      details.push("Добавлен заказ");
      if (snapshot.prepaymentAmount > 0)
        details.push(
          `Получена предоплата: ${formatMoney(snapshot.prepaymentAmount)}`,
        );
    } else if (change.change === "removed") {
      details.push("Удалён заказ");
    } else if (before && after) {
      const edits: string[] = [];
      if (before.childId !== after.childId) edits.push("изменён ребёнок");
      if (before.costumeId !== after.costumeId) edits.push("изменён костюм");
      if (before.rentPrice !== after.rentPrice) {
        edits.push(
          `аренда: ${formatMoney(before.rentPrice)} → ${formatMoney(after.rentPrice)}`,
        );
      }
      if ((before.notes ?? "") !== (after.notes ?? "")) {
        edits.push(
          `заметка: ${before.notes?.trim() || "—"} → ${after.notes?.trim() || "—"}`,
        );
      }
      if (edits.length > 0) details.push(edits.join("; "));
    }
  }
  return details;
}

function formatActor(event: VisitHistoryEventDto): string {
  if (event.source === "system") return "Система";
  if (event.source === "import") return "Импорт";
  return event.actorNameSnapshot.trim() || "Автор неизвестен";
}

export function presentVisitHistoryGroup(
  group: VisitHistoryGroup,
): VisitHistoryGroupPresentation {
  const events = group.events;
  const payloads = events.map((event) => event.payload);
  const created = payloads.find((payload) => payload.kind === "visit.created");
  const issued = payloads.find((payload) => payload.kind === "visit.issued");
  const unissued = payloads.find(
    (payload) => payload.kind === "visit.unissued",
  );
  const cancelled = payloads.find(
    (payload) => payload.kind === "visit.cancelled",
  );
  const completed = payloads.find(
    (payload) => payload.kind === "visit.completed",
  );
  const tagWritten = payloads.find((payload) => payload.kind === "tag.written");
  const visitUpdated = payloads.find(
    (payload) => payload.kind === "visit.updated",
  );
  const ordersAddedAndIssued = payloads.find(
    (payload) => payload.kind === "orders.added_and_issued",
  );
  const tagInvalidations = payloads.filter(
    (payload) => payload.kind === "tag.invalidated",
  );
  const depositReturned = payloads.find(
    (payload) => payload.kind === "deposit.returned",
  );
  const received = payloads.filter(
    (payload) => payload.kind === "money.received",
  );
  const refunded = payloads.filter(
    (payload) => payload.kind === "money.refunded",
  );
  const missingParts = payloads.filter(
    (payload) => payload.kind === "return.missing_parts",
  );
  const details: string[] = [];
  let title: string;

  if (created && issued) {
    title = "Визит создан, костюмы выданы";
  } else if (created) {
    title = "Визит создан";
  } else if (issued) {
    title = "Костюмы выданы";
    const issuePayment = received.find(
      (payload) => payload.moneyKind === "issue_payment",
    );
    const amount = issuePayment?.amount ?? issued.additionalPayment;
    if (amount > 0) details.push(`Получено при выдаче: ${formatMoney(amount)}`);
    details.push(formatDeposit(issued.depositType, issued.depositAmount));
  } else if (ordersAddedAndIssued) {
    title = "Добавлены и выданы костюмы";
    const issuePayment = received.find(
      (payload) => payload.moneyKind === "issue_payment",
    );
    if (issuePayment && issuePayment.amount > 0) {
      details.push(`Получено при выдаче: ${formatMoney(issuePayment.amount)}`);
    }
  } else if (unissued) {
    title = "Выдача отменена";
    if (unissued.voidedPaymentAmount > 0) {
      details.push(
        `Аннулирован платёж: ${formatMoney(unissued.voidedPaymentAmount)}`,
      );
    }
    if (unissued.depositType) {
      details.push(
        formatDeposit(unissued.depositType, unissued.depositAmount ?? 0),
      );
    }
  } else if (cancelled) {
    title = "Визит отменён";
    if (cancelled.reason) details.push(`Причина: ${cancelled.reason}`);
  } else if (completed) {
    title = "Возврат оформлен";
    if (completed.settlementAmount && completed.settlementKind) {
      const settlementLabel =
        completed.settlementKind === "debt_payment"
          ? "Принята оплата долга"
          : "Возвращена переплата";
      details.push(
        `${settlementLabel}: ${formatMoney(completed.settlementAmount)}`,
      );
    }
    if (depositReturned) {
      const returnedDeposit = formatReturnedDeposit(
        depositReturned.depositType,
        depositReturned.amount,
      );
      if (returnedDeposit) details.push(returnedDeposit);
    }
    for (const missing of missingParts) {
      details.push(
        `Вернули без: ${missing.parts.join(", ")} — ${missing.costumeName}`,
      );
    }
  } else if (tagWritten) {
    title = "Бирка написана";
    details.push(
      `${tagWritten.childName} — ${tagWritten.costumeName} (${tagWritten.inventoryCode})`,
    );
  } else if (visitUpdated) {
    title = "Визит изменён";
    details.push(...formatVisitEditDetails(visitUpdated));
  } else if (tagInvalidations.length > 0) {
    title = "Бирка сброшена после изменения заказа";
  } else if (depositReturned) {
    const returnedDeposit = formatReturnedDeposit(
      depositReturned.depositType,
      depositReturned.amount,
    );
    title = returnedDeposit ? "Залог возвращён клиенту" : "Изменение визита";
    if (returnedDeposit) details.push(returnedDeposit);
  } else if (received.length > 0) {
    title = received.some((payload) => payload.moneyKind === "debt_payment")
      ? "Принята оплата долга"
      : "Получена оплата аренды";
  } else if (refunded.length > 0) {
    title = "Клиенту возвращены деньги";
  } else {
    title = "Изменение визита";
  }

  for (const invalidation of tagInvalidations) {
    const reason =
      invalidation.reason === "date_changed" ||
      invalidation.reason === "window_changed"
        ? "изменился период аренды/время"
        : invalidation.reason === "child_changed"
          ? "изменился ребёнок"
          : "изменился костюм";
    details.push(`Бирка сброшена: ${reason}`);
  }

  if (issued && created) {
    const issuePayment = received.find(
      (payload) => payload.moneyKind === "issue_payment",
    );
    const amount = issuePayment?.amount ?? issued.additionalPayment;
    if (amount > 0) details.push(`Получено при выдаче: ${formatMoney(amount)}`);
    details.push(formatDeposit(issued.depositType, issued.depositAmount));
  }

  for (const payment of received) {
    if (issued && payment.moneyKind === "issue_payment") continue;
    if (ordersAddedAndIssued && payment.moneyKind === "issue_payment") continue;
    if (completed && payment.moneyKind === "debt_payment") continue;
    details.push(
      `${payment.moneyKind === "debt_payment" ? "Поступило" : "Оплачено"}: ${formatMoney(payment.amount)}`,
    );
  }
  for (const refund of refunded) {
    if (completed?.settlementKind === "customer_refund") continue;
    details.push(`Возврат клиенту: ${formatMoney(refund.amount)}`);
  }

  if (created) {
    const prepayment = created.orders.reduce(
      (sum, order) => sum + order.prepaymentAmount,
      0,
    );
    if (prepayment > 0)
      details.unshift(`Получена предоплата: ${formatMoney(prepayment)}`);
  }

  const firstEvent = events[0];
  return {
    title,
    details: [...new Set(details)],
    occurredAt: firstEvent.occurredAt,
    actor: formatActor(firstEvent),
  };
}
