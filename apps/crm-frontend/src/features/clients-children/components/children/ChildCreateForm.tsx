import { Stack, TextInput, Button } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useCreateChild } from "../../hooks/useChild";
import type { SelectedChild } from "../../types/clientTypes";

interface ChildCreateFormProps {
  clientId: number;
  onCreated: (child: SelectedChild) => void;
}

export function ChildCreateForm({ clientId, onCreated }: ChildCreateFormProps) {
  const createMutation = useCreateChild();

  const form = useForm({
    initialValues: { name: "" },
    validate: {
      name: (v) => {
        if (v.trim().length < 2) {
          return "Слишком короткое имя";
        }
        return null;
      },
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    createMutation.mutate(
      { clientId, name: values.name },
      {
        onSuccess: (data) => {
          onCreated({
            childId: data.childId,
            name: data.name,
          });
          form.reset();
        },
      },
    );
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="xs">
        <TextInput
          label="Имя нового ребенка"
          placeholder="Введите имя"
          {...form.getInputProps("name")}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              form.onSubmit(handleSubmit)();
            }
          }}
        />
        <Button
          type="submit"
          size="xs"
          loading={createMutation.isPending}
          fullWidth
        >
          Создать и выбрать
        </Button>
      </Stack>
    </form>
  );
}
