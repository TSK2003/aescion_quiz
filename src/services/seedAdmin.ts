import { auth, db } from '../config/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export const seedDefaultAdmin = async () => {
  const adminEmail = "contact.aescion@gmail.com";
  const adminPassword = "Aescion#@2025";

  try {
    let user;
    try {
      // 1. Attempt to sign in to check if auth exists with expected password
      const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      user = userCredential.user;
    } catch (signInErr: any) {
      if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
        try {
          // 2. Create default admin if account does not exist yet
          const createCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
          user = createCredential.user;
        } catch (createErr: any) {
          if (createErr.code === 'auth/email-already-in-use') {
            console.log("Admin email already exists in Firebase Auth.");
          } else {
            console.error("Error creating admin account:", createErr);
          }
        }
      } else {
        console.error("Sign-in check notice:", signInErr);
      }
    }

    // 3. Ensure Firestore user document is created for the admin
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

    // 4. Always sign out so no persistent session is automatically logged in
    await signOut(auth);
  } catch (e: any) {
    console.error("Error seeding default admin:", e);
  }
};
