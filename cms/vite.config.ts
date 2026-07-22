import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5510,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 5510,
    strictPort: true,
  },
  test: {
    exclude: ["e2e/**", "node_modules/**"],
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
