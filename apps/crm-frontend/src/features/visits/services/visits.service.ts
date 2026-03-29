import type {
  CreateVisitRequestDto,
  visitCancelRequestDto,
  VisitIssueRequestDto,
} from "@costumes/shared";
import { apiClient } from "src/services/apiClient";

export interface GetReservedParams {
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

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
  getVisitsReserved(params?: GetReservedParams) {
    return apiClient.VisitOperation_getReserved({
      queries: params,
    });
  },
  searchVisits(search: string) {
    return apiClient.VisitOperation_search({ queries: { q: search } });
  },
  getVisitForIssue(visitId: number) {
    return apiClient.VisitOperation_getForIssue({ params: { visitId } });
  },
  cancelVisit(data: visitCancelRequestDto, visitId: number) {
    return apiClient.VisitOperation_cancel(data, { params: { visitId } });
  },
  issueVisit(data: VisitIssueRequestDto, visitId: number) {
    return apiClient.VisitOperation_issue(data, { params: { visitId } });
  },
};
