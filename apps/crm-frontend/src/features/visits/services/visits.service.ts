import {
  type CreateVisitRequestDto,
  type visitCancelRequestDto,
  type visitCompleteReturnRequestDto,
  type VisitIssueRequestDto,
} from "@costumes/shared";
import { apiClient } from "src/services/apiClient";

export interface GetReservedParams {
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface GetParams {
  page?: number;
  limit?: number;
}
export const visitsService = {
  getPreviewCode() {
    return apiClient.VisitOperation_previewCode(undefined);
  },
  createVisit(data: CreateVisitRequestDto, sendNotification: boolean) {
    return apiClient.VisitOperation_create(data, {
      queries: { sendNotification },
    });
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
  returnSearchVisits(search: string) {
    return apiClient.VisitOperation_searchForReturn({ queries: { q: search } });
  },
  getVisitForReturn(visitId: number) {
    return apiClient.VisitOperation_getForReturn({ params: { visitId } });
  },
  completeReturnVisit(data: visitCompleteReturnRequestDto, visitId: number) {
    return apiClient.VisitOperation_completeReturn(data, {
      params: { visitId },
    });
  },
  getUnreturnedDeposits(params?: GetParams) {
    return apiClient.VisitOperation_getUnreturnedDeposits({
      queries: params,
    });
  },
  markDepositReturned(notes: string, visitId: number) {
    return apiClient.VisitOperation_markDepositReturned(
      { notes },
      { params: { visitId } },
    );
  },
  getIssuedVisits(params?: GetParams) {
    return apiClient.VisitOperation_getIssuedVisits({ queries: params });
  },
  getVisitsNotification(params?: GetParams) {
    return apiClient.VisitOperation_getVisitNotification({ queries: params });
  },
};
