
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Gamepad2, LogOut, LayoutDashboard, Trophy, FileText, PlusSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const pathname = usePathname();

  const navItemsBase = [
    { href: '/bracket', label: 'Bracket', icon: Trophy, adminOnly: false },
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
    { href: '/sheet-data', label: 'Sheet Data', icon: FileText, adminOnly: false }, // Page itself is not admin only, but sync button is
  ];

  const adminNavItems = [
    { href: '/create-tournament', label: 'New Tournament', icon: PlusSquare, adminOnly: true },
  ];

  const getVisibleNavItems = () => {
    let items = [...navItemsBase];
    if (user?.role === 'admin') {
      items = items.concat(adminNavItems);
    }
    return items.filter(item => !item.adminOnly || (item.adminOnly && user?.role === 'admin'));
  };

  const visibleNavItems = getVisibleNavItems();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-md">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 md:px-8">
        <Link href="/bracket" className="flex items-center space-x-2">
          <Gamepad2 className="h-8 w-8 text-primary" />
          <span className="font-headline text-2xl font-bold text-primary">BPO Games</span>
        </Link>
        
        <nav className="hidden md:flex items-center space-x-2 lg:space-x-4">
          {isAuthenticated && visibleNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary px-3 py-2 rounded-md",
                pathname === item.href ? "bg-primary/10 text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="inline-block h-4 w-4 mr-1.5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center space-x-4">
          {isAuthenticated && user && (
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Welcome, <span className="font-medium text-foreground">{user.username}</span>
              {user.role === 'admin' && <span className="text-xs text-primary"> (Admin)</span>}
              {user.role === 'teamMember' && user.teamNameForFilter && <span className="text-xs text-primary"> ({user.teamNameForFilter})</span>}
            </span>
          )}
          {isAuthenticated && (
            <Button variant="outline" size="sm" onClick={logout} className="border-primary text-primary hover:bg-primary/10">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          )}
        </div>
      </div>
       {/* Mobile Navigation */}
       {isAuthenticated && (
        <div className="md:hidden flex justify-around p-2 border-t border-border/40 bg-background/95">
          {visibleNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center text-xs font-medium transition-colors hover:text-primary p-1 rounded-md",
                pathname === item.href ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5 mb-0.5" />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
