import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset URLs in the build, so `dist/` also works when it is served from a subdirectory
  // rather than from a domain root.
  base: "./",
  server: { open: true },
});
