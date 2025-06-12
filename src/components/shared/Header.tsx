"use client";

import * as React from "react";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Gamepad2, LogOut, LayoutDashboard, Trophy, FileText, PlusSquare, GitBranch, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarPortal,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarGroup,
  MenubarSub,
  MenubarShortcut
} from "@/components/ui/menubar";

// Map legacy team names to real team names
const TEAM_NAME_MAP: Record<string, string> = {
  "Team 1": "Rawlpindi Tiger",
  "Team 2": "Lahore qalanders",
  "Team 3": "Islamabad United",
  "Team 4": "Timberwolfs",
  "Team 5": "Rawlpindi Express",
  "Team 6": "Rawlpindi Gladiators",
  "Team 7": "Peshawar Zalmi",
  "Team 8": "Multan Sultans",
  "Team 9": "Avengers",
  "Team 10": "Hustlers",
  "Team 11": "A-Team",
  "Team 12": "Rawlpindi Bears",
  "Team 13": "Alpha's",
  "Team 14": "Vipers",
  "Team 15": "Karachi Kings",
  "Team 16": "Islamabad Sneak",
};

function getDisplayTeamName(teamName?: string) {
  if (!teamName) return undefined;
  return TEAM_NAME_MAP[teamName] || teamName;
}

export default function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navItemsBase = [
    { href: '/bracket', label: 'Home', icon: Trophy, adminOnly: false },
    { href: '/advanced-bracket', label: 'Standing', icon: GitBranch, adminOnly: false },
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
    { href: '/sheet-data', label: 'Sheet Data', icon: FileText, adminOnly: false },
  ];

  const adminNavItems = [
    { href: '/create-tournament', label: 'New Tournament', icon: PlusSquare, adminOnly: true },
  ];

  const getVisibleNavItems = () => {
    let items = [...navItemsBase];
    if (user?.role === 'admin') {
      items = items.concat(adminNavItems);
    }
    items.sort((a, b) => {
      if (a.href === '/bracket') return -1;
      if (b.href === '/bracket') return 1;
      if (a.href === '/advanced-bracket' && b.href !== '/bracket') return -1;
      if (b.href === '/advanced-bracket' && a.href !== '/bracket') return 1;
      return 0;
    });
    return items.filter(item => !item.adminOnly || (item.adminOnly && user?.role === 'admin'));
  };

  const visibleNavItems = getVisibleNavItems();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#0a7578]/20 bg-white/95 backdrop-blur-md shadow-md">
      <Menubar
        className="container flex h-16 max-w-[2200px] items-center justify-between px-2 sm:px-4 md:px-8 bg-transparent border-none w-full min-w-0"
      >
        <Link href="/bracket" className="flex items-center space-x-2">
          <div className="">
            <img src="/landing/icon.png" alt="icon" className="h-10 w-10 rounded-full" loading="lazy" width={100} height={100}
            />
          </div><span className="font-bold text-2xl">BPO Games</span>
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
          {isAuthenticated && visibleNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center text-sm font-medium px-3 py-2 rounded-lg transition-colors",
                pathname === item.href 
                  ? "bg-gradient-to-r from-[#0a7578]/10 to-[#b17e1e]/10 text-[#0a7578]" 
                  : "text-muted-foreground hover:bg-gradient-to-r hover:from-[#0a7578]/5 hover:to-[#b17e1e]/5 hover:text-[#0a7578]"
              )}
              title={item.label}
            >
              <item.icon className="inline-block h-4 w-4 mr-1.5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center space-x-4">
          {isAuthenticated && user && (
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Welcome, <span className="font-medium text-[#0a7578]">{user.username}</span>
              {user.role === 'admin' && <span className="text-xs text-[#b17e1e] ml-1">(Admin)</span>}
              {user.role === 'teamMember' && user.teamNameForFilter && (
                <span className="text-xs text-[#b17e1e] ml-1">({getDisplayTeamName(user.teamNameForFilter)})</span>
              )}
            </span>
          )}
          
          {isAuthenticated && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={logout} 
              className="border-[#0a7578] text-[#0a7578] hover:bg-[#0a7578]/10 hidden md:flex"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          )}
          
          {/* Mobile Menu Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden" 
            onClick={toggleMobileMenu}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </Menubar>
      
      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && isAuthenticated && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-white/95 backdrop-blur-md border-b border-[#0a7578]/20 shadow-lg p-4 z-50">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#0a7578]/10">
            {user && (
              <span className="text-sm">
                Welcome, <span className="font-medium text-[#0a7578]">{user.username}</span>
                {user.role === 'admin' && <span className="text-xs text-[#b17e1e] ml-1">(Admin)</span>}
                {user.role === 'teamMember' && user.teamNameForFilter && (
                  <span className="text-xs text-[#b17e1e] ml-1">({getDisplayTeamName(user.teamNameForFilter)})</span>
                )}
              </span>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={logout} 
              className="border-[#0a7578] text-[#0a7578] hover:bg-[#0a7578]/10"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
          
          <nav className="flex flex-col space-y-1">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center text-base font-medium px-4 py-3 rounded-lg transition-colors",
                  pathname === item.href 
                    ? "bg-gradient-to-r from-[#0a7578]/10 to-[#b17e1e]/10 text-[#0a7578]" 
                    : "text-muted-foreground hover:bg-gradient-to-r hover:from-[#0a7578]/5 hover:to-[#b17e1e]/5 hover:text-[#0a7578]"
                )}
                title={item.label}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
      
      {/* Bottom Mobile Navigation */}
      {isAuthenticated && (
        <div className="md:hidden flex justify-around p-2 border-t border-[#0a7578]/20 bg-white/95 backdrop-blur-md shadow-inner">
          {visibleNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center text-xs font-medium transition-colors p-1 rounded-md w-[calc(100%_/_" + visibleNavItems.length + ")] text-center",
                pathname === item.href 
                  ? "text-[#0a7578]" 
                  : "text-muted-foreground hover:text-[#0a7578]"
              )}
              title={item.label}
            >
              <item.icon className={cn(
                "h-5 w-5 mb-0.5",
                pathname === item.href 
                  ? "text-[#0a7578]" 
                  : "text-muted-foreground"
              )} />
              <span className="truncate w-full">{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
