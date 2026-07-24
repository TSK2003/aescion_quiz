import { auth, db } from '../config/firebase';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export const seedDefaultAdmin = async () => {
  const adminEmail = "contact.aescion@gmail.com";
  const adminPassword = "Aescion#@2025";

  try {
    // Attempt to create default admin account if it doesn't exist
    const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
    const user = userCredential.user;

    // Create Firestore document for default admin
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        uid: user.uid,
        name: "Super Admin",
        email: adminEmail,
        role: "admin",
        status: "approved",
        createdAt: new Date().toISOString()
      });
    }

    // Immediately sign out so no session remains active
    await signOut(auth);
  } catch (e: any) {
    if (e.code === 'auth/email-already-in-use') {
      // Account exists already; do not log in automatically
    } else {
      console.error("Error seeding default admin:", e);
    }
  }
};
