import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useAuthStore } from '../store/useAuthStore';

export const useAuthListener = () => {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Listen to the user document in Firestore to get role and status in real-time
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
            // Document doesn't exist yet (e.g., during registration process)
            // It might exist soon, or the user is deleted. We shouldn't block forever.
            // But we also shouldn't set user to null immediately if they just registered.
            console.warn('User document not found yet. Waiting for creation...');
            
            // If it's a deleted user logging in, we can set them to null so they get denied.
            // We'll set a timeout. If it doesn't appear in 2s, we assume it's deleted.
            setTimeout(() => {
              setLoading(false);
            }, 2000);
          }
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
