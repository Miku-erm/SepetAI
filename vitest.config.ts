import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 20000,
    projects: [
      {
        test: {
          name: "api",
          include: ["server/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        plugins: [react()],
        test: {
          name: "web",
          include: ["client/**/*.test.tsx"],
          environment: "jsdom",
        },
      },
    ],
  },
});
