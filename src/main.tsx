import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { auth } from './config/firebase'
import { signOut, setPersistence, inMemoryPersistence } from 'firebase/auth'

// Enforce strict security: clear any residual cached auth session immediately
setPersistence(auth, inMemoryPersistence)
  .then(() => signOut(auth))
  .catch(console.error);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
