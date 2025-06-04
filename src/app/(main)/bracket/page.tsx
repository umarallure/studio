
"use client";

import { useState, useEffect } from 'react';
import BracketDisplay from '@/components/bracket/BracketDisplay';
import { getUpdatedTournamentData, type TournamentData } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { RefreshCw, Trophy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function BracketPage() {
  const [tournamentData, setTournamentData] = useState<TournamentData | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setTournamentData(getUpdatedTournamentData());
  }, []);

  const handleRefreshData = () => {
    const newData = getUpdatedTournamentData(); // This will re-evaluate winners
    setTournamentData(newData);
    toast({
      title: "Bracket Updated!",
      description: "Scores and matchups have been refreshed.",
      variant: "default",
      duration: 3000,
    });
  };

  if (!tournamentData) {
    return <div className="text-center py-10">Loading tournament data...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-card rounded-lg shadow">
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">Tournament Bracket</h1>
        <Button onClick={handleRefreshData} variant="outline" className="border-accent text-accent hover:bg-accent/10">
          <RefreshCw className="mr-2 h-4 w-4" />
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
