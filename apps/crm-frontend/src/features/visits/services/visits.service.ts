import type { CreateVisitRequestDto } from "@costumes/shared";
import { apiClient } from "src/services/apiClient";

export const visitsService = {
  getPreviewCode() {
    return apiClient.VisitOperation_previewCode(undefined);
  },
  createVisit(data: CreateVisitRequestDto) {
    return apiClient.VisitOperation_create(data);
  },
};
