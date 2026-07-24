import { auth, db } from '../config/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export const seedDefaultAdmin = async () => {
  const adminEmail = "admin_aescion@aescion.com";
  const adminPassword = "AescionAdmin#@123";

  try {
    let user;
    // Check if we can login (exists)
    try {
      const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      user = userCredential.user;
      console.log("Default admin auth exists.");
    } catch (e: any) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        console.log("Creating default admin account...");
        const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
        user = userCredential.user;
      } else {
        throw e;
      }
    }

    // Ensure Firestore document exists
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        console.log("Creating default admin firestore document...");
        await setDoc(userDocRef, {
          uid: user.uid,
          name: "Super Admin",
          email: adminEmail,
          role: "admin",
          status: "approved",
          createdAt: new Date().toISOString()
        });
        console.log("Default admin account created successfully in Firestore.");
      } else {
        console.log("Default admin firestore document already exists.");
      }
    }
  } catch (error) {
    console.error("Error seeding default admin:", error);
  }
};
