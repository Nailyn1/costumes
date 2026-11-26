import type {
  UpdateReservedVisitRequestDto,
  VisitListQueryDto,
} from "@costumes/shared";
import { apiClient } from "src/services/apiClient";

export const visitReadsService = {
  getVisits(params: VisitListQueryDto) {
    return apiClient.get("/visits", { query: params });
  },
  getVisitDetail(visitId: number) {
    return apiClient.get("/visits/{visitId}", { path: { visitId } });
  },
  updateReservedVisit(visitId: number, body: UpdateReservedVisitRequestDto) {
    return apiClient.patch("/visits/{visitId}", { path: { visitId }, body });
  },
};
