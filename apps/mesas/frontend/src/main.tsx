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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
