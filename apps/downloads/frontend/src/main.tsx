import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { applyFavicon } from '@artificio/ui'
import { initGtag } from '@artificio/analytics'
import '@artificio/ui/styles.css'
import './index.css'
import App from './App.tsx'

applyFavicon()

const gaId = import.meta.env.VITE_GA_ID;
if (gaId) {
  initGtag(gaId);
}

// Tema compartilhado cross-subdomínio via cookie `artificio_theme` (D067).
// Sem cookie -> dark (mesmo default operacional do mesas).
function resolveDownloadsTheme(): 'light' | 'dark' {
  const m = /(?:^|;\s*)artificio_theme=(dark|light)(?=;|$)/.exec(document.cookie)
  return m ? (m[1] as 'light' | 'dark') : 'dark'
}
document.documentElement.dataset.theme = resolveDownloadsTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
