import { useMutation } from "@tanstack/react-query";
import { visitsService } from "../services/visits.service";

export function useVisitPreviewCode() {
  return useMutation({
    mutationFn: () => visitsService.getPreviewCode(),
  });
}
