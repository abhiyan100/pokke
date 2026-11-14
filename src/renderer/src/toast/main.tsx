import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../ui/base.css'
import './toast.css'
import { Toast } from './Toast'

if (!window.xtractor) document.body.dataset.mock = ''

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Toast />
  </StrictMode>
)
