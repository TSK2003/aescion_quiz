import { auth, db } from '../config/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export const seedDefaultAdmin = async () => {
  const adminEmail = "contact.aescion@gmail.com";
  const adminPassword = "Aescion#@2025";

  try {
    let user;
    try {
      const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      user = userCredential.user;
    } catch (signInErr: any) {
      if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
        try {
          const createCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
          user = createCredential.user;
        } catch (createErr: any) {
          console.error("Error creating admin account:", createErr);
        }
      }
    }

    if (user) {
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
        console.log("Super Admin Firestore document created successfully.");
      }
    }
  } catch (e: any) {
    console.error("Error seeding default admin:", e);
  }
};
