
"use client";

import { useState, useEffect } from 'react';
import BracketDisplay from '@/components/bracket/BracketDisplay';
import { TOURNAMENT_DOC_PATH_UNUSED, BRACKET_COLLECTION_PATH, mapFirestoreDocToMatchup } from '@/lib/tournament-config';
import type { TournamentData, Round, Matchup as MatchupType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trophy, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { db } from '@/lib/firebase';
import { collection, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { tournamentPrize } from '@/lib/mock-data'; // Keep static prize for now

// Define round names, assuming up to 4 rounds as in Apps Script example
const ROUND_NAMES: { [key: string]: string } = {
  "1": "Round 1: Initial Matches", // Or "Quarter-Finals" if always 8 teams
  "2": "Round 2: Semi-Finals",
  "3": "Round 3: Grand Finals",
  "4": "Round 4: Placeholder if used" // Adjust as per actual max rounds
};
const MAX_ROUNDS_TO_FETCH = 3; // Configure how many rounds to fetch (e.g., for an 8-team bracket)

export default function BracketPage() {
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false); // This button might be removed or repurposed
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    const unsubscribes: (() => void)[] = [];
    
    // Store intermediate round data to build the final tournamentData
    let roundsDataCollector: { [roundId: string]: MatchupType[] } = {};

    for (let i = 1; i <= MAX_ROUNDS_TO_FETCH; i++) {
      const roundId = String(i);
      const matchesCollectionRef = collection(db, BRACKET_COLLECTION_PATH, roundId, 'matches');
      // Assuming match IDs are sortable like 'match1', 'match2' or have a numeric part.
      // If not, and order is critical, the Apps Script should ensure consistent ID naming.
      const q = query(matchesCollectionRef, orderBy('__name__')); // Order by document ID string

      const unsubscribeRound = onSnapshot(q, (snapshot) => {
        const matchupsForRound: MatchupType[] = [];
        snapshot.forEach((matchDoc) => {
          const matchup = mapFirestoreDocToMatchup(matchDoc.id, roundId, matchDoc.data());
          if (matchup) {
            matchupsForRound.push(matchup);
          }
        });
        
        // Ensure matchups are sorted if Firestore default ID sort isn't sufficient
        // e.g. if IDs are 'match1', 'match10', 'match2', default sort is lexical.
        // A common pattern is numeric IDs or zero-padded IDs for natural sort.
        // For now, relying on Firestore's default ID sort or assuming IDs sort naturally.


        roundsDataCollector[roundId] = matchupsForRound;

        // Reconstruct TournamentData
        const newRounds: Round[] = Object.keys(roundsDataCollector)
          .map(rId => ({
            id: rId,
            name: ROUND_NAMES[rId] || `Round ${rId}`,
            matchups: roundsDataCollector[rId].sort((a,b) => {
                // Attempt to sort by a numeric part of the ID if 'matchX' format
                const numA = parseInt(a.id.replace('match', ''), 10);
                const numB = parseInt(b.id.replace('match', ''), 10);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.id.localeCompare(b.id); // Fallback to string sort
            }),
          }))
          .sort((a, b) => parseInt(a.id) - parseInt(b.id)); // Sort rounds by ID

        setTournamentData({ rounds: newRounds, prize: tournamentPrize });
        setIsLoading(false);

      }, (error) => {
        console.error(`Error fetching matchups for round ${roundId}:`, error);
        toast({
          title: "Error Loading Bracket",
          description: `Could not load data for round ${roundId}.`,
          variant: "destructive",
        });
        setIsLoading(false); // Stop loading on error for this round
      });
      unsubscribes.push(unsubscribeRound);
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [toast]);

  const handleRefreshData = async () => {
    // This function's original purpose (simulating scores) is now handled by Apps Script.
    // It could be removed, or used to manually trigger a re-fetch if absolutely necessary,
    // but onSnapshot should handle realtime updates.
    if (isRefreshing) return;
    setIsRefreshing(true);
    toast({
      title: "Realtime Updates Active",
      description: "Bracket data updates automatically from the server.",
      variant: "default",
      duration: 3000,
    });
    // Simulating a delay for UX, then resetting
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-foreground">Loading tournament data from Firestore...</p>
      </div>
    );
  }
  
  if (!tournamentData || tournamentData.rounds.length === 0) {
     return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4">
        <p className="text-lg text-destructive">Could not load tournament data or no rounds found.</p>
        <p className="text-sm text-muted-foreground">Please ensure the Apps Script is populating bracket data in Firestore under '{BRACKET_COLLECTION_PATH}/[roundNum]/matches'.</p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Try Reloading
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-card rounded-lg shadow">
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">Tournament Bracket</h1>
        <Button onClick={handleRefreshData} variant="outline" className="border-accent text-accent hover:bg-accent/10" disabled={isRefreshing}>
          {isRefreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Bracket Synced
        </Button>
      </div>

      <Alert className="border-accent bg-accent/5">
        <Trophy className="h-5 w-5 text-accent" />
        <AlertTitle className="font-headline text-accent">Tournament Prize</AlertTitle>
        <AlertDescription>
          {tournamentData.prize}
        </AlertDescription>
      </Alert>
      
      <BracketDisplay tournamentData={tournamentData} />
    </div>
  );
}
