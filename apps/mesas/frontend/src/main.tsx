import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { installDiagnostics } from './lib/diagnostics'
import { applyFavicon } from '@artificio/ui'
import '@artificio/ui/styles.css'
import './index.css'
import App from './App.tsx'

installDiagnostics()
applyFavicon()

// Tema lua/sol (Spec 020 D066). mesas é operacional/dark: DEFAULT-DARK — só vira
// light se o usuário escolheu explicitamente (cookie/localStorage). Ausência ou
// OS-prefers-light → dark (desvio deliberado do resolveTheme canônico p/ não
// regredir o app em prod). Mesmo cookie canônico `artificio_theme`.
function resolveMesasTheme(): 'light' | 'dark' {
  try {
    const m = document.cookie.match(/(?:^|;\s*)artificio_theme=(dark|light)/)
    if (m) return m[1] as 'light' | 'dark'
    const ls = localStorage.getItem('theme')
    if (ls === 'light' || ls === 'dark') return ls
  } catch {
    /* cookie/localStorage indisponível */
  }
  return 'dark'
}
document.documentElement.dataset.theme = resolveMesasTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
