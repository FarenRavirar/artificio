import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { applyFavicon, applyTheme } from '@artificio/ui'
import { initGtag } from '@artificio/analytics'
import '@artificio/ui/styles.css'
import './index.css'
import { installDiagnostics } from './features/dev-feedback/diagnostics'

applyFavicon()
applyTheme() // tema canônico cross-subdomínio (lua/sol) — Spec 020
installDiagnostics() // coletor p/ widget de feedback (Spec 021) — instalar cedo

const gaId = import.meta.env.VITE_GA_ID;
if (gaId) {
  initGtag(gaId);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
