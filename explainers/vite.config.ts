import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Builds the explainers straight into the static site as /learn/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/learn/",
  build: {
    outDir: "../learn",
    emptyOutDir: true,
  },
});
