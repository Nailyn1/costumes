import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4010";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});
