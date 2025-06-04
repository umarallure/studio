
"use client";

import { useState, useEffect, useCallback } from 'react';
import BracketDisplay from '@/components/bracket/BracketDisplay';
import { mapFirestoreDocToMatchup, mapDocToTournamentSettings } from '@/lib/tournament-config';
import type { TournamentData, Round, Matchup as MatchupType, TournamentSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trophy, Loader2, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, getDocs, doc } from 'firebase/firestore';
import { tournamentPrize } from '@/lib/mock-data'; // Static prize for now

const ROUND_NAMES_BASE: { [key: string]: string } = {
  "1": "Round 1",
  "2": "Round 2",
  "3": "Round 3",
  "4": "Round 4",
  "5": "Round 5", // For up to 32 teams if needed
};

// Function to generate round names dynamically
const getRoundNames = (numberOfRounds: number): { [key: string]: string } => {
  const names: { [key: string]: string } = {};
  for (let i = 1; i <= numberOfRounds; i++) {
    if (i === numberOfRounds) names[String(i)] = `Round ${i}: Grand Finals`;
    else if (i === numberOfRounds - 1 && numberOfRounds > 1) names[String(i)] = `Round ${i}: Semi-Finals`;
    else if (i === numberOfRounds - 2 && numberOfRounds > 2) names[String(i)] = `Round ${i}: Quarter-Finals`;
    else names[String(i)] = ROUND_NAMES_BASE[String(i)] || `Round ${i}`;
  }
  return names;
};


export default function BracketPage() {
  const [activeTournament, setActiveTournament] = useState<TournamentSettings | null>(null);
  const [tournamentDisplayData, setTournamentDisplayData] = useState<TournamentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const { toast } = useToast();

  // Effect to fetch the latest tournament settings
  useEffect(() => {
    setIsLoading(true);
    setCriticalError(null);
    const fetchLatestTournament = async () => {
      try {
        const tournamentsRef = collection(db, "tournaments");
        const q = query(tournamentsRef, orderBy("createdAt", "desc"), limit(1));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setCriticalError("No tournaments found. Please create a tournament first.");
          setActiveTournament(null);
        } else {
          const tournamentDoc = querySnapshot.docs[0];
          const settings = mapDocToTournamentSettings(tournamentDoc.data(), tournamentDoc.id);
          setActiveTournament(settings);
        }
      } catch (error) {
        console.error("Error fetching latest tournament:", error);
        setCriticalError("Failed to load tournament settings. Check Firestore permissions and data.");
        setActiveTournament(null);
      } finally {
        // Don't set isLoading to false here yet, bracket data still needs to load
      }
    };
    fetchLatestTournament();
  }, []);


  // Effect to fetch bracket data for the active tournament
  useEffect(() => {
    if (!activeTournament || !activeTournament.id || !activeTournament.numberOfRounds) {
      if (!criticalError && !isLoading) { // Only set this if no other critical error or initial load is pending
         // If activeTournament is null AFTER attempting to fetch it, and no other error, then it means no tournaments exist.
         // This state is handled by the fetchLatestTournament effect setting criticalError.
      }
      if(!activeTournament && !isLoading && !criticalError) {
        // This means fetchLatestTournament finished, found nothing, and set activeTournament to null.
        // The criticalError "No tournaments found" should be displayed.
        // setIsLoading(false); // This might be premature if criticalError was "No tournaments found"
      }
      return;
    }

    setIsLoading(true); // Start loading for bracket data
    setCriticalError(null); // Clear previous errors

    const unsubscribes: (() => void)[] = [];
    let roundsDataCollector: { [roundId: string]: MatchupType[] } = {};
    let listenersAttachedOrFailed = 0;
    const totalListenersExpected = activeTournament.numberOfRounds;
    const currentRoundNames = getRoundNames(activeTournament.numberOfRounds);

    const checkAllListenersProcessed = () => {
      listenersAttachedOrFailed++;
      if (listenersAttachedOrFailed >= totalListenersExpected) {
        setIsLoading(false);
        if (Object.keys(roundsDataCollector).length === 0 && !criticalError) {
          // This implies rounds might not exist or are empty for the active tournament.
        }
      }
    };

    for (let i = 1; i <= activeTournament.numberOfRounds; i++) {
      const roundId = String(i);
      const matchesCollectionRef = collection(db, "tournaments", activeTournament.id, "rounds", roundId, 'matches');
      const qMatches = query(matchesCollectionRef, orderBy('__name__'));

      const unsubscribeRound = onSnapshot(qMatches, (snapshot) => {
        const matchupsForRound: MatchupType[] = [];
        snapshot.forEach((matchDoc) => {
          const matchup = mapFirestoreDocToMatchup(matchDoc.id, roundId, matchDoc.data());
          if (matchup) {
            matchupsForRound.push(matchup);
          }
        });
        
        roundsDataCollector[roundId] = matchupsForRound;

        const newRounds: Round[] = Object.keys(roundsDataCollector)
          .filter(rId => !isNaN(parseInt(rId)))
          .map(rId => ({
            id: rId,
            name: currentRoundNames[rId] || `Round ${rId}`,
            matchups: roundsDataCollector[rId].sort((a,b) => {
                const numA = parseInt(a.id.replace('match', ''), 10);
                const numB = parseInt(b.id.replace('match', ''), 10);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.id.localeCompare(b.id);
            }),
          }))
          .sort((a, b) => parseInt(a.id) - parseInt(b.id));
        
        if (activeTournament) {
            setTournamentDisplayData({ 
                id: activeTournament.id,
                name: activeTournament.name,
                teamCount: activeTournament.teamCount,
                numberOfRounds: activeTournament.numberOfRounds,
                startDate: activeTournament.startDate,
                rounds: newRounds, 
                prize: tournamentPrize 
            });
        }
        checkAllListenersProcessed();
        setCriticalError(null);

      }, (error) => {
        console.error(`Error fetching matchups for tournament ${activeTournament.id}, round ${roundId}:`, error);
        toast({
          title: `Error Loading Round ${roundId}`,
          description: `Could not load data for round ${roundId}. It might be incomplete.`,
          variant: "destructive",
        });
        checkAllListenersProcessed();
        setCriticalError(prev => prev || `Failed to load data for Round ${roundId} of tournament ${activeTournament.name}. Check Firestore access and data structure.`);
      });
      unsubscribes.push(unsubscribeRound);
    }

    const loadingTimeout = setTimeout(() => {
        if (listenersAttachedOrFailed < totalListenersExpected) {
            setIsLoading(false);
            if (!criticalError && Object.keys(roundsDataCollector).length === 0 && activeTournament) {
                setCriticalError(`Loading tournament data for "${activeTournament.name}" timed out. Ensure match documents under "tournaments/${activeTournament.id}/rounds/[roundNum]/matches/" are populated.`);
                toast({
                    title: "Loading Timeout",
                    description: "Could not retrieve bracket data in time. Display may be incomplete. Check Firestore.",
                    variant: "warning",
                });
            } else if (!criticalError && activeTournament) {
                toast({
                    title: "Partial Data Loaded",
                    description: `Not all rounds for "${activeTournament.name}" responded in time. Display may be incomplete.`,
                    variant: "warning",
                });
            }
        }
    }, 15000); // 15 seconds timeout for bracket data

    return () => {
      unsubscribes.forEach(unsub => unsub());
      clearTimeout(loadingTimeout);
    };
  }, [activeTournament, toast, criticalError, isLoading]); // Added isLoading to dependencies of second useEffect

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
        {activeTournament && <p className="text-sm text-muted-foreground">Fetching data for: {activeTournament.name}</p>}
      </div>
    );
  }
  
  if (criticalError && (!tournamentDisplayData || tournamentDisplayData.rounds.length === 0 || tournamentDisplayData.rounds.every(r => r.matchups.length === 0))) {
     return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h2 className="text-3xl font-headline text-destructive mt-4">Error Loading Bracket</h2>
        <p className="text-muted-foreground max-w-lg">{criticalError}</p>
        <p className="text-sm text-muted-foreground mt-2">
          Please ensure your tournament setup is correct and data is being populated in Firestore.
          {activeTournament?.id && <>Matchup documents are expected at:
          <br /> <code className="text-xs bg-muted p-1 rounded inline-block my-1">tournaments/{activeTournament.id}/rounds/[roundNum]/matches/[matchId]</code>.</>}
          <br />Also, check your internet connection and Firestore security rules.
          <br />You can try creating a new tournament if none exist.
        </p>
        <Button onClick={() => window.location.reload()} variant="destructive" className="mt-6">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Reloading Page
        </Button>
      </div>
    );
  }
  
  const noDataExists = !criticalError && (!tournamentDisplayData || tournamentDisplayData.rounds.length === 0 || tournamentDisplayData.rounds.every(r => r.matchups.length === 0));

  if (noDataExists) {
     return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <Info className="h-16 w-16 text-primary" />
        <h2 className="text-3xl font-headline text-primary mt-4">{activeTournament ? `Bracket for "${activeTournament.name}" is Empty` : "Tournament Bracket is Empty"}</h2>
        <p className="text-muted-foreground max-w-lg">
          Matchup documents will appear here automatically in real-time as they are created.
          {activeTournament?.id && <>Ensure data is being written to Firestore at: <code className="text-xs bg-muted p-1 rounded inline-block my-1">tournaments/{activeTournament.id}/rounds/[roundNum]/matches/[matchId]</code>.</>}
          {!activeTournament && "Consider creating a new tournament if none are set up."}
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
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">{tournamentDisplayData?.name || "Tournament Bracket"}</h1>
        <Button onClick={confirmLiveUpdates} variant="ghost" className="text-accent hover:bg-accent/10 hover:text-accent-foreground">
          <CheckCircle className="mr-2 h-5 w-5" />
          Live Updates Active
        </Button>
      </div>

      {tournamentDisplayData?.prize && (
        <Alert className="border-accent bg-accent/5 text-accent-foreground">
            <Trophy className="h-5 w-5 text-accent" />
            <AlertTitle className="font-headline text-accent">{tournamentDisplayData.prize ? "Tournament Prize" : "Prize Information"}</AlertTitle>
            <AlertDescription className="text-accent/90">
            {tournamentDisplayData.prize || "Details about the tournament prize will be shown here."}
            </AlertDescription>
        </Alert>
      )}
      
      {tournamentDisplayData && tournamentDisplayData.rounds.length > 0 && <BracketDisplay tournamentData={tournamentDisplayData} />}
    </div>
  );
}
