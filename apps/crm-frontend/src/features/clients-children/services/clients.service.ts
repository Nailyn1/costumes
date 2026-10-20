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
    return apiClient.get("/clients/search", { query: { q: searchQuery } });
  },
  createClient(data: CreateClientRequestDto) {
    return apiClient.post("/clients", { body: data });
  },
  deleteClient(clientId: number) {
    return apiClient.delete("/clients/{clientId}", { path: { clientId } });
  },
  updateClient(data: UpdateClientRequestDto, clientId: number) {
    return apiClient.patch("/clients/{clientId}", { body: data, path: { clientId } });
  },
  createChild(data: CreateChildRequestDto) {
    return apiClient.post("/children", { body: data });
  },
  updateChild(data: UpdateChildRequestDto, childId: number) {
    return apiClient.patch("/children/{childId}", { body: data, path: { childId } });
  },
  deleteChild(childId: number) {
    return apiClient.delete("/children/{childId}", { path: { childId } });
  },
  addClientInBlacklist(clientId: number, data: AddClientInBlackListRequestDto) {
    return apiClient.post("/clients/{clientId}/blacklist", { body: data, path: { clientId } });
  },
  removeClientFromBlacklist(clientId: number) {
    return apiClient.delete("/clients/{clientId}/blacklist", { path: { clientId } });
  },
  getClientsList(params?: GetParams) {
    return apiClient.get("/clients/list", { query: params });
  },
  getDetaileClient(clientId: number) {
    return apiClient.get("/clients/detail/{clientId}", { path: { clientId } });
  },
};
