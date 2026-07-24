import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { auth } from './config/firebase'
import { signOut, setPersistence, inMemoryPersistence } from 'firebase/auth'

// Purge any stale IndexedDB auth token on boot if no active session was explicitly started
if (sessionStorage.getItem('aescion_active_session') !== 'true') {
  try {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      indexedDB.deleteDatabase('firebaseLocalStorageDb');
    }
  } catch (e) {
    // Ignore purge errors
  }
  setPersistence(auth, inMemoryPersistence)
    .then(() => signOut(auth))
    .catch(console.error);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
