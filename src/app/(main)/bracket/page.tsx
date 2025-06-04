
"use client";

import { useState, useEffect, useCallback } from 'react';
import BracketDisplay from '@/components/bracket/BracketDisplay';
import { BRACKET_COLLECTION_PATH, mapFirestoreDocToMatchup } from '@/lib/tournament-config';
import type { TournamentData, Round, Matchup as MatchupType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trophy, Loader2, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { tournamentPrize } from '@/lib/mock-data';

const ROUND_NAMES: { [key: string]: string } = {
  "1": "Round 1: Initial Matches",
  "2": "Round 2: Semi-Finals",
  "3": "Round 3: Grand Finals",
  "4": "Round 4: Placeholder", // Should match bracketRounds from Apps Script if used
};
const MAX_ROUNDS_TO_FETCH = 3; // Configure based on expected max rounds (e.g., 8 teams -> 3 rounds)

export default function BracketPage() {
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    setCriticalError(null);
    const unsubscribes: (() => void)[] = [];
    let roundsDataCollector: { [roundId: string]: MatchupType[] } = {};
    
    let listenersAttachedOrFailed = 0;
    const totalListenersExpected = MAX_ROUNDS_TO_FETCH;

    const checkAllListenersProcessed = () => {
      listenersAttachedOrFailed++;
      if (listenersAttachedOrFailed >= totalListenersExpected) {
        setIsLoading(false);
        if (Object.keys(roundsDataCollector).length === 0 && !criticalError) {
          // If no data was collected from any successful listener and no critical error set yet
          // This implies rounds might not exist or are empty.
        }
      }
    };

    for (let i = 1; i <= MAX_ROUNDS_TO_FETCH; i++) {
      const roundId = String(i);
      const matchesCollectionRef = collection(db, BRACKET_COLLECTION_PATH, roundId, 'matches');
      const q = query(matchesCollectionRef, orderBy('__name__'));

      const unsubscribeRound = onSnapshot(q, (snapshot) => {
        const matchupsForRound: MatchupType[] = [];
        snapshot.forEach((matchDoc) => {
          const matchup = mapFirestoreDocToMatchup(matchDoc.id, roundId, matchDoc.data());
          if (matchup) {
            matchupsForRound.push(matchup);
          }
        });
        
        roundsDataCollector[roundId] = matchupsForRound;

        const newRounds: Round[] = Object.keys(roundsDataCollector)
          .filter(rId => !isNaN(parseInt(rId))) // Ensure we only process numeric round IDs
          .map(rId => ({
            id: rId,
            name: ROUND_NAMES[rId] || `Round ${rId}`,
            matchups: roundsDataCollector[rId].sort((a,b) => {
                const numA = parseInt(a.id.replace('match', ''), 10);
                const numB = parseInt(b.id.replace('match', ''), 10);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.id.localeCompare(b.id);
            }),
          }))
          .sort((a, b) => parseInt(a.id) - parseInt(b.id));

        setTournamentData({ rounds: newRounds, prize: tournamentPrize });
        checkAllListenersProcessed(); // Mark this listener as successfully processed
        setCriticalError(null); // Clear previous critical errors if data starts flowing

      }, (error) => {
        console.error(`Error fetching matchups for round ${roundId}:`, error);
        toast({
          title: `Error Loading Round ${roundId}`,
          description: `Could not load data for round ${roundId}. It might be incomplete.`,
          variant: "destructive",
        });
        checkAllListenersProcessed(); // Mark this listener as failed
        // If multiple rounds fail, criticalError might be set multiple times, last one wins.
        // We could accumulate errors if needed.
        setCriticalError(prev => prev || `Failed to load data for Round ${roundId}. Check Firestore access and data structure.`);
      });
      unsubscribes.push(unsubscribeRound);
    }

    const loadingTimeout = setTimeout(() => {
      if (listenersAttachedOrFailed < totalListenersExpected) {
        setIsLoading(false);
        if (!criticalError && Object.keys(roundsDataCollector).length === 0) {
             setCriticalError("Loading tournament data timed out. Ensure match documents under `bracket/[roundNum]/matches/` are populated in Firestore by your Google Apps Script.");
             toast({
                title: "Loading Timeout",
                description: "Could not retrieve bracket data in time. Display may be incomplete. Check Firestore.",
                variant: "warning",
             });
        } else if (!criticalError) {
            // Some data might have loaded, but not all listeners responded
            toast({
                title: "Partial Data Loaded",
                description: "Not all rounds responded in time. Display may be incomplete.",
                variant: "warning",
             });
        }
      }
    }, 15000); // 15 seconds timeout

    return () => {
      unsubscribes.forEach(unsub => unsub());
      clearTimeout(loadingTimeout);
    };
  }, [toast]);

  const confirmLiveUpdates = () => {
    toast({
      title: "Live Updates Active",
      description: "Bracket data updates in real-time from the server.",
      variant: "default",
      duration: 3000,
      className: "bg-green-100 border-green-500 text-green-700 dark:bg-green-800 dark:text-green-200 dark:border-green-600"
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-foreground font-headline">Loading Tournament Bracket...</p>
      </div>
    );
  }
  
  if (criticalError && (!tournamentData || tournamentData.rounds.length === 0 || tournamentData.rounds.every(r => r.matchups.length === 0))) {
     return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h2 className="text-3xl font-headline text-destructive mt-4">Error Loading Bracket</h2>
        <p className="text-muted-foreground max-w-lg">{criticalError}</p>
        <p className="text-sm text-muted-foreground mt-2">
          Please ensure your Google Apps Script is correctly populating data in Firestore.
          Matchup documents are expected at:
          <br /> <code className="text-xs bg-muted p-1 rounded inline-block my-1">{BRACKET_COLLECTION_PATH}/[roundNum]/matches/[matchId]</code>.
          <br />Also, check your internet connection and Firestore security rules.
        </p>
        <Button onClick={() => window.location.reload()} variant="destructive" className="mt-6">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Reloading Page
        </Button>
      </div>
    );
  }
  
  const noDataExists = !criticalError && (!tournamentData || tournamentData.rounds.length === 0 || tournamentData.rounds.every(r => r.matchups.length === 0));

  if (noDataExists) {
     return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <Info className="h-16 w-16 text-primary" />
        <h2 className="text-3xl font-headline text-primary mt-4">Tournament Bracket is Empty</h2>
        <p className="text-muted-foreground max-w-lg">
          Matchup documents will appear here automatically in real-time as they are created by the Google Apps Script.
          <br/>Ensure data is being written to Firestore at: <code className="text-xs bg-muted p-1 rounded inline-block my-1">{BRACKET_COLLECTION_PATH}/[roundNum]/matches/[matchId]</code>.
        </p>
        <Button onClick={() => window.location.reload()} variant="outline" className="mt-6">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Page
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-card rounded-lg shadow">
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">Tournament Bracket</h1>
        <Button onClick={confirmLiveUpdates} variant="ghost" className="text-accent hover:bg-accent/10 hover:text-accent-foreground">
          <CheckCircle className="mr-2 h-5 w-5" />
          Live Updates Active
        </Button>
      </div>

      {tournamentData?.prize && (
        <Alert className="border-accent bg-accent/5 text-accent-foreground">
            <Trophy className="h-5 w-5 text-accent" />
            <AlertTitle className="font-headline text-accent">{tournamentData.prize ? "Tournament Prize" : "Prize Information"}</AlertTitle>
            <AlertDescription className="text-accent/90">
            {tournamentData.prize || "Details about the tournament prize will be shown here."}
            </AlertDescription>
        </Alert>
      )}
      
      {tournamentData && tournamentData.rounds.length > 0 && <BracketDisplay tournamentData={tournamentData} />}
    </div>
  );
}

