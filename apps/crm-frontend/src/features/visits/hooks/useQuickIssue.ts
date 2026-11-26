import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QuickIssueVisitRequestDto } from "@costumes/shared";
import { notifications } from "@mantine/notifications";
import { quickIssueService } from "../services/quickIssue.service";
import { visitHistoryKeys } from "./useVisitHistory";
import { visitReadKeys } from "./useVisitReads";

export function useQuickIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: QuickIssueVisitRequestDto) =>
      quickIssueService.create(request),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["visit"] });
      queryClient.invalidateQueries({ queryKey: ["costumes"] });
      queryClient.invalidateQueries({ queryKey: visitReadKeys.listPrefix() });
      queryClient.invalidateQueries({ queryKey: visitReadKeys.detailPrefix() });
      queryClient.invalidateQueries({ queryKey: visitHistoryKeys.all });
      notifications.show({
        title: "Костюмы выданы",
        message: `Визит №${result.visitCode} создан`,
        color: "green",
        position: "top-right",
      });
    },
  });
}
