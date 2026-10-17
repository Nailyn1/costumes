import { setupServer } from "msw/node";

/** MSW-сервер для тестов: обработчики добавляются в тесте через `server.use(...)`. */
export const server = setupServer();

export const API_URL = "http://api.test";
