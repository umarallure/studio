
"use client";
import type { Round } from '@/lib/types';
import MatchupCard from './MatchupCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface RoundColumnProps {
  round: Round;
  isLastRound: boolean;
}

export default function RoundColumn({ round, isLastRound }: RoundColumnProps) {
  const columnWidth = isLastRound ? "min-w-[320px] sm:min-w-[380px]" : "min-w-[300px] sm:min-w-[350px]";

  return (
    <div className={`flex flex-col space-y-4 ${columnWidth}`}>
      <CardHeader className="p-0 mb-2">
        <CardTitle className="font-headline text-xl sm:text-2xl text-center text-primary py-2 px-4 bg-primary/10 rounded-t-md">
          {round.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 space-y-4">
        {round.matchups.length > 0 ? (
          round.matchups.map((matchup) => (
            <MatchupCard key={matchup.id} matchup={matchup} />
          ))
        ) : (
          <Card className="p-4 text-center text-muted-foreground bg-muted/50">
            Matchups to be determined.
          </Card>
        )}
      </CardContent>
    </div>
  );
}
