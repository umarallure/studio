
"use client";
import type { Team } from '@/lib/types';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface TeamDisplayProps {
  team: Team | null;
  isWinner?: boolean;
}

export default function TeamDisplay({ team, isWinner = false }: TeamDisplayProps) {
  if (!team) {
    return (
      <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 min-h-[48px]">
        <span className="text-sm text-muted-foreground italic">TBD</span>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "flex items-center justify-between p-2 rounded-md transition-colors",
        isWinner ? "bg-accent/20 border border-accent" : "bg-secondary/50",
      )}
    >
      <div className="flex items-center space-x-2">
        {team.logo && <Image src={team.logo} alt={`${team.name} logo`} data-ai-hint="logo team" width={24} height={24} className="rounded-full" />}
        <span className={cn("text-sm font-medium", isWinner ? "text-accent-foreground font-bold" : "text-foreground")}>{team.name}</span>
      </div>
      <Badge variant={isWinner ? "default" : "secondary"} className={cn(isWinner ? "bg-accent text-accent-foreground" : "")}>
        {team.score} PTS
      </Badge>
    </div>
  );
}
