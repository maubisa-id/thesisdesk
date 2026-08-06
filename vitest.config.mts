import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit test (node env). Fokus logika murni/keamanan (federasi JWT, RBAC). Tanpa DB/server.
export default defineConfig({
  test: { environment: "node", include: ["test/**/*.test.ts"] },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
