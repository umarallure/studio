
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, type DocumentData, getDocs, limit } from 'firebase/firestore';
import type { SheetRow, TournamentSettings } from '@/lib/types'; // Added TournamentSettings
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle, FileText, Info, RefreshCcw } from 'lucide-react'; // Added RefreshCcw
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button'; // Added Button
import { useToast } from '@/hooks/use-toast'; // Added useToast
import { syncSheetScoresToDailyResults } from '@/lib/tournament-service'; // Import the new server action
import { mapDocToTournamentSettings, mapDocToSheetRow } from '@/lib/tournament-config'; // To get active tournament and map sheet rows
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Added Alert imports

const SHEET_DATA_COLLECTION_PATH = "Sheet1Rows";

export default function SheetDataPage() {
  const [sheetData, setSheetData] = useState<SheetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTournament, setActiveTournament] = useState<TournamentSettings | null>(null);
  const { toast } = useToast();

  // Effect to fetch the latest tournament (needed for the sync action)
  useEffect(() => {
    const fetchLatestTournament = async () => {
      try {
        const tournamentsRef = collection(db, "tournaments");
        const q = query(tournamentsRef, orderBy("createdAt", "desc"), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const tournamentDoc = querySnapshot.docs[0];
          const settings = mapDocToTournamentSettings(tournamentDoc.data(), tournamentDoc.id);
          setActiveTournament(settings);
        } else {
          setActiveTournament(null);
          setError(prev => prev || "No active tournament found. Sync functionality will be disabled until a tournament is created.");
        }
      } catch (err) {
        console.error("Error fetching latest tournament for sync:", err);
        setError(prev => prev || "Could not fetch active tournament details. Sync may not work as expected.");
        setActiveTournament(null);
      }
    };
    fetchLatestTournament();
  }, []);

  useEffect(() => {
    setIsLoading(true);
    // setError(null); // Keep previous errors if any, e.g. from tournament fetch

    const dataCollectionRef = collection(db, SHEET_DATA_COLLECTION_PATH);
    const q = query(dataCollectionRef, orderBy('__name__')); 

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: SheetRow[] = [];
      snapshot.forEach((doc) => {
        const row = mapDocToSheetRow(doc.id, doc.data());
        if (row) {
          data.push(row);
        }
      });
      setSheetData(data);
      setIsLoading(false);
      if (data.length === 0 && !error) { // Only set "no data" if no other error exists
        // setError("No data found in Sheet1Rows collection. Sync button may be disabled or have no effect.");
      } else {
        // setError(null); // Clear "no data" message if data arrives or other errors take precedence
      }
    }, (err) => {
      console.error("Error fetching sheet data:", err);
      setError(`Failed to load sheet data. Please check Firestore permissions for '${SHEET_DATA_COLLECTION_PATH}' and ensure the collection exists.`);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [error]); // Re-run if error state changes to potentially clear "no data" message

  const handleSyncScores = async () => {
    if (!activeTournament || !activeTournament.id) {
      toast({
        title: "No Active Tournament",
        description: "Cannot sync scores because no active tournament was found. Please create one first.",
        variant: "destructive",
      });
      return;
    }
    setIsSyncing(true);
    toast({
      title: "Syncing Scores...",
      description: `Processing Sheet1Rows data against tournament: ${activeTournament.name}. This will update daily scores, determine daily winners/losers, update overall match wins, and series winners. This may take a moment.`,
    });
    const result = await syncSheetScoresToDailyResults(activeTournament.id);
    if (result.success) {
      toast({
        title: "Sync Successful!",
        description: result.message, // The server message should be comprehensive
        variant: "default",
        className: "bg-green-100 border-green-500 text-green-700 dark:bg-green-800 dark:text-green-200 dark:border-green-600",
        duration: 15000, // Longer duration for details
      });
      console.log("Sync details:", result.details?.join("\\n"));
    } else {
      toast({
        title: "Sync Failed",
        description: result.message,
        variant: "destructive",
        duration: 15000,
      });
      console.error("Sync failed details:", result.details?.join("\\n"));
    }
    setIsSyncing(false);
  };

  if (isLoading && !activeTournament && sheetData.length === 0) { // More specific initial loading
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-foreground font-headline">Loading Tournament and Sheet Data...</p>
      </div>
    );
  }

  if (error && sheetData.length === 0) { // Show critical error if data also fails to load
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h2 className="text-3xl font-headline text-destructive mt-4">Error Loading Data</h2>
        <p className="text-muted-foreground max-w-lg">{error}</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-card rounded-lg shadow">
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary flex items-center">
          <FileText className="mr-3 h-8 w-8" /> Sheet Data Entries
        </h1>
        <Button 
            onClick={handleSyncScores} 
            disabled={isSyncing || !activeTournament || sheetData.length === 0}
            title={!activeTournament ? "Sync disabled: No active tournament found." : sheetData.length === 0 ? "Sync disabled: No sheet data to process." : isSyncing ? "Sync in progress..." : `Sync scores to ${activeTournament?.name}`}
        >
          {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          Sync Scores ({activeTournament ? activeTournament.name : "No Active Tournament"})
        </Button>
      </div>

       {(!activeTournament && !isLoading) && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Active Tournament Found</AlertTitle>
          <AlertDescription>
            The "Sync Scores" button is disabled because no active tournament could be found. Please create a tournament first for sync functionality.
          </AlertDescription>
        </Alert>
      )}
      {sheetData.length === 0 && !isLoading && !error && ( // Only show this if no other error and not loading
         <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-300px)] bg-card rounded-lg shadow-inner">
          <Info className="h-16 w-16 text-primary" />
          <h2 className="text-3xl font-headline text-primary mt-4">No Data Found in Sheet1Rows</h2>
          <p className="text-muted-foreground max-w-lg">
            No entries found in the '{SHEET_DATA_COLLECTION_PATH}' collection in Firestore.
            <br/>Data will appear here in real-time as it's added. The "Sync Scores" button will be enabled once data and an active tournament are available.
          </p>
        </div>
      )}
      {error && sheetData.length > 0 && ( // Non-critical error (e.g. tournament fetch failed but sheet data loaded)
        <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Note</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}


      {sheetData.length > 0 && (
        <Card>
          <CardHeader>
              <CardTitle>Entries from Google Sheet</CardTitle>
          </CardHeader>
          <CardContent>
              <Table>
              <TableCaption>A list of entries from your Google Sheet, updated in real-time. Use the button above to sync these as scores to the active tournament's daily results, which will also update daily winners/losers and overall match outcomes.</TableCaption>
              <TableHeader>
                  <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Lead Vender (Team)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Insured Name</TableHead>
                  <TableHead>Product Type</TableHead>
                  <TableHead>From Callback?</TableHead>
                  <TableHead className="max-w-[200px] truncate">Notes</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                  {sheetData.map((row) => (
                  <TableRow key={row.id}>
                      <TableCell>{row.Agent || 'N/A'}</TableCell>
                      <TableCell>{row.Date || 'N/A'}</TableCell>
                      <TableCell className="font-medium">{row.LeadVender || 'N/A'}</TableCell>
                      <TableCell>{row.Status || 'N/A'}</TableCell>
                      <TableCell>{row.INSURED_NAME || 'N/A'}</TableCell>
                      <TableCell>{row.ProductType || 'N/A'}</TableCell>
                      <TableCell>{row.FromCallback === undefined ? 'N/A' : row.FromCallback ? 'Yes' : 'No'}</TableCell>
                      <TableCell className="max-w-[200px] truncate hover:whitespace-normal hover:overflow-visible" title={row.Notes || undefined}>{row.Notes || 'N/A'}</TableCell>
                  </TableRow>
                  ))}
              </TableBody>
              </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
