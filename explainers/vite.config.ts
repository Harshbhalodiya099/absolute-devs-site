import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Builds the explainers straight into the static site as /learn/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/learn/",
  build: {
    outDir: "../learn",
    emptyOutDir: true,
  },
  // Tests live next to what they test, in src/**/__tests__/.
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test-setup.ts"],
    restoreMocks: true,
  },
});
