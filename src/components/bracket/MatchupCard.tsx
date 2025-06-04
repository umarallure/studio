
"use client";
import type { Matchup } from '@/lib/types';
import TeamDisplay from './TeamDisplay';
import { Card, CardContent } from '@/components/ui/card';
import { Swords, CheckCircle2 } from 'lucide-react';

interface MatchupCardProps {
  matchup: Matchup;
}

export default function MatchupCard({ matchup }: MatchupCardProps) {
  const winner = matchup.winner 
    ? (matchup.team1?.id === matchup.winner ? matchup.team1 : matchup.team2) 
    : null;

  return (
    <Card className={`overflow-hidden shadow-md transition-all duration-300 ease-in-out hover:shadow-xl ${winner ? 'border-accent' : 'border-border'}`}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col space-y-2">
          <TeamDisplay team={matchup.team1} isWinner={matchup.winner === matchup.team1?.id} />
          
          <div className="flex items-center justify-center my-1 text-muted-foreground">
            <Swords className="h-4 w-4 text-primary/70" />
            <span className="mx-2 text-xs font-semibold">VS</span>
            <span className="text-xs">(Best of 5: {matchup.gamesPlayed} played)</span>
          </div>
          
          <TeamDisplay team={matchup.team2} isWinner={matchup.winner === matchup.team2?.id} />
        </div>
        {winner && (
          <div className="mt-3 pt-2 border-t border-dashed border-accent/50 text-center text-xs font-medium text-accent flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Winner: {winner.name}
          </div>
        )}
         {!winner && (!matchup.team1 || !matchup.team2) && (
          <div className="mt-2 text-center text-xs text-muted-foreground">
            Awaiting team{ !matchup.team1 && !matchup.team2 ? 's' : (!matchup.team1 ? ' 1' : ' 2')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
