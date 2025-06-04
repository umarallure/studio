
"use client";

import { useState, useEffect, useCallback } from 'react';
import BracketDisplay from '@/components/bracket/BracketDisplay';
import { 
  initializeTournamentDataIfNeeded, 
  getTournamentDataListener,
  refreshAndSaveTournamentData 
} from '@/lib/tournament-service';
import type { TournamentData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trophy, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function BracketPage() {
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  // Initialize data and set up listener
  useEffect(() => {
    async function setupTournament() {
      setIsLoading(true);
      await initializeTournamentDataIfNeeded(); // Ensure data exists
      
      const unsubscribe = await getTournamentDataListener((data) => {
        setTournamentData(data);
        setIsLoading(false); // Stop loading once data is received (or null if error)
      });
      
      return () => {
        unsubscribe(); // Cleanup listener on component unmount
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
      // Data will update via the Firestore listener
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
