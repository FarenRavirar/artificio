import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { installDiagnostics } from './lib/diagnostics'
import { applyFavicon } from '@artificio/ui'
import { initGtag } from '@artificio/analytics'
import '@artificio/ui/styles.css'
import './index.css'
import App from './App.tsx'

installDiagnostics()
applyFavicon()

const gaId = import.meta.env.VITE_GA_ID;
if (gaId) {
  initGtag(gaId);
}

// Tema lua/sol (Spec 020 D067). Tema é COMPARTILHADO cross-subdomínio via cookie
// único `artificio_theme` — a escolha do usuário em qualquer módulo vale aqui.
// O cookie agora só é escrito em escolha EXPLÍCITA (accounts/site corrigidos p/
// não gravar a pref do SO no boot), então é opt-in confiável. Sem cookie (ninguém
// escolheu) → DEFAULT-DARK (mesas é operacional/dark; ignora OS-prefers).
function resolveMesasTheme(): 'light' | 'dark' {
  const m = document.cookie.match(/(?:^|;\s*)artificio_theme=(dark|light)/)
  return m ? (m[1] as 'light' | 'dark') : 'dark'
}
document.documentElement.dataset.theme = resolveMesasTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
