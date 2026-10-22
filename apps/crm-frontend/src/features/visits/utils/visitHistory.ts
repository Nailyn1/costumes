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

function formatMoney(amount: number): string {
  return `${amount.toLocaleString("ru-RU")} ₸`;
}

function formatDeposit(type: string, amount: number): string {
  if (type === "cash") return `Наличный залог: ${formatMoney(amount)}`;
  if (type === "document") return "Залог: документ";
  return "Без залога";
}

function formatReturnedDeposit(type: string, amount: number): string | undefined {
  if (type === "cash") return `Залог возвращён: ${formatMoney(amount)}`;
  if (type === "document") return "Залог возвращён: документ";
  return undefined;
}

function formatOrderSnapshots(
  events: readonly VisitHistoryEventDto[],
): string[] {
  const orders = new Map<number, string>();
  for (const event of events) {
    const payload = event.payload;
    if (
      payload.kind === "visit.created" ||
      payload.kind === "visit.issued" ||
      payload.kind === "visit.unissued" ||
      payload.kind === "visit.completed"
    ) {
      for (const order of payload.orders) {
        orders.set(
          order.orderId,
          `${order.childName} — ${order.costumeName} (${order.inventoryCode})`,
        );
      }
    }
    if (payload.kind === "tag.written") {
      orders.set(
        payload.orderId,
        `${payload.childName} — ${payload.costumeName} (${payload.inventoryCode})`,
      );
    }
  }
  return [...orders.values()];
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
  const unissued = payloads.find((payload) => payload.kind === "visit.unissued");
  const cancelled = payloads.find((payload) => payload.kind === "visit.cancelled");
  const completed = payloads.find((payload) => payload.kind === "visit.completed");
  const tagWritten = payloads.find((payload) => payload.kind === "tag.written");
  const depositReturned = payloads.find((payload) => payload.kind === "deposit.returned");
  const received = payloads.filter((payload) => payload.kind === "money.received");
  const refunded = payloads.filter((payload) => payload.kind === "money.refunded");
  const snapshots = formatOrderSnapshots(events);
  const details: string[] = [];
  let title: string;

  if (created && issued) {
    title = `Создан и выдан визит #${issued.visitCode}`;
  } else if (created) {
    title = `Создан визит #${created.visitCode}`;
    details.push(`Клиент: ${created.clientName}`);
    details.push(
      `Аренда: ${formatVisitHistoryRentalPeriod(created.startDateTime, created.endDateTime)}`,
    );
  } else if (issued) {
    title = `Выданы костюмы по визиту #${issued.visitCode}`;
    const issuePayment = received.find((payload) => payload.moneyKind === "issue_payment");
    const amount = issuePayment?.amount ?? issued.additionalPayment;
    if (amount > 0) details.push(`Получено при выдаче: ${formatMoney(amount)}`);
    details.push(formatDeposit(issued.depositType, issued.depositAmount));
  } else if (unissued) {
    title = `Выдача отменена по визиту #${unissued.visitCode}`;
    if (unissued.voidedPaymentAmount > 0) {
      details.push(`Аннулирован платёж: ${formatMoney(unissued.voidedPaymentAmount)}`);
    }
    if (unissued.depositType) {
      details.push(formatDeposit(unissued.depositType, unissued.depositAmount ?? 0));
    }
  } else if (cancelled) {
    title = `Визит #${cancelled.visitCode} отменён`;
    if (cancelled.reason) details.push(`Причина: ${cancelled.reason}`);
  } else if (completed) {
    title = `Возврат оформлен по визиту #${completed.visitCode}`;
    if (completed.settlementAmount && completed.settlementKind) {
      const settlementLabel = completed.settlementKind === "debt_payment"
        ? "Принята оплата долга"
        : "Возвращена переплата";
      details.push(`${settlementLabel}: ${formatMoney(completed.settlementAmount)}`);
    }
    if (depositReturned) {
      const returnedDeposit = formatReturnedDeposit(
        depositReturned.depositType,
        depositReturned.amount,
      );
      if (returnedDeposit) details.push(returnedDeposit);
    }
  } else if (tagWritten) {
    title = `Бирка написана: ${tagWritten.costumeName}`;
    details.push(`${tagWritten.childName} · ${tagWritten.inventoryCode}`);
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

  if (issued && created) {
    const issuePayment = received.find((payload) => payload.moneyKind === "issue_payment");
    const amount = issuePayment?.amount ?? issued.additionalPayment;
    if (amount > 0) details.push(`Получено при выдаче: ${formatMoney(amount)}`);
    details.push(formatDeposit(issued.depositType, issued.depositAmount));
  }

  for (const payment of received) {
    if (issued && payment.moneyKind === "issue_payment") continue;
    if (completed && payment.moneyKind === "debt_payment") continue;
    details.push(
      `${payment.moneyKind === "debt_payment" ? "Поступило" : "Оплачено"}: ${formatMoney(payment.amount)}`,
    );
  }
  for (const refund of refunded) {
    if (completed?.settlementKind === "customer_refund") continue;
    details.push(`Возврат клиенту: ${formatMoney(refund.amount)}`);
  }

  if (snapshots.length > 0) details.push(...snapshots);

  const firstEvent = events[0];
  return {
    title,
    details: [...new Set(details)],
    occurredAt: firstEvent.occurredAt,
    actor: formatActor(firstEvent),
  };
}
