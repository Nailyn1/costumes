import { Button, Center, Loader, Modal, Stack, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { MoneyInput } from "src/components/MoneyInput";
import { useSettleVisit, useVisitBalance } from "../../hooks/useVisits";

interface Props {
  visitId: number | null;
  visitCode: string;
  onClose: () => void;
}

export function SettleBalanceModal({ visitId, visitCode, onClose }: Props) {
  const { data: balance, isLoading, isError } = useVisitBalance(visitId);
  const mutation = useSettleVisit();
  const form = useForm({ initialValues: { amount: "" as number | string } });
  const due = balance ? balance.debt || balance.refundDue : 0;
  const isDebt = Boolean(balance?.debt);

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const handleSubmit = form.onSubmit(({ amount: entered }) => {
    if (!visitId || !balance || !due) return;
    const amount = entered === "" ? due : Number(entered);
    if (!Number.isInteger(amount) || amount <= 0 || amount > due) {
      form.setFieldError("amount", `Укажите сумму от 1 до ${due} ₸`);
      return;
    }
    mutation.mutate(
      { visitId, data: { kind: isDebt ? "debt_payment" : "customer_refund", amount } },
      { onSuccess: handleClose },
    );
  });

  return (
    <Modal opened={visitId !== null} onClose={handleClose} title={`Расчёт по визиту #${visitCode}`} size="sm">
      {isLoading && <Center p="xl"><Loader /></Center>}
      {isError && <Text c="red">Не удалось загрузить баланс визита</Text>}
      {balance && (
        <form onSubmit={handleSubmit}>
          <Stack>
            <Text fw={700} c={isDebt ? "orange.9" : "red.8"}>
              {isDebt ? `Долг клиента: ${balance.debt} ₸` : `Вернуть клиенту: ${balance.refundDue} ₸`}
            </Text>
            {due > 0 && (
              <>
                <MoneyInput
                  label={isDebt ? "Получено от клиента" : "Выдано клиенту"}
                  max={due}
                  {...form.getInputProps("amount")}
                  value={form.values.amount === "" ? due : form.values.amount}
                />
                <Button type="submit" loading={mutation.isPending} fullWidth>
                  {isDebt ? "Записать оплату" : "Записать возврат"}
                </Button>
              </>
            )}
            {due === 0 && <Text>Расчёт по визиту завершён</Text>}
          </Stack>
        </form>
      )}
    </Modal>
  );
}
