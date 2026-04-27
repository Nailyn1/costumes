import { Select, Loader } from "@mantine/core";
import { useMemo } from "react";
import type { SelectedChild } from "../../types/clientTypes";
import { useClient } from "../../hooks/useClients";

interface ChildSearchFieldProps {
  clientId: number | null;
  value: string | null; // childId в строковом виде для Mantine Select
  onSelect: (child: SelectedChild | null) => void;
  error?: React.ReactNode;
}

export function ChildSearchField({
  clientId,
  value,
  onSelect,
  error,
}: ChildSearchFieldProps) {
  const { data: client, isLoading } = useClient(clientId);
  const selectData = useMemo(() => {
    if (!client || !client.children) {
      return [];
    }

    return client.children.map((child) => ({
      value: child.childId.toString(),
      label: child.name,
    }));
  }, [client]);

  const handleChange = (selectedId: string | null) => {
    if (!selectedId) {
      onSelect(null);
      return;
    }

    const fullChild = client?.children?.find(
      (c) => c.childId.toString() === selectedId,
    );

    if (fullChild) {
      onSelect(fullChild);
    }
  };

  return (
    <Select
      label=""
      placeholder={isLoading ? "Загрузка..." : "Выберите ребенка"}
      data={selectData}
      value={value}
      onChange={handleChange}
      error={error}
      nothingFoundMessage="Дети не найдены"
      searchable
      disabled={!clientId}
      rightSection={isLoading ? <Loader size="xs" /> : null}
    />
  );
}
