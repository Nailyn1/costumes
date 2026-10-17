import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      // тот же origin, что и VITE_API_URL: иначе XHR в jsdom упирается в CORS
      environmentOptions: { jsdom: { url: "http://api.test" } },
      setupFiles: ["./test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      env: { VITE_API_URL: "http://api.test" },
      restoreMocks: true,
    },
  }),
);
