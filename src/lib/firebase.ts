
import { initializeApp, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// IMPORTANT: Replace these with your actual Firebase project configuration!
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyB15zKTSp2TBGSGT3lx2sVxXMlyJ3frohw",
  authDomain: "bpogames.firebaseapp.com",
  projectId: "bpogames",
  storageBucket: "bpogames.appspot.com", // Corrected from firebasestorage.app to .appspot.com as per standard
  messagingSenderId: "89419077156",
  appId: "1:89419077156:web:95067fe1ecdeabaf296ab1",
  measurementId: "G-1BKYXTJ8X6"
};

// Initialize Firebase
let app;
try {
  // Ensures that we don't initialize the app more than once
  app = getApp("default");
} catch (e) {
  app = initializeApp(firebaseConfig, "default");
}

export const firebaseApp = app;
export const auth = getAuth(app);
export const db = getFirestore(app);

