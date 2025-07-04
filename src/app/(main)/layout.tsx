import type { ReactNode } from 'react';
import AuthCheck from '@/components/shared/AuthCheck';
import Header from '@/components/shared/Header';
import '@/app/styles/bracket.css'; // Import bracket-specific styles here

export default function MainAppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthCheck>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main>
          {children}
        </main>
        <footer className="py-6 text-center text-sm text-muted-foreground border-t">
          © {new Date().getFullYear()} BPO Games. All rights reserved.
        </footer>
      </div>
    </AuthCheck>
  );
}
