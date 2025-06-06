
"use client";
import type { TournamentData, Round as RoundType, Matchup as MatchupType } from '@/lib/types';
import RoundColumn from './RoundColumn';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface BracketDisplayProps {
  tournamentData: TournamentData;
  onMatchupClick?: (matchup: MatchupType) => void;
}

export default function BracketDisplay({ tournamentData, onMatchupClick }: BracketDisplayProps) {
  if (!tournamentData || !tournamentData.rounds) {
    return <p>No tournament data available.</p>;
  }

  return (
    <div className="bg-card p-4 sm:p-6 rounded-lg shadow-lg">
      <ScrollArea className="w-full whitespace-nowrap rounded-md pb-4">
        <div className="flex space-x-4 sm:space-x-6 min-w-max">
          {tournamentData.rounds.map((round: RoundType, index: number) => (
            <RoundColumn 
              key={round.id} 
              round={round} 
              isLastRound={index === tournamentData.rounds.length - 1}
              onMatchupClick={onMatchupClick}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
