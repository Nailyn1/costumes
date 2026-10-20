import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import { createApiClient, type Fetcher, type FetcherResponse } from "@costumes/shared";
import { api, API_BASE_URL } from "./api";

export const resolveApiBaseUrl = (baseUrl: string, origin: string) =>
  new URL(baseUrl || "/", origin).href.replace(/\/$/, "");

const toFetcherResponse = (response: AxiosResponse<unknown>): FetcherResponse => {
  const payload = response.status === 204 ? null : response.data;
  const body = payload == null ? null : JSON.stringify(payload);
  const headers = new Headers();
  for (const [name, value] of Object.entries(response.headers)) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(", "));
  }

  const makeResponse = (): FetcherResponse => ({
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    statusText: response.statusText,
    headers,
    body: null,
    json: async () => payload,
    text: async () => body ?? "",
    arrayBuffer: async () => new TextEncoder().encode(body ?? "").buffer,
    clone: makeResponse,
  });
  return makeResponse();
};

const fetcher: Fetcher = {
  async fetch(input) {
    const requestHeaders = new Headers(input.overrides?.headers);
    for (const [name, value] of Object.entries(input.parameters?.header ?? {})) {
      if (value !== undefined && value !== null) requestHeaders.set(name, String(value));
    }
    const config: AxiosRequestConfig = {
      method: input.method,
      url: input.url.toString(),
      params: input.urlSearchParams,
      headers: Object.fromEntries(requestHeaders.entries()),
      data: input.parameters?.body,
      signal: input.overrides?.signal ?? undefined,
    };

    try {
      return toFetcherResponse(await api.request<unknown>(config));
    } catch (error) {
      // Let the Axios response interceptor refresh/retry first; only convert the
      // final HTTP response so typed-openapi can validate its status body.
      if (axios.isAxiosError(error) && error.response) {
        return toFetcherResponse(error.response);
      }
      throw error;
    }
  },
};

export const apiClient = createApiClient(
  fetcher,
  resolveApiBaseUrl(API_BASE_URL, window.location.origin),
  {
    validate: "both",
  },
);
