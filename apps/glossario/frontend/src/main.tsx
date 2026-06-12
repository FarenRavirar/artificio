import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { applyFavicon } from '@artificio/ui'
import '@artificio/ui/styles.css'
import './index.css'

applyFavicon()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
