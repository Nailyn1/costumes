import {
  type AddClientInBlackListRequestDto,
  type CreateChildRequestDto,
  type CreateClientRequestDto,
  type UpdateChildRequestDto,
  type UpdateClientRequestDto,
} from "@costumes/shared";
import type { GetParams } from "src/features/visits/services/visits.service";
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
  addClientInBlacklist(clientId: number, data: AddClientInBlackListRequestDto) {
    return apiClient.ClientOperations_addClientInBlackList(data, {
      params: { clientId },
    });
  },
  removeClientFromBlacklist(clientId: number) {
    return apiClient.ClientOperations_removeClientFromBlackList(undefined, {
      params: { clientId },
    });
  },
  getClientsList(params?: GetParams) {
    return apiClient.ClientOperations_getClientList({ queries: params });
  },
  getDetaileClient(clientId: number) {
    return apiClient.ClientOperations_getClientDetail({ params: { clientId } });
  },
};
