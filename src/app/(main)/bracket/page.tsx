
"use client";

import { useState, useEffect } from 'react';
import BracketDisplay from '@/components/bracket/BracketDisplay';
import { 
  initializeTournamentDataIfNeeded, 
  refreshAndSaveTournamentData,
  TOURNAMENT_DOC_PATH, // Import constant
  mapDocToTournamentData // Import helper
} from '@/lib/tournament-service';
import type { TournamentData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trophy, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { db } from '@/lib/firebase'; // Import db
import { doc, onSnapshot } from 'firebase/firestore'; // Import onSnapshot and doc

export default function BracketPage() {
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function setupTournament() {
      setIsLoading(true);
      await initializeTournamentDataIfNeeded(); 
      
      const tournamentDocRef = doc(db, TOURNAMENT_DOC_PATH);
      const unsubscribe = onSnapshot(tournamentDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setTournamentData(mapDocToTournamentData(docSnap.data()));
        } else {
          console.warn("Tournament document does not exist.");
          setTournamentData(null); 
        }
        setIsLoading(false);
      }, (error) => {
        console.error("Error listening to tournament data:", error);
        setTournamentData(null);
        setIsLoading(false);
      });
      
      return () => {
        unsubscribe(); 
      };
    }
    setupTournament();
  }, []);

  const handleRefreshData = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshAndSaveTournamentData();
      toast({
        title: "Bracket Update Requested!",
        description: "Scores and matchups are being refreshed from the server.",
        variant: "default",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error refreshing bracket:", error);
      toast({
        title: "Refresh Failed",
        description: "Could not update the bracket. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-foreground">Loading tournament data...</p>
      </div>
    );
  }
  
  if (!tournamentData) {
     return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4">
        <p className="text-lg text-destructive">Could not load tournament data.</p>
        <p className="text-sm text-muted-foreground">Please ensure you have configured Firebase correctly and data exists in Firestore.</p>
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
          Refresh Bracket
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
