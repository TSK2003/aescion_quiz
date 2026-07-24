import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "aescion-quiz.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "aescion-quiz",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "aescion-quiz.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1027675619694",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1027675619694:web:3daa28f6a0041ee416c17f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserSessionPersistence).catch((error) => console.error("Error setting persistence", error));
export const db = getFirestore(app);
