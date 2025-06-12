
"use client";

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn } from 'lucide-react';
import { FirebaseError } from 'firebase/app'; // For specific error handling
import type { AppUser } from '@/lib/types';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuth();
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError("Please enter username and password.");
      return;
    }

    // Construct email using the new @bpogames.com domain
    const emailForFirebase = `${username.toLowerCase()}@bpogames.com`;
    let role: AppUser['role'] = 'teamMember';
    let teamNameForFilter: AppUser['teamNameForFilter'] = null;

    const lowerUsername = username.toLowerCase();
    if (lowerUsername === 'admin') {
      role = 'admin';
      teamNameForFilter = null;
    } else if (lowerUsername.startsWith('team') && lowerUsername.endsWith('user')) {
        const teamNumberMatch = lowerUsername.match(/^team(\d+)user$/);
        if (teamNumberMatch && teamNumberMatch[1]) {
            const teamNumber = teamNumberMatch[1];
            teamNameForFilter = `Team ${teamNumber}`; // e.g., "Team 1", "Team 16"
            role = 'teamMember';
        } else {
            setError('Invalid team user format. Expected "teamXuser" e.g. "team1user".');
            return;
        }
    } else {
      setError(`Unknown username pattern: ${username}. Please use 'admin' or 'teamXuser'.`);
      return;
    }

    try {
      await login(emailForFirebase, password, username, role, teamNameForFilter);
      // Navigation is handled by AuthContext or AuthCheck
    } catch (err) {
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential': // This covers wrong email/password too
            setError('Invalid username or password.');
            break;
          case 'auth/invalid-email':
            setError('Invalid email format derived from username. Ensure username is correct.');
            break;
          default:
            setError('Login failed. Please try again.');
            console.error('Firebase login error:', err);
        }
      } else {
        setError('An unexpected error occurred.');
        console.error('Login error:', err);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g., admin, team1user"
          required
          className="bg-input"
          disabled={isLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          className="bg-input"
          disabled={isLoading}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
        {isLoading ? (
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <LogIn className="mr-2 h-4 w-4" />
        )}
        Sign In
      </Button>
       <p className="text-xs text-muted-foreground text-center">
        Usernames: admin, team1user, team2user... team16user
      </p>
    </form>
  );
}
