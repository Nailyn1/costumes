import { Stack, TextInput, Button } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useCreateChild } from "../../hooks/useChild"; // проверь путь к хуку
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
        // 1. Проверка на длину
        if (v.trim().length < 2) {
          return "Слишком короткое имя";
        }

        // 2. Проверка на наличие цифр (/\d/ ищет любую цифру от 0 до 9)
        if (/\d/.test(v)) {
          return "Имя не может содержать цифры";
        }

        // 3. (Опционально) Если нужно разрешить ТОЛЬКО буквы и пробелы
        // ^[a-zA-Zа-яА-ЯёЁ\s-]+$ разрешает латиницу, кириллицу, пробелы и дефис
        if (!/^[a-zA-Zа-яА-ЯёЁ\s-]+$/.test(v)) {
          return "Используйте только буквы";
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
          // Чтобы Enter срабатывал корректно внутри Collapse
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
