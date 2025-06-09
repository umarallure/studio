
"use client";

import { useState, useEffect, useCallback } from 'react';
import BracketDisplay from '@/components/bracket/BracketDisplay';
import { mapFirestoreDocToMatchup, mapDocToTournamentSettings } from '@/lib/tournament-config';
import type { TournamentData, Round, Matchup as MatchupType, TournamentSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trophy, Loader2, AlertTriangle, Info, CheckCircle, Award } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, getDocs, doc } from 'firebase/firestore';
import { tournamentPrize } from '@/lib/mock-data'; // Static prize for now
import MatchDetailPanel from '@/components/bracket/MatchDetailPanel'; // Added import

const ROUND_NAMES_BASE: { [key: string]: string } = {
  "1": "Round 1",
  "2": "Round 2",
  "3": "Round 3",
  "4": "Round 4",
  "5": "Round 5",
};

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

  const [isMatchDetailPanelOpen, setIsMatchDetailPanelOpen] = useState(false);
  const [selectedMatchupForPanel, setSelectedMatchupForPanel] = useState<MatchupType | null>(null);

  const handleMatchupCardClick = useCallback((matchup: MatchupType) => {
    console.log("[BracketPage] handleMatchupCardClick triggered for matchup:", matchup.id);
    if (!matchup.team1Name || matchup.team1Name.toLowerCase() === "tbd" || 
        !matchup.team2Name || matchup.team2Name.toLowerCase() === "tbd") {
      toast({
        title: "Matchup Not Ready",
        description: "Detailed stats are available once both teams are determined.",
        variant: "default",
      });
      console.log("[BracketPage] Matchup not ready for details panel (handler check).");
      return;
    }
    setSelectedMatchupForPanel(matchup);
    setIsMatchDetailPanelOpen(true);
    console.log("[BracketPage] Set selectedMatchupForPanel to:", matchup.id, "and isMatchDetailPanelOpen to true.");
  }, [toast]);


  useEffect(() => {
    console.log("[BracketPage Effect 1] Initializing: Fetching latest tournament.");
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
          console.log("[BracketPage Effect 1] No tournaments found.");
        } else {
          const tournamentDoc = querySnapshot.docs[0];
          const settings = mapDocToTournamentSettings(tournamentDoc.data(), tournamentDoc.id);
          
          if (!settings || !settings.id || typeof settings.numberOfRounds !== 'number' || settings.numberOfRounds < 0) {
            setCriticalError(`Fetched tournament "${settings?.name || 'Unknown'}" has invalid configuration.`);
            setActiveTournament(null);
            console.log("[BracketPage Effect 1] Invalid tournament settings for:", settings?.name);
          } else {
            setActiveTournament(settings);
            console.log("[BracketPage Effect 1] Active tournament set:", settings.name, "ID:", settings.id);
          }
        }
      } catch (error) {
        console.error("[BracketPage Effect 1] Error fetching latest tournament:", error);
        setCriticalError("Failed to load tournament settings.");
        setActiveTournament(null);
      } finally {
        // setIsLoading(false) will be handled by the second effect or if activeTournament remains null
      }
    };
    fetchLatestTournament();
  }, []);


  useEffect(() => {
    if (!activeTournament || !activeTournament.id || typeof activeTournament.numberOfRounds !== 'number' || activeTournament.numberOfRounds < 0) {
       if (!criticalError) { 
            console.log("[BracketPage Effect 2] Bailing out: Active tournament is null or invalid. Current isLoading:", isLoading);
            if (isLoading) setIsLoading(false); 
       }
      return;
    }
    
    console.log(`[BracketPage Effect 2] Active tournament found: "${activeTournament.name}". Preparing to load bracket data. Current isLoading: ${isLoading}`);
    if(!isLoading) setIsLoading(true); 
    setCriticalError(null); 
    setTournamentDisplayData(null); 

    if (activeTournament.numberOfRounds === 0) {
        console.log(`[BracketPage Effect 2] Tournament "${activeTournament.name}" has 0 rounds. Setting empty display data.`);
        setTournamentDisplayData({ 
            id: activeTournament.id,
            name: activeTournament.name,
            teamCount: activeTournament.teamCount,
            numberOfRounds: activeTournament.numberOfRounds,
            startDate: activeTournament.startDate,
            overallWinnerName: activeTournament.overallWinnerName,
            status: activeTournament.status,
            rounds: [], 
            prize: tournamentPrize 
        });
        setIsLoading(false); 
        return;
    }

    const unsubscribes: (() => void)[] = [];
    let roundsDataCollector: { [roundId: string]: MatchupType[] } = {};
    let roundsProcessedCount = 0; 
    const totalListenersExpected = activeTournament.numberOfRounds;
    const currentRoundNames = getRoundNames(activeTournament.numberOfRounds);
    const initiallyProcessedRounds = new Set<string>(); 

    console.log(`[BracketPage Effect 2] Expecting ${totalListenersExpected} rounds for "${activeTournament.name}".`);

    const checkAllInitialLoadsComplete = () => {
      roundsProcessedCount++;
      console.log(`[BracketPage Effect 2] Round processed initial data/error (${roundsProcessedCount}/${totalListenersExpected}).`);
      if (roundsProcessedCount >= totalListenersExpected) {
        console.log(`[BracketPage Effect 2] All ${totalListenersExpected} rounds processed their initial data/error. Setting isLoading to false.`);
        setIsLoading(false);
        clearTimeout(loadingTimeout); 
      }
    };

    for (let i = 1; i <= totalListenersExpected; i++) {
      const roundId = String(i);
      const matchesCollectionRef = collection(db, "tournaments", activeTournament.id, "rounds", roundId, 'matches');
      const qMatches = query(matchesCollectionRef, orderBy('__name__'));
      console.log(`[BracketPage Effect 2] Setting up listener for Round ${roundId} in tournament ${activeTournament.id}`);

      const unsubscribeRound = onSnapshot(qMatches, (snapshot) => {
        console.log(`[BracketPage Effect 2] Data received for Round ${roundId}. Processing ${snapshot.docs.length} matches.`);
        const matchupsForRound: MatchupType[] = [];
        snapshot.forEach((matchDoc) => {
          const matchup = mapFirestoreDocToMatchup(matchDoc.id, roundId, matchDoc.data());
          if (matchup) {
            matchupsForRound.push(matchup);
          }
        });
        
        roundsDataCollector[roundId] = matchupsForRound;

        const newRounds: Round[] = Object.keys(roundsDataCollector)
          .filter(rId => /^\d+$/.test(rId)) 
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
                overallWinnerName: activeTournament.overallWinnerName,
                status: activeTournament.status,
                rounds: newRounds, 
                prize: tournamentPrize 
            });
        }
        
        if (!initiallyProcessedRounds.has(roundId)) {
            initiallyProcessedRounds.add(roundId);
            checkAllInitialLoadsComplete();
        }

      }, (error) => {
        console.error(`[BracketPage Effect 2] Error fetching matchups for tournament ${activeTournament.id}, round ${roundId}:`, error);
        toast({
          title: `Error Loading Round ${roundId}`,
          description: `Could not load data for round ${roundId}. It might be incomplete.`,
          variant: "destructive",
        });
        setCriticalError(prev => prev || `Failed to load data for Round ${roundId} of tournament ${activeTournament.name}.`);
        
        if (!initiallyProcessedRounds.has(roundId)) {
             initiallyProcessedRounds.add(roundId);
            checkAllInitialLoadsComplete();
        }
      });
      unsubscribes.push(unsubscribeRound);
    }

    const loadingTimeout = setTimeout(() => {
        if (isLoading) { 
            console.warn(`[BracketPage Effect 2] Loading timeout after 10s for "${activeTournament?.name}". Processed ${roundsProcessedCount}/${totalListenersExpected} rounds.`);
            setIsLoading(false); 
            if (!criticalError && (!tournamentDisplayData || Object.keys(roundsDataCollector).filter(k => /^\d+$/.test(k)).length === 0) && activeTournament) {
                setCriticalError(`Loading tournament data for "${activeTournament.name}" timed out.`);
                toast({
                    title: "Loading Timeout",
                    description: "Could not retrieve bracket data in time. Display may be incomplete.",
                    variant: "warning",
                });
            } else if (!criticalError && activeTournament) {
                 toast({
                    title: "Partial Data or Timeout",
                    description: `Some rounds for "${activeTournament.name}" may not have loaded. Display may be incomplete.`,
                    variant: "warning",
                });
            }
        }
    }, 10000); 

    return () => {
      console.log("[BracketPage Effect 2] Cleanup: Unsubscribing from Firestore listeners and clearing timeout.");
      unsubscribes.forEach(unsub => unsub());
      clearTimeout(loadingTimeout);
    };
  }, [activeTournament, toast]); // isLoading was removed here

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
        </p>
        <Button onClick={() => window.location.reload()} variant="destructive" className="mt-6">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Reloading Page
        </Button>
      </div>
    );
  }
  
  const noDataExists = !criticalError && (!tournamentDisplayData || (tournamentDisplayData.numberOfRounds > 0 && (tournamentDisplayData.rounds.length === 0 || tournamentDisplayData.rounds.every(r => r.matchups.length === 0)) ) );

  if (noDataExists && activeTournament && activeTournament.status !== "Completed") {
     return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <Info className="h-16 w-16 text-primary" />
        <h2 className="text-3xl font-headline text-primary mt-4">{activeTournament ? `Bracket for "${activeTournament.name}" is Empty` : "Tournament Bracket is Empty"}</h2>
        <p className="text-muted-foreground max-w-lg">
          Matchup documents will appear here automatically.
          {activeTournament?.id && <>Ensure data is written to: <code className="text-xs bg-muted p-1 rounded inline-block my-1">tournaments/{activeTournament.id}/rounds/[roundNum]/matches/[matchId]</code>.</>}
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

      {tournamentDisplayData?.status === "Completed" && tournamentDisplayData.overallWinnerName && (
        <Card className="bg-gradient-to-r from-accent/80 to-primary/80 text-primary-foreground shadow-2xl border-accent">
          <CardHeader className="text-center">
            <Award className="h-16 w-16 mx-auto text-amber-300 drop-shadow-lg" />
            <CardTitle className="font-headline text-4xl mt-2">Tournament Winner!</CardTitle>
            <CardDescription className="text-primary-foreground/90 text-lg">Congratulations to</CardDescription>
          </CardHeader>
          <CardContent className="text-center pb-6">
            <p className="font-headline text-5xl font-bold text-white drop-shadow-md">
              {tournamentDisplayData.overallWinnerName}
            </p>
          </CardContent>
        </Card>
      )}

      {tournamentDisplayData?.prize && (
        <Alert className="border-accent bg-accent/5 text-accent-foreground">
            <Trophy className="h-5 w-5 text-accent" />
            <AlertTitle className="font-headline text-accent">{tournamentDisplayData.prize ? "Tournament Prize" : "Prize Information"}</AlertTitle>
            <AlertDescription className="text-accent/90">
            {tournamentDisplayData.prize || "Details about the tournament prize will be shown here."}
            </AlertDescription>
        </Alert>
      )}
      
      {tournamentDisplayData && tournamentDisplayData.rounds.length > 0 && (
        <BracketDisplay 
          tournamentData={tournamentDisplayData} 
          onMatchupClick={handleMatchupCardClick}
        />
      )}

      <MatchDetailPanel 
        isOpen={isMatchDetailPanelOpen} 
        onOpenChange={setIsMatchDetailPanelOpen} 
        matchup={selectedMatchupForPanel}
        tournamentId={activeTournament?.id || null}
      />
    </div>
  );
}

