/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Browser calls /api/*; Vite forwards to the Express gateway during development.
    proxy: { "/api": process.env.VITE_GATEWAY_URL ?? "http://localhost:3001" },
  },
  test: { environment: "jsdom", setupFiles: ["./src/setupTests.ts"], globals: true },
});
