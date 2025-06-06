
"use client";
import type { Matchup } from '@/lib/types';
import TeamDisplay from './TeamDisplay';
import { Card, CardContent } from '@/components/ui/card';
import { Swords, CheckCircle2 } from 'lucide-react';

interface MatchupCardProps {
  matchup: Matchup;
  onClick?: (matchup: Matchup) => void;
}

export default function MatchupCard({ matchup, onClick }: MatchupCardProps) {
  const seriesConcluded = !!matchup.seriesWinnerName;
  const isTeam1SeriesWinner = seriesConcluded && matchup.team1Name === matchup.seriesWinnerName;
  const isTeam2SeriesWinner = seriesConcluded && matchup.team2Name === matchup.seriesWinnerName;

  const team1Awaited = !matchup.team1Name || matchup.team1Name.toLowerCase() === "tbd";
  const team2Awaited = !matchup.team2Name || matchup.team2Name.toLowerCase() === "tbd";
  let awaitingText = "";
  if (team1Awaited && team2Awaited) {
    awaitingText = "Awaiting teams";
  } else if (team1Awaited) {
    awaitingText = "Awaiting team 1";
  } else if (team2Awaited) {
    awaitingText = "Awaiting team 2";
  }

  const canOpenDetails = onClick && matchup.team1Name && matchup.team1Name.toLowerCase() !== "tbd" && matchup.team2Name && matchup.team2Name.toLowerCase() !== "tbd";

  return (
    <Card 
      className={`overflow-hidden shadow-md transition-all duration-300 ease-in-out ${seriesConcluded ? 'border-accent' : 'border-border'} ${canOpenDetails ? 'cursor-pointer hover:shadow-xl hover:border-primary/50' : ''}`}
      onClick={canOpenDetails ? () => onClick?.(matchup) : undefined}
      title={canOpenDetails ? "Click to see match details" : "Match details available when both teams are set"}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col space-y-2">
          <TeamDisplay 
            teamName={matchup.team1Name} 
            dailyWinsInMatchup={matchup.team1DailyWins} 
            isSeriesWinner={isTeam1SeriesWinner}
            logoSeed={matchup.team1Name?.substring(0,1).toUpperCase()}
          />
          
          <div className="flex items-center justify-center my-1 text-muted-foreground">
            <Swords className="h-4 w-4 text-primary/70" />
            <span className="mx-2 text-xs font-semibold">VS</span>
            <span className="text-xs">(First to 3 Daily Wins)</span>
          </div>
          
          <TeamDisplay 
            teamName={matchup.team2Name} 
            dailyWinsInMatchup={matchup.team2DailyWins} 
            isSeriesWinner={isTeam2SeriesWinner}
            logoSeed={matchup.team2Name?.substring(0,1).toUpperCase()}
          />
        </div>
        {seriesConcluded && matchup.seriesWinnerName && (
          <div className="mt-3 pt-2 border-t border-dashed border-accent/50 text-center text-xs font-medium text-accent flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Winner: {matchup.seriesWinnerName}
          </div>
        )}
         {!seriesConcluded && awaitingText && (
          <div className="mt-2 text-center text-xs text-muted-foreground">
            {awaitingText}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
