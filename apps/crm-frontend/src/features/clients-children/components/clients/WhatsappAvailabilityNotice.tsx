import { Button, Group, Text } from '@mantine/core';
import { useWhatsappAvailability } from '../../hooks/useClients';

interface WhatsappAvailabilityNoticeProps {
  clientId: number;
  phone: string;
  whatsappConfirmed?: boolean;
}

export function WhatsappAvailabilityNotice({ clientId, phone, whatsappConfirmed }: WhatsappAvailabilityNoticeProps) {
  const { status, isChecking, isRefreshing, refresh } = useWhatsappAvailability(clientId, phone, whatsappConfirmed);
  const message = isChecking ? 'Проверяем WhatsApp…' : status === 'exists'
    ? 'WhatsApp есть' : status === 'absent'
      ? 'WhatsApp не найден. Проверьте номер или сообщите код выдачи клиенту лично.'
      : 'Не удалось проверить WhatsApp. Уточните номер у клиента.';
  return <Group gap="xs" align="center" wrap="wrap">
    <Text size="sm" c={status === 'absent' ? 'orange.8' : status === 'exists' ? 'green.8' : 'dimmed'}>{message}</Text>
    {status !== 'exists' && <Button size="compact-xs" variant="subtle" onClick={refresh} loading={isRefreshing}>
      Проверить повторно
    </Button>}
  </Group>;
}
