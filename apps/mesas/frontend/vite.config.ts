import { defineConfig } from 'vite'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'

// SSR universal (spec 102 T4.2). O plugin `reactRouter()` substitui
// `@vitejs/plugin-react`: ele já inclui o transform do React e é quem lê
// `react-router.config.ts` e `src/routes.ts` para montar os dois bundles
// (cliente e servidor).
//
// `manualChunks` saiu: no framework mode o particionamento é por rota, feito
// pelo próprio plugin. Forçar chunk de vendor aqui brigaria com isso.
export default defineConfig({
  plugins: [reactRouter(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 500,
    assetsInlineLimit: 0,
  },
})
