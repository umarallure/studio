
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
  const [isLoading, setIsLoading] = useState(true); // Initial loading is true
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const { toast } = useToast();

  // Effect to fetch the latest tournament settings
  useEffect(() => {
    // setIsLoading(true); // Already true from initial state
    setCriticalError(null); // Clear previous critical errors for a fresh fetch attempt
    const fetchLatestTournament = async () => {
      try {
        const tournamentsRef = collection(db, "tournaments");
        const q = query(tournamentsRef, orderBy("createdAt", "desc"), limit(1));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setCriticalError("No tournaments found. Please create a tournament first.");
          setActiveTournament(null);
          setIsLoading(false); // No tournament found, stop loading.
        } else {
          const tournamentDoc = querySnapshot.docs[0];
          const settings = mapDocToTournamentSettings(tournamentDoc.data(), tournamentDoc.id);
          
          if (!settings || !settings.id || typeof settings.numberOfRounds !== 'number' || settings.numberOfRounds < 0) {
            setCriticalError(`Fetched tournament "${settings?.name || 'Unknown'}" has invalid configuration (e.g., missing or invalid number of rounds).`);
            setActiveTournament(null); // Set to null if invalid
            setIsLoading(false); // Invalid settings, stop loading.
          } else {
            setActiveTournament(settings);
            // isLoading will be true and handled by the next effect for bracket data loading
          }
        }
      } catch (error) {
        console.error("Error fetching latest tournament:", error);
        setCriticalError("Failed to load tournament settings. Check Firestore permissions and data.");
        setActiveTournament(null);
        setIsLoading(false); // Error fetching, stop loading.
      }
    };
    fetchLatestTournament();
  }, []); // Runs once on mount to find the active tournament


  // Effect to fetch bracket data for the active tournament
  useEffect(() => {
    // Guard: If no valid active tournament, do nothing. isLoading should have been handled by the first useEffect.
    if (!activeTournament || !activeTournament.id || typeof activeTournament.numberOfRounds !== 'number' || activeTournament.numberOfRounds < 0) {
       // If activeTournament is null or invalid, the first useEffect is responsible for setting isLoading to false.
       // If by some chance isLoading is still true here with an invalid/null activeTournament, ensure it's false.
       if (isLoading && !criticalError) {
           // This state should ideally not be reached if the first effect handles its errors/empty states correctly.
           // As a safeguard, ensure loading stops if we enter here without a valid tournament and no critical error already set.
           // However, if criticalError IS set, we want to display that, not overwrite isLoading.
           // setIsLoading(false);
       }
      return;
    }
    
    // Edge case: Tournament with 0 rounds. Valid but no bracket to display.
    if (activeTournament.numberOfRounds === 0) {
        setTournamentDisplayData({ 
            id: activeTournament.id,
            name: activeTournament.name,
            teamCount: activeTournament.teamCount,
            numberOfRounds: activeTournament.numberOfRounds,
            startDate: activeTournament.startDate,
            rounds: [], 
            prize: tournamentPrize 
        });
        setIsLoading(false); // No rounds to fetch, stop loading.
        return;
    }

    // Start loading bracket data for the valid active tournament
    setIsLoading(true); 
    setCriticalError(null); // Clear previous bracket-specific errors
    setTournamentDisplayData(null); // Clear any old display data

    const unsubscribes: (() => void)[] = [];
    let roundsDataCollector: { [roundId: string]: MatchupType[] } = {};
    let listenersAttachedOrFailed = 0;
    const totalListenersExpected = activeTournament.numberOfRounds;
    const currentRoundNames = getRoundNames(activeTournament.numberOfRounds);

    const checkAllListenersProcessed = () => {
      listenersAttachedOrFailed++;
      if (listenersAttachedOrFailed >= totalListenersExpected) {
        setIsLoading(false); // All listeners attached or failed for this tournament, stop loading.
        if (Object.keys(roundsDataCollector).length === 0 && !criticalError && totalListenersExpected > 0) {
          // This implies rounds might not exist or are empty for the active tournament.
          // No critical error, but data might be missing. This state is handled by the "noDataExists" check later.
        }
      }
    };

    for (let i = 1; i <= totalListenersExpected; i++) {
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
        
        if (activeTournament) { // Check activeTournament again in case it became null during async ops (unlikely here)
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
        // Don't set criticalError to null here unconditionally, an error might have occurred for another round
        // setCriticalError(null); // Removed: Handled at start of effect
        checkAllListenersProcessed();

      }, (error) => {
        console.error(`Error fetching matchups for tournament ${activeTournament.id}, round ${roundId}:`, error);
        toast({
          title: `Error Loading Round ${roundId}`,
          description: `Could not load data for round ${roundId}. It might be incomplete.`,
          variant: "destructive",
        });
        setCriticalError(prev => prev || `Failed to load data for Round ${roundId} of tournament ${activeTournament.name}. Check Firestore access and data structure.`);
        checkAllListenersProcessed(); // Also call this on error to count towards completion
      });
      unsubscribes.push(unsubscribeRound);
    }

    const loadingTimeout = setTimeout(() => {
        if (isLoading) { // Only if still loading after timeout (i.e., listeners didn't complete/error out)
            setIsLoading(false); // Force stop loading
            if (!criticalError && Object.keys(roundsDataCollector).length === 0 && activeTournament) {
                // Timeout occurred, no data collected, and no other critical error reported yet
                setCriticalError(`Loading tournament data for "${activeTournament.name}" timed out. Ensure match documents under "tournaments/${activeTournament.id}/rounds/[roundNum]/matches/" are populated.`);
                toast({
                    title: "Loading Timeout",
                    description: "Could not retrieve bracket data in time. Display may be incomplete. Check Firestore.",
                    variant: "warning",
                });
            } else if (!criticalError && activeTournament) {
                // Timeout, but some data might have been collected or other non-critical issues.
                toast({
                    title: "Partial Data Loaded or Timeout",
                    description: `Not all rounds for "${activeTournament.name}" responded in time, or loading took too long. Display may be incomplete.`,
                    variant: "warning",
                });
            }
        }
    }, 15000); // 15 seconds timeout for bracket data

    return () => {
      unsubscribes.forEach(unsub => unsub());
      clearTimeout(loadingTimeout);
    };
  }, [activeTournament, toast]); // Dependencies are activeTournament (to trigger fetch) and toast (for error reporting)

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
        {!activeTournament && <p className="text-sm text-muted-foreground">Finding latest tournament...</p>}
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
          <br />You can try creating a new tournament if none exist or reloading.
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
          {!activeTournament && "No active tournament found. Consider creating a new tournament if none are set up."}
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

