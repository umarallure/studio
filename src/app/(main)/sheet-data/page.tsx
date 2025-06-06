
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, type DocumentData, getDocs, limit } from 'firebase/firestore';
import type { SheetRow, TournamentSettings } from '@/lib/types';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle, FileText, Info, RefreshCcw, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { syncSheetScoresToDailyResults } from '@/lib/tournament-service';
import { mapDocToTournamentSettings, mapDocToSheetRow } from '@/lib/tournament-config';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from '@/hooks/useAuth'; // Import useAuth

const SHEET_DATA_COLLECTION_PATH = "Sheet1Rows";

export default function SheetDataPage() {
  const { user, isLoading: isAuthLoading } = useAuth(); // Get user and auth loading state
  const [allSheetData, setAllSheetData] = useState<SheetRow[]>([]); // Holds all data for admin, or filtered for team
  const [displayedSheetData, setDisplayedSheetData] = useState<SheetRow[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
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
          // setError(prev => prev || "No active tournament found. Sync functionality will be disabled until a tournament is created.");
        }
      } catch (err) {
        console.error("Error fetching latest tournament for sync:", err);
        setError(prev => prev || "Could not fetch active tournament details. Sync may not work as expected.");
        setActiveTournament(null);
      }
    };
    if (user?.role === 'admin') { // Only admin needs active tournament for sync button
        fetchLatestTournament();
    }
  }, [user]); // Re-fetch if user changes (e.g. admin logs in)

  // Effect to fetch and filter sheet data
  useEffect(() => {
    if (isAuthLoading) return; // Wait for auth to resolve

    setIsLoadingData(true);
    setError(null);

    const dataCollectionRef = collection(db, SHEET_DATA_COLLECTION_PATH);
    const q = query(dataCollectionRef, orderBy('__name__'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawData: SheetRow[] = [];
      snapshot.forEach((doc) => {
        const row = mapDocToSheetRow(doc.id, doc.data());
        if (row) {
          rawData.push(row);
        }
      });
      setAllSheetData(rawData); // Store all fetched data

      if (user?.role === 'admin') {
        setDisplayedSheetData(rawData);
      } else if (user?.role === 'teamMember' && user.teamNameForFilter) {
        setDisplayedSheetData(rawData.filter(row => row.LeadVender === user.teamNameForFilter));
      } else if (user?.role === 'teamMember' && !user.teamNameForFilter) {
        // Team member with no specific team assigned, show no data or a message
        setDisplayedSheetData([]);
         toast({
            title: "Sheet Data Restricted",
            description: "Your account is not assigned to a specific team to view data. Contact admin.",
            variant: "destructive"
        });
      } else {
        setDisplayedSheetData([]); // Default to empty if no user or role unknown
      }
      setIsLoadingData(false);
    }, (err) => {
      console.error("Error fetching sheet data:", err);
      setError(`Failed to load sheet data. Please check Firestore permissions for '${SHEET_DATA_COLLECTION_PATH}' and ensure the collection exists.`);
      setIsLoadingData(false);
    });

    return () => unsubscribe();
  }, [user, isAuthLoading, toast]);

  const handleSyncScores = async () => {
    if (user?.role !== 'admin') {
      toast({ title: "Access Denied", description: "Only admins can sync scores.", variant: "destructive" });
      return;
    }
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
        description: result.message || "Scores and match outcomes updated.",
        variant: "default",
        className: "bg-green-100 border-green-500 text-green-700 dark:bg-green-800 dark:text-green-200 dark:border-green-600",
        duration: 15000,
      });
      console.log("Sync details:", result.details?.join("\\n"));
    } else {
      toast({
        title: "Sync Failed",
        description: result.message || "An error occurred during sync.",
        variant: "destructive",
        duration: 15000,
      });
      console.error("Sync failed details:", result.details?.join("\\n"));
    }
    setIsSyncing(false);
  };
  
  const EffectiveLoading = isLoadingData || isAuthLoading;

  if (EffectiveLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-foreground font-headline">Loading Sheet Data...</p>
      </div>
    );
  }

  if (error && displayedSheetData.length === 0) {
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
          <FileText className="mr-3 h-8 w-8" /> 
          {user?.role === 'admin' ? "All Sheet Data Entries" : 
           user?.teamNameForFilter ? `${user.teamNameForFilter} - Sheet Data` : "Sheet Data"}
        </h1>
        {user?.role === 'admin' && (
            <Button 
                onClick={handleSyncScores} 
                disabled={isSyncing || !activeTournament || allSheetData.length === 0}
                title={!activeTournament ? "Sync disabled: No active tournament." : allSheetData.length === 0 ? "Sync disabled: No sheet data." : isSyncing ? "Sync in progress..." : `Sync scores to ${activeTournament?.name}`}
            >
            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Sync Scores ({activeTournament ? activeTournament.name : "No Active T."})
            </Button>
        )}
         {user?.role === 'teamMember' && (
          <div className="flex items-center text-sm text-muted-foreground p-2 rounded-md bg-muted">
            <Lock className="h-4 w-4 mr-2 text-primary" />
            Sync available for Admins only.
          </div>
        )}
      </div>

       {user?.role === 'admin' && !activeTournament && !isLoadingData && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Admin Note: No Active Tournament</AlertTitle>
          <AlertDescription>
            The "Sync Scores" button is disabled because no active tournament could be found. Please create a tournament first.
          </AlertDescription>
        </Alert>
      )}
      {displayedSheetData.length === 0 && !EffectiveLoading && !error && (
         <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-300px)] bg-card rounded-lg shadow-inner">
          <Info className="h-16 w-16 text-primary" />
          <h2 className="text-3xl font-headline text-primary mt-4">
            {user?.role === 'teamMember' && !user.teamNameForFilter 
             ? "No Team Assigned" 
             : `No Data Found for ${user?.teamNameForFilter || 'Your View'}`}
          </h2>
          <p className="text-muted-foreground max-w-lg">
            {user?.role === 'teamMember' && !user.teamNameForFilter 
             ? "Your account is not assigned to a specific team. Please contact an administrator."
             : `No entries found in the '${SHEET_DATA_COLLECTION_PATH}' collection for your filter. Data will appear here in real-time as it's added.`}
          </p>
        </div>
      )}
      {error && displayedSheetData.length > 0 && (
        <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Note</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {displayedSheetData.length > 0 && (
        <Card>
          <CardHeader>
              <CardTitle>
                {user?.role === 'admin' ? "All Entries" : 
                 user?.teamNameForFilter ? `Entries for ${user.teamNameForFilter}` : "Entries"}
              </CardTitle>
          </CardHeader>
          <CardContent>
              <Table>
              <TableCaption>
                {user?.role === 'admin' 
                  ? "A list of all entries from Google Sheet. Use button above to sync to active tournament."
                  : `A list of entries for ${user?.teamNameForFilter || 'your team'}, updated in real-time.`}
              </TableCaption>
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
                  {displayedSheetData.map((row) => (
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
