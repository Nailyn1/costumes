import type {
  CreateCostumesRequestDto,
  UpdateCostumesRequestDto,
} from "@costumes/shared";
import type { GetParams } from "src/features/visits/services/visits.service";
import { apiClient } from "src/services/apiClient";

export const costumeService = {
  createCostume(data: CreateCostumesRequestDto) {
    return apiClient.CostumeOperations_create(data);
  },
  updateCostume(data: UpdateCostumesRequestDto, costumeId: number) {
    return apiClient.CostumeOperations_update(data, { params: { costumeId } });
  },
  deleteCostume(costumeId: number) {
    return apiClient.CostumeOperations_delete(undefined, {
      params: { costumeId },
    });
  },
  searchCostumes(searchQuery: string) {
    return apiClient.CostumeOperations_searchAvailability({
      queries: { q: searchQuery },
    });
  },
  searchAvailableCostumes(
    searchQuery: string,
    stardDate: string,
    endDate: string,
  ) {
    return apiClient.CostumeOperations_searchAvailable({
      queries: {
        q: searchQuery,
        startDate: stardDate,
        endDate: endDate,
      },
    });
  },
  isAvailableCostume(costumeId: number) {
    return apiClient.CostumeOperations_getDetailedAvailability({
      params: { costumeId },
    });
  },
  getCostumesList(params?: GetParams) {
    return apiClient.CostumeOperations_getCostumesList({
      queries: params,
    });
  },
};
