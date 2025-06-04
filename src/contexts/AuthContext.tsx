
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  username: string;
  centerId?: string; // Optional: for center-specific data
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  login: (username: string, centerId?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const checkAuthStatus = useCallback(() => {
    setIsLoading(true);
    try {
      const storedUser = localStorage.getItem('bracketBlitzUser');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      setUser(null);
      localStorage.removeItem('bracketBlitzUser');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
    // Listen for storage changes to sync across tabs
    window.addEventListener('storage', checkAuthStatus);
    return () => {
      window.removeEventListener('storage', checkAuthStatus);
    };
  }, [checkAuthStatus]);

  const login = (username: string, centerId?: string) => {
    const userData = { username, centerId };
    localStorage.setItem('bracketBlitzUser', JSON.stringify(userData));
    setUser(userData);
    router.push('/bracket');
  };

  const logout = () => {
    localStorage.removeItem('bracketBlitzUser');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
