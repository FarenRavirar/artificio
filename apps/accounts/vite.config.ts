import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  root: "frontend",
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
});
