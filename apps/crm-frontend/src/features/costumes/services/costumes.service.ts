import type {
  CreateCostumesRequestDto,
  UpdateCostumesRequestDto,
} from "@costumes/shared";
import type { GetParams } from "src/features/visits/services/visits.service";
import { apiClient } from "src/services/apiClient";

export const costumeService = {
  createCostume(data: CreateCostumesRequestDto) {
    return apiClient.post("/costumes", { body: data });
  },
  updateCostume(data: UpdateCostumesRequestDto, costumeId: number) {
    return apiClient.patch("/costumes/{costumeId}", { body: data, path: { costumeId } });
  },
  deleteCostume(costumeId: number) {
    return apiClient.delete("/costumes/{costumeId}", { path: { costumeId } });
  },
  searchCostumes(searchQuery: string) {
    return apiClient.get("/costumes/search", { query: { q: searchQuery } });
  },
  searchAvailableCostumes(
    searchQuery: string,
    stardDate: string,
    endDate: string,
    excludeVisitId?: number,
  ) {
    return apiClient.get("/costumes/search-available", {
      query: {
        q: searchQuery,
        startDate: stardDate,
        endDate: endDate,
        excludeVisitId,
      },
    });
  },
  isAvailableCostume(costumeId: number) {
    return apiClient.get("/costumes/{costumeId}/availability", { path: { costumeId } });
  },
  getCostumesList(params?: GetParams) {
    return apiClient.get("/costumes/list", { query: params });
  },
};
