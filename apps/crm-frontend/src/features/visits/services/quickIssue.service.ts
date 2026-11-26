import type {
  QuickIssueVisitRequestDto,
  QuickIssueVisitResponseDto,
} from "@costumes/shared";
import { apiClient } from "src/services/apiClient";

export const quickIssueService = {
  create(data: QuickIssueVisitRequestDto): Promise<QuickIssueVisitResponseDto> {
    return apiClient.post("/visits/quick-issue", { body: data });
  },
};
