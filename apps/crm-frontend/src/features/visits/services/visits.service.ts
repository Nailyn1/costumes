import type { CreateVisitRequestDto } from "@costumes/shared";
import { apiClient } from "src/services/apiClient";

export const visitsService = {
  getPreviewCode() {
    return apiClient.VisitOperation_previewCode(undefined);
  },
  createVisit(data: CreateVisitRequestDto) {
    return apiClient.VisitOperation_create(data);
  },
  getVisitNotWritten() {
    return apiClient.VisitOperation_getNotWritten(undefined);
  },
  markTagVisitWritten(orderId: number) {
    return apiClient.VisitOperation_markTagWritten(undefined, {
      params: { orderId },
    });
  },
};
