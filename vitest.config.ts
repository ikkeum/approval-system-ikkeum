import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // Next.js 서버 전용 가드는 vitest(node) 환경에서 의미 없으므로 빈 모듈로 대체
      "server-only": path.resolve(__dirname, "tests/stubs/empty.ts"),
      "@": path.resolve(__dirname),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
