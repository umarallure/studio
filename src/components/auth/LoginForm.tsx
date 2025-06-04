
"use client";

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn } from 'lucide-react';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    // Mock authentication: any username/password works for now
    // In a real app, you'd validate against a backend.
    if (!username || !password) {
      setError("Please enter username and password.");
      return;
    }
    // Simulate different centers based on username for demo
    let centerId;
    if (username.toLowerCase().includes("center1")) centerId = "center1";
    if (username.toLowerCase().includes("center2")) centerId = "center2";
    
    login(username, centerId); 
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
          placeholder="e.g., Center1User"
          required
          className="bg-input"
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
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
        <LogIn className="mr-2 h-4 w-4" /> Sign In
      </Button>
    </form>
  );
}
