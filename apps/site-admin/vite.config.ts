import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// SPA admin do site (spec 011). Build separado do Astro público (toolchain próprio: vite 8 + plugin-react 6).
// Servida pelo Express do site em /admin (base) → assets resolvem sob /admin/.
// Em dev, proxy /api e /admin/preview pro backend (porta 4322).
export default defineConfig({
  base: "/admin/",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    port: 4330,
    proxy: {
      "/api": { target: "http://localhost:4322", changeOrigin: true },
      "/admin/preview": { target: "http://localhost:4322", changeOrigin: true },
    },
  },
});
