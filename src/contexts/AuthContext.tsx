
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase'; // Import Firebase auth instance
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User as FirebaseUser } from 'firebase/auth';

interface User {
  uid: string;
  email: string | null;
  displayName?: string | null; // Added for more user info
  centerId?: string; 
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  login: (emailForFirebase: string, passwordForFirebase: string, originalUsername: string, centerId?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Try to get originalUsername and centerId from localStorage if previously set during login
        // This is a bit of a workaround because FirebaseUser doesn't store this custom app data directly
        const appUserSpecifics = localStorage.getItem('bracketBlitzUserSpecifics');
        let centerId: string | undefined;
        let displayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0];

        if (appUserSpecifics) {
            try {
                const specifics = JSON.parse(appUserSpecifics);
                if (specifics.uid === firebaseUser.uid) { // Ensure specifics belong to current firebase user
                    centerId = specifics.centerId;
                    displayName = specifics.originalUsername || displayName;
                }
            } catch (e) {
                console.error("Error parsing user specifics from localStorage", e);
            }
        }
        
        setUser({ 
          uid: firebaseUser.uid, 
          email: firebaseUser.email,
          displayName: displayName,
          centerId: centerId,
        });
      } else {
        setUser(null);
        localStorage.removeItem('bracketBlitzUserSpecifics');
      }
      setIsLoading(false);
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []);

  const login = async (emailForFirebase: string, passwordForFirebase: string, originalUsername: string, centerId?: string) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailForFirebase, passwordForFirebase);
      // Store app-specific details not part of FirebaseUser directly
      // This will be picked up by onAuthStateChanged or can be used immediately
      const userSpecifics = { uid: userCredential.user.uid, originalUsername, centerId };
      localStorage.setItem('bracketBlitzUserSpecifics', JSON.stringify(userSpecifics));

      // The onAuthStateChanged listener will handle setting the user state
      // We can update user state here too if immediate reflection is needed before onAuthStateChanged fires
       setUser({
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: originalUsername,
          centerId: centerId,
        });
      router.push('/bracket');
    } catch (error) {
      setIsLoading(false);
      throw error; // Re-throw error to be caught by LoginForm
    }
    // setIsLoading(false); // isLoading will be set to false by onAuthStateChanged
  };

  const logout = async () => {
    setIsLoading(true);
    await signOut(auth);
    // onAuthStateChanged will set user to null and isLoading to false
    localStorage.removeItem('bracketBlitzUserSpecifics');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
