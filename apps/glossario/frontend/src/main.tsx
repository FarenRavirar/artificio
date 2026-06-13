import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { applyFavicon, applyTheme } from '@artificio/ui'
import '@artificio/ui/styles.css'
import './index.css'

applyFavicon()
applyTheme() // tema canônico cross-subdomínio (lua/sol) — Spec 020

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
