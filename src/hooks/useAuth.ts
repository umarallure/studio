
"use client";

import { useContext } from 'react';
import AuthContext from '@/contexts/AuthContext';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  // Add a check for user.displayName being potentially null from Firebase
  // and provide a fallback if needed, though LoginForm now tries to pass originalUsername
  const enhancedUser = context.user 
    ? { ...context.user, username: context.user.displayName || context.user.email?.split('@')[0] || 'User' } 
    : null;

  return { ...context, user: enhancedUser };
};
