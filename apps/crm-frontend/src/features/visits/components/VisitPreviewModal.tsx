// src/features/visits/components/VisitPreviewModal.tsx
import {
  Modal,
  Stack,
  Group,
  Text,
  Divider,
  Paper,
  Badge,
  Button,
  SimpleGrid,
  Checkbox,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { costumesKeys } from "src/features/costumes/hooks/useCostumes";
import type { UseFormReturnType } from "@mantine/form";
import type { BookingFormValues } from "../types/visitTypes";
import type { SelectedClientData } from "src/features/clients-children/types/clientTypes";
import type { SelectedCostumeData } from "src/features/costumes/types/costumeTypes";
import { formatHumanDate } from "src/utils/formatters";
import { useState } from "react";
import { clientKeys } from "src/features/clients-children/hooks/useClients";
import { useWhatsappAvailability } from "src/features/clients-children/hooks/useClients";
import { WhatsappAvailabilityNotice } from "src/features/clients-children/components/clients/WhatsappAvailabilityNotice";
import { clientsService } from "src/features/clients-children/services/clients.service";

interface VisitPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  form: UseFormReturnType<BookingFormValues>;
  totalRent: number;
  totalPrepayment: number;
  onSubmit: (sendNotification: boolean) => void;
  isSubmitting: boolean;
}

export function VisitPreviewModal({
  opened,
  onClose,
  form,
  totalRent,
  totalPrepayment,
  onSubmit,
  isSubmitting,
}: VisitPreviewModalProps) {
  const queryClient = useQueryClient();
  const { values } = form;
  const [sendNotification, setSendNotification] = useState(true);
  const cachedClient = queryClient.getQueryData<SelectedClientData>(
    clientKeys.formState(values.clientId?.toString() || ""),
  );
  const clientId = Number(values.clientId || 0);
  const { data: detail } = useQuery({
    queryKey: clientKeys.detail(clientId),
    queryFn: () => clientsService.getDetaileClient(clientId),
    enabled: opened && clientId > 0 && !cachedClient,
  });
  const clientPhone = cachedClient?.phone ?? detail?.client.phone ?? '';
  const clientName = cachedClient?.name ?? detail?.client.name ?? '';
  const whatsappConfirmed = cachedClient?.whatsappConfirmed ?? detail?.client.whatsappConfirmed ?? false;
  const { status: whatsappStatus } = useWhatsappAvailability(clientId, clientPhone, whatsappConfirmed);
  const canSend = !!clientPhone && whatsappStatus !== 'absent';

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Проверка данных визита"
      size="lg"
      radius="md"
      closeButtonProps={{
        size: "lg",
        iconSize: 24,
      }}
    >
      <Stack gap="md">
        <Paper withBorder p="sm" radius="md">
          {clientPhone ? <>
            <Text size="sm" fw={600}>{clientName}: {clientPhone}</Text>
            <WhatsappAvailabilityNotice clientId={clientId} phone={clientPhone} whatsappConfirmed={whatsappConfirmed} />
          </> : <Text size="sm" c="dimmed">Не удалось загрузить номер клиента. Визит можно создать без отправки WhatsApp.</Text>}
        </Paper>
        <Paper withBorder p="md" bg="blue.0" radius="md">
          <Stack gap={2}>
            <Text size="xs" c="blue.9" fw={700}>
              КОД ВЫДАЧИ:
            </Text>
            <Text
              size="xl"
              fw={900}
              style={{ fontFamily: "monospace" }}
              c="blue.9"
            >
              {form.values.visitCode}
            </Text>
          </Stack>
        </Paper>

        <SimpleGrid cols={2} spacing="xs">
          <div>
            <Text size="md" c="dimmed">
              Выдача:
            </Text>
            <Text size="md" fw={600}>
              {formatHumanDate(values.startDateTime)} ({values.issueTimeFrom} –{" "}
              {values.issueTimeTo})
            </Text>
          </div>
          <div>
            <Text size="md" c="dimmed">
              Возврат:
            </Text>
            <Text size="md" fw={600}>
              {formatHumanDate(values.endDateTime)} (до {values.returnTimeUntil}
              )
            </Text>
          </div>
        </SimpleGrid>

        <Divider
          label={
            <Text size="md" fw={700}>
              Детали заказа
            </Text>
          }
          labelPosition="center"
          size="md"
        />

        {values.orders.map((order, index) => {
          const child = cachedClient?.children?.find(
            (c) => Number(c.childId) === Number(order.childId),
          );

          const costume = queryClient.getQueryData<SelectedCostumeData>(
            costumesKeys.detail(order.costumeId || 0),
          );

          const rent = order.rentPrice || 0;
          const prepay = order.prepaymentAmount || 0;

          return (
            <Paper key={index} withBorder p="sm" radius="md">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={700} size="lg">
                    {child?.name || `Ребенок #${index + 1}`}
                  </Text>
                  <Badge variant="outline" color="gray" size="lg">
                    {costume?.inventoryCode ?? "---"}
                  </Badge>
                </Group>

                <Text size="md">
                  <Text span fw={600}>
                    {costume?.name ?? "Не выбран"}
                  </Text>
                </Text>

                <Group grow>
                  <Stack gap={0}>
                    <Text size="s" c="dimmed">
                      Аренда
                    </Text>
                    <Text size="m" fw={600}>
                      {rent.toLocaleString()} ₸
                    </Text>
                  </Stack>
                  <Stack gap={0}>
                    <Text size="s" c="dimmed">
                      Внесено
                    </Text>
                    <Text size="m" fw={600} c="green.7">
                      {prepay.toLocaleString()} ₸
                    </Text>
                  </Stack>
                  <Stack gap={0}>
                    <Text size="s" c="dimmed">
                      Остаток
                    </Text>
                    <Text size="m" fw={700} c="orange.8">
                      {(rent - prepay).toLocaleString()} ₸
                    </Text>
                  </Stack>
                </Group>
              </Stack>
            </Paper>
          );
        })}

        <Divider size="md" />

        <Stack gap={4}>
          <Group justify="space-between">
            <Text size="md">Общая сумма аренды:</Text>
            <Text size="md" fw={600}>
              {totalRent.toLocaleString()} ₸
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="md">Общая предоплата:</Text>
            <Text size="md" fw={600} c="green.7">
              {totalPrepayment.toLocaleString()} ₸
            </Text>
          </Group>
          <Group justify="space-between" mt="xs">
            <Text fw={800} size="md">
              Итого доплатить:
            </Text>
            <Text fw={900} size="md" c="blue">
              {(totalRent - totalPrepayment).toLocaleString()} ₸
            </Text>
          </Group>
        </Stack>

        <Paper withBorder p="sm" radius="md" bg="gray.0" mt="sm">
          <Checkbox
            label="Отправить клиенту уведомление в WhatsApp"
            description="Сообщение с деталями бронирования уйдет автоматически"
            checked={canSend && sendNotification}
            disabled={!canSend}
            onChange={(event) =>
              setSendNotification(event.currentTarget.checked)
            }
            color="green"
            size="sm"
          />
        </Paper>

        <Button
          size="lg"
          fullWidth
          color="blue"
          mt="md"
          onClick={() => onSubmit(canSend && sendNotification)}
          loading={isSubmitting}
        >
          Подтвердить и создать
        </Button>
      </Stack>
    </Modal>
  );
}
