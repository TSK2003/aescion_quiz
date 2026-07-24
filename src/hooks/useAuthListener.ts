import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useAuthStore } from '../store/useAuthStore';

export const useAuthListener = () => {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
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
          } else {
            // Fallback for user record creation delay
            setUser({
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'User',
              email: firebaseUser.email || '',
              role: firebaseUser.email === 'contact.aescion@gmail.com' ? 'admin' : 'participant',
              status: 'approved',
            });
          }
          setLoading(false);
        }, (error) => {
          console.error("Error listening to user document", error);
          setLoading(false);
        });
        
      } else {
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
