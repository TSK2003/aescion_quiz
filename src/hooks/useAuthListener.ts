import { useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useAuthStore } from '../store/useAuthStore';

export const useAuthListener = () => {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      const isExplicitSession = sessionStorage.getItem('aescion_active_session') === 'true';

      if (firebaseUser && isExplicitSession) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        if (unsubscribeDoc) unsubscribeDoc();
        
        unsubscribeDoc = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setUser({
              uid: firebaseUser.uid,
              name: userData.name || firebaseUser.displayName || '',
              email: firebaseUser.email || '',
              role: userData.role || 'participant',
              status: userData.status || 'pending',
              courseId: userData.courseId,
              eventId: userData.eventId,
              questionSet: userData.questionSet,
            });
            setLoading(false);
          } else {
            setTimeout(() => {
              setLoading(false);
            }, 2000);
          }
        }, (error) => {
          console.error("Error listening to user document", error);
          setLoading(false);
        });
        
      } else {
        // If Firebase attempts auto-login from IndexedDB without explicit session login
        if (firebaseUser && !isExplicitSession) {
          try {
            await signOut(auth);
          } catch (e) {
            console.error("Error clearing auto-restored auth:", e);
          }
        }
        if (unsubscribeDoc) {
          unsubscribeDoc();
          unsubscribeDoc = null;
        }
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, [setUser, setLoading]);
};
