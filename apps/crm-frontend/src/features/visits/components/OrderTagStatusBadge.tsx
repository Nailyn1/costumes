import { Badge } from "@mantine/core";
import type { Visits_TagStatus } from "@costumes/shared";

const tagStatusPresentation: Record<
  Visits_TagStatus,
  { label: string; color: string }
> = {
  written: { label: "Бирка есть", color: "green" },
  not_written: { label: "Нет бирки", color: "gray" },
  not_required: { label: "Бирка не требуется", color: "blue" },
};

export function OrderTagStatusBadge({
  tagStatus,
}: {
  tagStatus: Visits_TagStatus;
}) {
  const presentation = tagStatusPresentation[tagStatus];
  return (
    <Badge color={presentation.color} variant="light">
      {presentation.label}
    </Badge>
  );
}
