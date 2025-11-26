import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary, AudioErrorBoundary } from './components/errors'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary level="app" onError={(error) => {
      // Log to console with timestamp for debugging
      console.error('[App Crash]', new Date().toISOString(), error);
    }}>
      <AudioErrorBoundary>
        <App />
      </AudioErrorBoundary>
    </ErrorBoundary>
  </StrictMode>,
)
 