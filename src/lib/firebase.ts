
import { initializeApp, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// IMPORTANT: Replace these with your actual Firebase project configuration!
const firebaseConfig: FirebaseOptions = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
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
