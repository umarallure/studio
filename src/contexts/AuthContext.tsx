
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase'; // Import Firebase auth instance
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User as FirebaseUser } from 'firebase/auth';
import type { AppUser } from '@/lib/types'; // Import the AppUser type

const USER_DETAILS_LOCAL_STORAGE_KEY = 'bracketBlitzUserDetails';

interface AuthContextType {
  isAuthenticated: boolean;
  user: AppUser | null;
  isLoading: boolean;
  login: (
    emailForFirebase: string,
    passwordForFirebase: string,
    originalUsername: string,
    role: AppUser['role'],
    teamNameForFilter: AppUser['teamNameForFilter']
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const storedUserDetails = localStorage.getItem(USER_DETAILS_LOCAL_STORAGE_KEY);
        let appUserDetails: Partial<AppUser> = {};

        if (storedUserDetails) {
          try {
            const parsedDetails = JSON.parse(storedUserDetails);
            if (parsedDetails.uid === firebaseUser.uid) { // Ensure details belong to current Firebase user
              appUserDetails = parsedDetails;
            } else {
              // Mismatch, clear stale data
              localStorage.removeItem(USER_DETAILS_LOCAL_STORAGE_KEY);
            }
          } catch (e) {
            console.error("Error parsing user details from localStorage", e);
            localStorage.removeItem(USER_DETAILS_LOCAL_STORAGE_KEY);
          }
        }
        
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          username: appUserDetails.username || firebaseUser.email?.split('@')[0] || 'User',
          role: appUserDetails.role || null,
          teamNameForFilter: appUserDetails.teamNameForFilter || null,
        });
      } else {
        setUser(null);
        localStorage.removeItem(USER_DETAILS_LOCAL_STORAGE_KEY);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (
    emailForFirebase: string,
    passwordForFirebase: string,
    originalUsername: string,
    role: AppUser['role'],
    teamNameForFilter: AppUser['teamNameForFilter']
  ) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailForFirebase, passwordForFirebase);
      
      const userDetailsToStore: AppUser = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        username: originalUsername,
        role,
        teamNameForFilter,
      };
      localStorage.setItem(USER_DETAILS_LOCAL_STORAGE_KEY, JSON.stringify(userDetailsToStore));

      setUser(userDetailsToStore); // Set user state immediately
      router.push('/bracket'); // Or dashboard, depending on role/preference
    } catch (error) {
      setIsLoading(false);
      localStorage.removeItem(USER_DETAILS_LOCAL_STORAGE_KEY); // Clear on failed login too
      throw error;
    }
    // setIsLoading(false); // isLoading is set by onAuthStateChanged or by direct setUser
  };

  const logout = async () => {
    setIsLoading(true);
    await signOut(auth);
    localStorage.removeItem(USER_DETAILS_LOCAL_STORAGE_KEY);
    setUser(null); // onAuthStateChanged will also do this, but good for immediate UI update
    setIsLoading(false);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
