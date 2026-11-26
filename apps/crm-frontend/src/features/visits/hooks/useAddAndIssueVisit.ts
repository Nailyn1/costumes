import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import type { AddAndIssueVisitRequestDto } from "@costumes/shared";
import { addIssuedService } from "../services/addIssued.service";
import { visitHistoryKeys } from "./useVisitHistory";
import { visitReadKeys } from "./useVisitReads";

interface AddAndIssueVariables {
  visitId: number;
  body: AddAndIssueVisitRequestDto;
}

export function useAddAndIssueVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ visitId, body }: AddAndIssueVariables) =>
      addIssuedService.addAndIssue(visitId, body),
    onSuccess: (detail, { visitId }) => {
      queryClient.setQueryData(visitReadKeys.detail(visitId), detail);
      void queryClient.invalidateQueries({ queryKey: ["visits"] });
      void queryClient.invalidateQueries({ queryKey: ["visit"] });
      void queryClient.invalidateQueries({ queryKey: ["costumes"] });
      void queryClient.invalidateQueries({ queryKey: visitReadKeys.listPrefix() });
      void queryClient.invalidateQueries({ queryKey: visitHistoryKeys.detail(visitId) });
      notifications.show({
        title: "Костюм добавлен и выдан",
        message: `Визит №${detail.visitCode} обновлён`,
        color: "green",
        position: "top-right",
      });
    },
  });
}
