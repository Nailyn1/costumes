import { apiClient } from "src/services/apiClient";
import type { VisitHistoryQueryDto } from "@costumes/shared";

export const visitHistoryService = {
  getVisitHistory(visitId: number, params: VisitHistoryQueryDto) {
    return apiClient.get("/visits/{visitId}/history", {
      path: { visitId },
      query: params,
    });
  },
};
