"use client";

import { useContext } from 'react';
import AuthContext from '@/contexts/AuthContext';
import type { AppUser } from '@/lib/types';

// Define the return type of useAuth explicitly for better type safety
interface UseAuthReturn {
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

export const useAuth = (): UseAuthReturn => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};