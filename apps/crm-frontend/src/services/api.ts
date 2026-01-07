import axios from "axios";
import { setupInterceptors } from "./interceptors";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4010";

const commonConfig = {
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
};

export const api = axios.create(commonConfig);

export const authApi = axios.create(commonConfig);

setupInterceptors(api);
