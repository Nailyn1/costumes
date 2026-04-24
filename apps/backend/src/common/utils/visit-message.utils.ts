import { VisitWithDetails } from '../../notification/notification.service';

export function buildVisitMessage(visit: VisitWithDetails): string {
  const { orders, client, visitCode } = visit;

  const formatDate = (date: Date) => date.toLocaleDateString('ru-RU');
  const startDate = formatDate(visit.startDateTime);
  const endDate = formatDate(visit.endDateTime);

  const totalRent = orders.reduce((sum, o) => sum + o.rentPrice, 0);
  const totalPrepayment = orders.reduce(
    (sum, o) => sum + o.prepaymentAmount,
    0,
  );
  const balance = totalRent - totalPrepayment;

  const ordersList = orders
    .map((o, index) => {
      return `${index + 1}. *${o.child.name}*: ${o.costume.name}\n  Цена: ${o.rentPrice} | Внесено: ${o.prepaymentAmount}`;
    })
    .join('\n');

  let message = `Здравствуйте, ${client.name}! \n`;
  message += `Ваши костюмы забронированы. \n\n`;
  message += `Код выдачи: *${visitCode}*\n\n`;

  message += `*ДЕТАЛИ ЗАКАЗА:*\n`;
  message += `${ordersList}\n\n`;

  if (orders.length > 1) {
    message += `*ИТОГО:*\n💰 Общая стоимость: ${totalRent}\n💳 Всего внесено: ${totalPrepayment}\n📉 Остаток к оплате: *${balance}*\n\n`;
  } else if (balance > 0) {
    message += `📉 Остаток к оплате: *${balance}*\n\n`;
  }

  message += `❗️ *УСЛОВИЯ АРЕНДЫ:*\n`;
  message += `• Обязательный залог при выдаче — от 5 000 ₸.\n`;
  message += `• В случае отказа от брони предоплата не возвращается.\n\n`;

  message += `🗓 *ГРАФИК:*\n📍 Выдача: ${startDate} (с ${visit.issueTimeFrom} до ${visit.issueTimeTo})\n📅 Возврат: ${endDate} (до ${visit.returnTimeUntil})\n\n`;
  message += `⚠️ _Пожалуйста, ответьте на это сообщение любым символом или цифрой 1, чтобы подтвердить, что данные верны и мы забронировали костюм за вами окончательно_`;

  return message;
}
