import { defineConfig } from "vite";

// One self-contained HTML file also runs under file:// in Lively's Chromium player.
export default defineConfig({
  base: "./",
  build: { target: "es2022", assetsInlineLimit: 10000000, chunkSizeWarningLimit: 650 },
});
