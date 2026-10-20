import { defineConfig } from "typed-openapi";

export default defineConfig({
  input: "./api-spec/tsp-output/schema/openapi.yaml",
  output: "./src/openapi-client.ts",
  runtime: "zod",
  client: "promise",
  validation: "strict",
  validateSide: "both",
  schemaNaming: "always-name",
  openapi: { additionalPropertiesDefault: true },
  runtimeTypes: false,
  format: true,
});
