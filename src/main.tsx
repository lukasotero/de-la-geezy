import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { TooltipProvider } from './components/ui/tooltip'
import { AppMotionProvider } from './components/motion-system'
import { Toaster } from './components/ui/sonner'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppMotionProvider><TooltipProvider><App /><Toaster /></TooltipProvider></AppMotionProvider>
  </StrictMode>,
)
