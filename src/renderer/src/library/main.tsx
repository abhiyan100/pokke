import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { api } from '../bridge'
import '../ui/base.css'
import './library.css'
import { App } from './App'

// The top bar leaves room for the window controls, which sit on different sides per platform.
document.documentElement.dataset.platform = api.platform

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
