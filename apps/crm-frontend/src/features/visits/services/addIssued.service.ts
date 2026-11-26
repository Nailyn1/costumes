import type {
  AddAndIssueVisitRequestDto,
  AddAndIssueVisitResponseDto,
} from "@costumes/shared";
import { apiClient } from "src/services/apiClient";

export const addIssuedService = {
  addAndIssue(
    visitId: number,
    body: AddAndIssueVisitRequestDto,
  ): Promise<AddAndIssueVisitResponseDto> {
    return apiClient.post("/visits/{visitId}/add-and-issue", {
      path: { visitId },
      body,
    });
  },
};
