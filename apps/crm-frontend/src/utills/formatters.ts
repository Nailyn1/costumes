export const formatPhoneNumber = (phone: string) => {
  if (phone.length !== 12) return phone;
  return `${phone.slice(0, 2)} (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10, 12)}`;
};

export const formatHumanDate = (dateStr: string | null) => {
  if (!dateStr) return "---";
  const date = new Date(`${dateStr}T00:00:00`);

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(date);
};

export const formatStayDates = (startStr: string, endStr: string) => {
  if (!startStr || !endStr) return "";

  const months = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];

  const [, m1, d1] = startStr.split("-").map(Number);
  const [, m2, d2] = endStr.split("-").map(Number);

  if (isNaN(d1) || isNaN(m1) || isNaN(d2) || isNaN(m2)) {
    return "Дата не указана";
  }

  if (m1 === m2) {
    return `${d1} / ${d2} ${months[m1 - 1]}`;
  } else {
    return `${d1} ${months[m1 - 1]} / ${d2} ${months[m2 - 1]}`;
  }
};

export const formatPhoneNumberForCostumes = (phone: string) => {
  if (!phone) return "";

  const cleaned = phone.replace(/\D/g, "");
  const match = cleaned.match(/^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/);

  if (match) {
    return `+${match[1]}(${match[2]})-${match[3]}-${match[4]}-${match[5]}`;
  }

  return phone;
};

export const ORDER_STATUS_MAP: Record<
  string,
  { label: string; color: string }
> = {
  reserved: { label: "Забронирован", color: "orange" },
  issued: { label: "В прокате", color: "blue" },
  completed: { label: "Вернули", color: "green" },
  returned: { label: "Вернули", color: "green" },
  cancelled: { label: "Отмена", color: "red" },
};
