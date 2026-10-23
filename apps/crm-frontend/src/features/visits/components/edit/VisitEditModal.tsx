import {
  Alert,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { schemaResolver, useForm } from "@mantine/form";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import {
  UpdateReservedVisitRequestSchema,
  type UpdateReservedVisitRequestDto,
  type VisitReadDetailDto,
} from "@costumes/shared";
import { OrderSelectionFields } from "../OrderSelectionFields";
import { SmartDateInput } from "../SmartDateInput";
import {
  canRemoveVisitEditOrder,
  createEmptyVisitEditOrder,
  createVisitEditDraft,
  createVisitEditDraftFromRequest,
  isVisitEditPriceValid,
  type VisitEditDraft,
} from "./visitEditDraft";

interface VisitEditModalProps {
  opened: boolean;
  onClose: () => void;
  visit: VisitReadDetailDto;
  isMobile: boolean;
  onSave: (draft: VisitEditDraft) => void;
  isSaving?: boolean;
  errorMessage?: string | null;
  pendingRequest?: UpdateReservedVisitRequestDto | null;
  onRetryPending?: () => void;
  versionConflict?: boolean;
  onRebaseVersion?: () => void;
}

export function VisitEditModal({
  opened,
  onClose,
  visit,
  isMobile,
  onSave,
  isSaving = false,
  errorMessage,
  pendingRequest = null,
  onRetryPending,
  versionConflict = false,
  onRebaseVersion,
}: VisitEditModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Редактировать визит ${visit.visitCode}`}
      centered
      fullScreen={isMobile}
      size="lg"
      closeOnEscape={!pendingRequest}
      closeOnClickOutside={!pendingRequest}
      withCloseButton={!pendingRequest}
    >
      {opened ? (
        <VisitEditForm
          key={visit.id}
          visit={visit}
          onClose={onClose}
          onSave={onSave}
          isSaving={isSaving}
          errorMessage={errorMessage}
          versionConflict={versionConflict}
          onRebaseVersion={onRebaseVersion}
          pendingRequest={pendingRequest}
          onRetryPending={onRetryPending}
        />
      ) : null}
    </Modal>
  );
}

function VisitEditForm({
  visit,
  onClose,
  onSave,
  isSaving,
  errorMessage,
  versionConflict,
  onRebaseVersion,
  pendingRequest,
  onRetryPending,
}: Omit<VisitEditModalProps, "opened" | "isMobile">) {
  const validateRequest = schemaResolver(UpdateReservedVisitRequestSchema);
  const form = useForm<VisitEditDraft>({
    initialValues: pendingRequest
      ? createVisitEditDraftFromRequest(visit, pendingRequest)
      : createVisitEditDraft(visit),
    validate: async (values) => {
      const errors = await validateRequest({
        commandId: "00000000-0000-4000-8000-000000000000",
        expectedVersion: Math.max(1, visit.version),
        startDateTime: values.startDateTime,
        issueTimeFrom: values.issueTimeFrom,
        issueTimeTo: values.issueTimeTo,
        endDateTime: values.endDateTime,
        returnTimeUntil: values.returnTimeUntil,
        notes: values.notes,
        orders: values.orders.map((order) => ({
          ...(order.orderId === null ? {} : { orderId: order.orderId }),
          childId: Number(order.childId),
          costumeId: Number(order.costumeId),
          rentPrice: Number(order.rentPrice),
          notes: order.notes,
        })),
      });
      values.orders.forEach((order, index) => {
        if (Number(order.childId) < 1) {
          errors[`orders.${index}.childId`] = "Выберите ребёнка";
        }
        if (Number(order.costumeId) < 1) {
          errors[`orders.${index}.costumeId`] = "Выберите костюм";
        }
        if (!isVisitEditPriceValid(order)) {
          errors[`orders.${index}.rentPrice`] = "Введите стоимость не ниже предоплаты";
        }
      });
      return errors;
    },
  });
  const locked = isSaving || Boolean(pendingRequest);

  const updateOrder = (
    index: number,
    value: Pick<
      VisitEditDraft["orders"][number],
      "childId" | "costumeId" | "rentPrice" | "notes"
    >,
  ) => {
    form.setFieldValue(`orders.${index}`, {
      ...form.values.orders[index],
      ...value,
    });
  };

  return (
      <form onSubmit={form.onSubmit(onSave)}>
        <Stack gap="md">
          {errorMessage && <Alert color="red">{errorMessage}</Alert>}
          {pendingRequest && (
            <Alert color="orange" title="Результат сохранения неизвестен">
              Повторите ту же команду, чтобы проверить её результат. Пока проверка не завершена,
              редактирование заблокировано.
              <Button mt="sm" variant="light" onClick={onRetryPending} disabled={isSaving}>
                Повторить сохранение
              </Button>
            </Alert>
          )}
          {versionConflict && (
            <Alert color="orange" title="Визит изменил другой сотрудник">
              Ваши поля сохранены. Прочитайте актуальную версию перед повторной отправкой.
              <Button mt="sm" variant="light" onClick={onRebaseVersion} disabled={locked}>
                Обновить версию
              </Button>
            </Alert>
          )}
          <SmartDateInput
            label="Дата выдачи"
            value={form.values.startDateTime}
            onChange={(value) => form.setFieldValue("startDateTime", value ?? "")}
            error={form.errors.startDateTime}
            disabled={locked}
          />
          <TimeInput
            label="Забрать с"
            value={form.values.issueTimeFrom}
            onChange={(event) =>
              form.setFieldValue("issueTimeFrom", event.currentTarget.value)
            }
            error={form.errors.issueTimeFrom}
            disabled={locked}
          />
          <TimeInput
            label="Забрать до"
            value={form.values.issueTimeTo}
            onChange={(event) =>
              form.setFieldValue("issueTimeTo", event.currentTarget.value)
            }
            error={form.errors.issueTimeTo}
            disabled={locked}
          />
          <SmartDateInput
            label="Дата возврата"
            value={form.values.endDateTime}
            onChange={(value) => form.setFieldValue("endDateTime", value ?? "")}
            minDate={form.values.startDateTime}
            error={form.errors.endDateTime}
            disabled={locked}
          />
          <TimeInput
            label="Вернуть до"
            value={form.values.returnTimeUntil}
            onChange={(event) =>
              form.setFieldValue("returnTimeUntil", event.currentTarget.value)
            }
            error={form.errors.returnTimeUntil}
            disabled={locked}
          />
          <TextInput
            label="Примечание к визиту"
            value={form.values.notes}
            onChange={(event) =>
              form.setFieldValue("notes", event.currentTarget.value)
            }
            disabled={locked}
          />

          <Divider />
          <Group justify="space-between" align="center">
            <Text fw={600}>Костюмы в визите</Text>
            <Button
              type="button"
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={() =>
                form.insertListItem("orders", createEmptyVisitEditOrder())
              }
              disabled={locked}
            >
              Добавить костюм
            </Button>
          </Group>
          {form.values.orders.map((order, index) => {
            const originalOrder = order.orderId === null
              ? undefined
              : visit.orders.find((item) => item.orderId === order.orderId);
            return (
            <Stack key={order.orderId ?? `new-${index}`} gap="xs">
              <Group justify="space-between" align="center">
                <Text fw={500}>Позиция {index + 1}</Text>
                {canRemoveVisitEditOrder(order, form.values.orders.length) ? (
                  <Button
                    type="button"
                    variant="subtle"
                    color="red"
                    leftSection={<IconTrash size={16} />}
                    onClick={() => form.removeListItem("orders", index)}
                    disabled={locked}
                  >
                    Удалить
                  </Button>
                ) : (
                  <Text size="xs" c="dimmed">
                    {form.values.orders.length === 1
                      ? "В визите должна остаться хотя бы одна позиция."
                      : "Заказ с предоплатой нельзя удалить."}
                  </Text>
                )}
              </Group>
              <OrderSelectionFields
                clientId={visit.client.id}
                value={{
                  childId: order.childId,
                  costumeId: order.costumeId,
                  rentPrice: order.rentPrice,
                  notes: order.notes,
                }}
                onChange={(value) => updateOrder(index, value)}
                startDateTime={form.values.startDateTime}
                endDateTime={form.values.endDateTime}
                issueTimeFrom={form.values.issueTimeFrom}
                returnTimeUntil={form.values.returnTimeUntil}
                excludeVisitId={visit.id}
                selectedChild={originalOrder ? {
                  childId: originalOrder.childId,
                  name: originalOrder.childName,
                } : null}
                selectedCostume={originalOrder ? {
                  costumeId: originalOrder.costumeId,
                  name: originalOrder.costumeName,
                  inventoryCode: originalOrder.inventoryCode,
                } : null}
                disabled={locked}
                errors={{
                  childId: form.errors[`orders.${index}.childId`],
                  costumeId: form.errors[`orders.${index}.costumeId`],
                  rentPrice: form.errors[`orders.${index}.rentPrice`],
                }}
              />
              <Group gap="xs">
                <NumberInput
                  label="Предоплата"
                  value={order.prepaymentAmount}
                  readOnly
                  min={0}
                  hideControls
                  prefix="₸ "
                  w={180}
                />
                <Text size="sm" c="dimmed" mt="xl">
                  Сохранённая предоплата останется без изменений
                </Text>
              </Group>
              {index < form.values.orders.length - 1 && <Divider />}
            </Stack>
          );})}
          {form.values.orders.length === 1 && (
            <Text size="xs" c="dimmed">
              В визите должна остаться хотя бы одна позиция.
            </Text>
          )}

          <Group justify="flex-end" mt="sm">
            <Button type="button" variant="default" onClick={onClose} disabled={locked}>
              Закрыть
            </Button>
            <Button type="submit" loading={isSaving} disabled={locked || versionConflict}>
              Сохранить изменения
            </Button>
          </Group>
        </Stack>
      </form>
  );
}
