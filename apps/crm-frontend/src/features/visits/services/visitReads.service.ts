import type { VisitListQueryDto } from "@costumes/shared";
import { apiClient } from "src/services/apiClient";

export const visitReadsService = {
  getVisits(params: VisitListQueryDto) {
    return apiClient.get("/visits", { query: params });
  },
  getVisitDetail(visitId: number) {
    return apiClient.get("/visits/{visitId}", { path: { visitId } });
  },
};
