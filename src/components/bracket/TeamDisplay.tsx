
"use client";
// Removed direct type import for Team from types.ts as we'll pass props directly
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface TeamDisplayProps {
  teamName: string | null; // Team name from Firestore
  dailyWinsInMatchup?: number; // Daily wins for this team in the current matchup
  isSeriesWinner?: boolean; // True if this team won the series
  logoSeed?: string; // Seed for placeholder logo, typically first letter of teamName
}

export default function TeamDisplay({ teamName, dailyWinsInMatchup = 0, isSeriesWinner = false, logoSeed }: TeamDisplayProps) {
  if (!teamName || teamName.toLowerCase() === "tbd") {
    return (
      <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 min-h-[48px]">
        <span className="text-sm text-muted-foreground italic">TBD</span>
      </div>
    );
  }
  
  const displayLogoSeed = logoSeed || teamName.substring(0,1).toUpperCase();

  return (
    <div 
      className={cn(
        "flex items-center justify-between p-2 rounded-md transition-colors",
        isSeriesWinner ? "bg-accent/20 border border-accent" : "bg-secondary/50",
      )}
    >
      <div className="flex items-center space-x-2">
        <Image 
            src={`https://placehold.co/40x40.png?text=${displayLogoSeed}`} 
            alt={`${teamName} logo`} 
            data-ai-hint="logo team" 
            width={24} height={24} 
            className="rounded-full" 
        />
        <span className={cn("text-sm font-medium", isSeriesWinner ? "text-accent-foreground font-bold" : "text-foreground")}>{teamName}</span>
      </div>
      <Badge variant={isSeriesWinner ? "default" : "secondary"} className={cn(isSeriesWinner ? "bg-accent text-accent-foreground" : "")}>
        {dailyWinsInMatchup} Wins
      </Badge>
    </div>
  );
}
