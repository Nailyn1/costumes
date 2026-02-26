import type {
  CreateClientRequestDto,
  UpdateClientRequestDto,
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
};
