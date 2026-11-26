import {
  type CreateVisitRequestDto,
  type visitCancelRequestDto,
  type visitCompleteReturnRequestDto,
  type VisitIssueRequestDto,
  type VisitSettlementRequestDto,
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
    return apiClient.post("/visits/preview-code");
  },
  createVisit(data: CreateVisitRequestDto, sendNotification: boolean) {
    return apiClient.post("/visits", {
      body: data,
      query: { sendNotification },
    });
  },
  getVisitNotWritten() {
    return apiClient.get("/visits/not_written");
  },
  markTagVisitWritten(orderId: number) {
    return apiClient.post("/visits/{orderId}/mark-tag-written", { path: { orderId } });
  },
  getVisitsReserved(params?: GetReservedParams) {
    return apiClient.get("/visits/reserved", { query: params });
  },
  searchVisits(search: string) {
    return apiClient.get("/visits/search", { query: { q: search } });
  },
  getVisitForIssue(visitId: number) {
    return apiClient.get("/visits/{visitId}/for-issue", { path: { visitId } });
  },
  cancelVisit(data: visitCancelRequestDto, visitId: number) {
    return apiClient.post("/visits/{visitId}/cancel", { body: data, path: { visitId } });
  },
  issueVisit(data: VisitIssueRequestDto, visitId: number) {
    return apiClient.post("/visits/{visitId}/issue", { body: data, path: { visitId } });
  },
  returnSearchVisits(search: string) {
    return apiClient.get("/visits/return-search", { query: { q: search } });
  },
  getVisitForReturn(visitId: number) {
    return apiClient.get("/visits/{visitId}/for-return", { path: { visitId } });
  },
  completeReturnVisit(data: visitCompleteReturnRequestDto, visitId: number) {
    return apiClient.post("/visits/{visitId}/complete-return", {
      body: data,
      path: { visitId },
    });
  },
  getUnreturnedDeposits(params?: GetParams) {
    return apiClient.get("/visits/unreturned-deposits", { query: params });
  },
  markDepositReturned(notes: string, visitId: number) {
    return apiClient.post("/visits/{visitId}/mark-deposit-returned", {
      body: { notes },
      path: { visitId },
    });
  },
  getIssuedVisits(params?: GetParams) {
    return apiClient.get("/visits/issued", { query: params });
  },
  getUnsettledBalances(params?: GetParams) {
    return apiClient.get("/visits/unsettled-balances", { query: params });
  },
  getVisitBalance(visitId: number) {
    return apiClient.get("/visits/{visitId}/balance", { path: { visitId } });
  },
  settleVisit(visitId: number, data: VisitSettlementRequestDto) {
    return apiClient.post("/visits/{visitId}/settlement", {
      path: { visitId },
      body: data,
    });
  },
  getVisitsNotification(params?: GetParams) {
    return apiClient.get("/visits/notification", { query: params });
  },
  visitUnissue(visitId: number) {
    return apiClient.post("/visits/{visitId}/unissue", { path: { visitId } });
  },
  searchNotification(search: string) {
    return apiClient.get("/visits/notification-search", { query: { q: search } });
  },
};
