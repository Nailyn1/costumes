import {
  type CreateChildRequestDto,
  type CreateClientRequestDto,
  type UpdateChildRequestDto,
  type UpdateClientRequestDto,
} from "@costumes/shared";
import { apiClient } from "src/services/apiClient";

export const clientsService = {
  searchClients(searchQuery: string) {
    return apiClient.ClientOperations_search({ queries: { q: searchQuery } });
  },
  createClient(data: CreateClientRequestDto) {
    return apiClient.ClientOperations_create(data);
  },
  deleteClient(clientId: number) {
    return apiClient.ClientOperations_delete(undefined, {
      params: { clientId: clientId },
    });
  },
  updateClient(data: UpdateClientRequestDto, clientId: number) {
    return apiClient.ClientOperations_update(data, { params: { clientId } });
  },
  createChild(data: CreateChildRequestDto) {
    return apiClient.ChildOperations_create(data);
  },
  updateChild(data: UpdateChildRequestDto, childId: number) {
    return apiClient.ChildOperations_update(data, { params: { childId } });
  },
  deleteChild(childId: number) {
    return apiClient.ChildOperations_delete(undefined, { params: { childId } });
  },
};
