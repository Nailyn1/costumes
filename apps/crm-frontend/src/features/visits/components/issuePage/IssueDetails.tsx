import {
  Box,
  Button,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  type ButtonProps,
} from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { MoneyInput } from "src/components/MoneyInput";
import { issueBalance } from "../../utils/visitBalance";

type DepositType = "cash" | "document" | "none";

interface IssuePaymentFieldsProps {
  remainingToPay: number;
  payment: number | string;
  onPaymentChange: (value: number | string) => void;
  depositType: DepositType;
  onDepositTypeChange: (value: DepositType) => void;
  depositAmount: number | string;
  onDepositAmountChange: (value: number | string) => void;
  isMobile: boolean;
  disabled?: boolean;
  paymentLabel?: string;
  totalLabel?: string;
  paymentError?: ReactNode;
  depositError?: ReactNode;
}

export function IssuePaymentFields({
  remainingToPay,
  payment,
  onPaymentChange,
  depositType,
  onDepositTypeChange,
  depositAmount,
  onDepositAmountChange,
  isMobile,
  disabled,
  paymentLabel = "Сумма доплаты (факт)",
  totalLabel = "Итого к доплате:",
  paymentError,
  depositError,
}: IssuePaymentFieldsProps) {
  const balance = issueBalance(remainingToPay, Number(payment) || 0);
  return (
    <Paper p="md" bg="blue.0" radius="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={700}>{totalLabel}</Text>
          <Text fw={700} size="xl" c="blue.9">
            {remainingToPay.toLocaleString("ru-RU")} ₸
          </Text>
        </Group>
        <SimpleGrid cols={isMobile ? 1 : 2}>
          <Stack gap={4}>
            <MoneyInput
              label={paymentLabel}
              size="md"
              value={payment}
              onChange={onPaymentChange}
              error={paymentError}
              disabled={disabled}
            />
          </Stack>
          <Box>
            <Text size="md" fw={500} mb={3}>
              Тип залога
            </Text>
            <SegmentedControl
              fullWidth
              size="md"
              value={depositType}
              disabled={disabled}
              data={[
                { label: "Нал", value: "cash" },
                { label: "Док", value: "document" },
                { label: "Нет", value: "none" },
              ]}
              onChange={(value) => {
                if (
                  value === "cash" ||
                  value === "document" ||
                  value === "none"
                )
                  onDepositTypeChange(value);
              }}
            />
          </Box>
        </SimpleGrid>
        <Text
          fw={600}
          c={
            balance.debt > 0
              ? "orange.9"
              : balance.refundDue > 0
                ? "red.8"
                : "green.8"
          }
        >
          {balance.debt > 0
            ? `После выдачи останется долг: ${balance.debt} ₸`
            : balance.refundDue > 0
              ? `Вернуть клиенту: ${balance.refundDue} ₸`
              : "Аренда оплачена полностью"}
        </Text>
        {depositType === "cash" && (
          <MoneyInput
            label="Сумма залога"
            value={depositAmount}
            onChange={onDepositAmountChange}
            error={depositError}
            disabled={disabled}
          />
        )}
      </Stack>
    </Paper>
  );
}

interface IssueOrderCardProps {
  childName: string;
  costumeName: string;
  inventoryCode?: string;
  rentPrice: number;
  prepaymentAmount?: number;
  tagBadge?: ReactNode;
}

export function IssueOrderCard({
  childName,
  costumeName,
  inventoryCode,
  rentPrice,
  prepaymentAmount,
  tagBadge,
}: IssueOrderCardProps) {
  return (
    <Paper withBorder p="sm" radius="sm" bg="gray.0">
      <Group justify="space-between" align="flex-start">
        <Box flex={1} miw={0}>
          <Text size="md" fw={700}>
            {childName} — {costumeName}
          </Text>
          <Group gap="sm" mt={4}>
            {inventoryCode && (
              <Text size="md" c="dimmed">
                Код: {inventoryCode}
              </Text>
            )}
            {tagBadge}
          </Group>
        </Box>
        <Box ta="right">
          <Text size="md" fw={600}>
            {rentPrice.toLocaleString("ru-RU")} ₸
          </Text>
          {prepaymentAmount !== undefined && (
            <>
              <Text size="md" c="green.7">
                Оплачено: {prepaymentAmount} ₸
              </Text>
              <Text size="md" c="red.7" fw={500}>
                Остаток: {rentPrice - prepaymentAmount} ₸
              </Text>
            </>
          )}
        </Box>
      </Group>
    </Paper>
  );
}

export function IssueSubmitButton(
  props: ButtonProps & { type?: "button" | "submit"; onClick?: () => void },
) {
  return (
    <Button
      type="submit"
      size="lg"
      fullWidth
      color="green"
      leftSection={<IconCheck size={20} />}
      {...props}
    >
      Выдать костюмы
    </Button>
  );
}
