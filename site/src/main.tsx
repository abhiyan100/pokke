import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@app/ui/base.css'
import './site.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
