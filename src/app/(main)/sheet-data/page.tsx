"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, type DocumentData, getDocs, limit } from 'firebase/firestore';
import type { SheetRow, TournamentSettings } from '@/lib/types';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle, FileText, Info, RefreshCcw, Lock, CalendarIcon, FilterX, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from '@/hooks/use-toast';
import { syncSheetScoresToDailyResults } from '@/lib/tournament-service';
import { mapDocToTournamentSettings, mapDocToSheetRow } from '@/lib/tournament-config';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO, isValid } from "date-fns";
import { cn } from '@/lib/utils';

const SHEET_DATA_COLLECTION_PATH = "Sheet1Rows";
const ITEMS_PER_PAGE = 20;
const ALL_STATUSES_VALUE = "__ALL_STATUSES__";

const ALL_STATUSES = [
  "Submitted",
  "DQ",
  "Needs Call Back",
  "Call Back Fix",
  "Not Interested",
  "Disconnected - Never Retransferred",
  "Pending Submission",
  "Already Sold Other Center",
  "Denied (needs new app)",
  "Future Submission Date",
  "Denied After UW"
];

// Map legacy team names to real team names
const TEAM_NAME_MAP: Record<string, string> = {
  "Team 1": "Rawlpindi Tiger",
  "Team 2": "Lahore qalanders",
  "Team 3": "Islamabad United",
  "Team 4": "Timberwolfs",
  "Team 5": "Rawlpindi Express",
  "Team 6": "Rawlpindi Gladiators",
  "Team 7": "Peshawar Zalmi",
  "Team 8": "Multan Sultans",
  "Team 9": "Avengers",
  "Team 10": "Hustlers",
  "Team 11": "A-Team",
  "Team 12": "Rawlpindi Bears",
  "Team 13": "Alpha's",
  "Team 14": "Vipers",
  "Team 15": "Karachi Kings",
  "Team 16": "Islamabad Sneak",
};

function getDisplayTeamName(teamName?: string) {
  if (!teamName) return undefined;
  return TEAM_NAME_MAP[teamName] || teamName;
}

export default function SheetDataPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [allSheetData, setAllSheetData] = useState<SheetRow[]>([]);
  const [filteredAndSortedSheetData, setFilteredAndSortedSheetData] = useState<SheetRow[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTournament, setActiveTournament] = useState<TournamentSettings | null>(null);
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>(""); // "" means all statuses
  const [agentFilter, setAgentFilter] = useState<string>("");

  const [currentPage, setCurrentPage] = useState(1);

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
        }
      } catch (err) {
        console.error("Error fetching latest tournament for sync:", err);
        setError(prev => prev || "Could not fetch active tournament details. Sync may not work as expected.");
        setActiveTournament(null);
      }
    };
    if (user?.role === 'admin') {
      fetchLatestTournament();
    }
  }, [user]);

  useEffect(() => {
    if (isAuthLoading) return;

    setIsLoadingData(true);
    setError(null);

    const dataCollectionRef = collection(db, SHEET_DATA_COLLECTION_PATH);
    const q = query(dataCollectionRef, orderBy('__name__', 'desc')); 

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawData: SheetRow[] = [];
      snapshot.forEach((doc) => {
        const row = mapDocToSheetRow(doc.id, doc.data());
        if (row) {
          rawData.push(row);
        }
      });
      
      let roleFilteredData: SheetRow[] = [];
      if (user?.role === 'admin') {
        roleFilteredData = rawData;
      } else if (user?.role === 'teamMember' && user.teamNameForFilter) {
        roleFilteredData = rawData.filter(row => row.LeadVender === user.teamNameForFilter);
      } else if (user?.role === 'teamMember' && !user.teamNameForFilter) {
        roleFilteredData = [];
         toast({
            title: "Sheet Data Restricted",
            description: "Your account is not assigned to a specific team to view data. Contact admin.",
            variant: "destructive"
        });
      } else {
        roleFilteredData = [];
      }
      setAllSheetData(roleFilteredData); 
      setCurrentPage(1); 
      setIsLoadingData(false);
    }, (err) => {
      console.error("Error fetching sheet data:", err);
      setError(`Failed to load sheet data. Please check Firestore permissions for '${SHEET_DATA_COLLECTION_PATH}' and ensure the collection exists.`);
      setIsLoadingData(false);
    });

    return () => unsubscribe();
  }, [user, isAuthLoading, toast]);

  useEffect(() => {
    let processedData = [...allSheetData]; 

    if (selectedDate) {
      const formattedSelectedDate = format(selectedDate, 'yyyy-MM-dd');
      processedData = processedData.filter(row => {
        if (!row.Date) return false;
        return row.Date === formattedSelectedDate;
      });
    }

    if (statusFilter) { // statusFilter will be "" for "All Statuses", so this condition works
      processedData = processedData.filter(row => row.Status === statusFilter);
    }

    if (agentFilter) {
      processedData = processedData.filter(row => 
        row.Agent && row.Agent.toLowerCase().includes(agentFilter.toLowerCase())
      );
    }
    
    setFilteredAndSortedSheetData(processedData);
    setCurrentPage(1); 
  }, [allSheetData, selectedDate, statusFilter, agentFilter]);

  const handleSyncScores = async () => {
    if (!activeTournament || !activeTournament.id) {
      toast({
        title: "Sync Failed",
        description: "No active tournament found to sync scores to.",
        variant: "destructive",
      });
      return;
    }
    setIsSyncing(true);
    toast({
      title: "Syncing Scores...",
      description: `Processing scores for tournament: ${activeTournament.name}. This may take a moment.`,
    });
    const result = await syncSheetScoresToDailyResults(activeTournament.id);
    if (result.success) {
      toast({
        title: "Sync Successful!",
        description: result.message,
        variant: "default",
        className: "bg-green-100 border-green-500 text-green-700 dark:bg-green-800 dark:text-green-200 dark:border-green-600",
        duration: 10000, // Longer duration for success message with details
      });
      if (result.details) {
        console.log("Sync Details:", result.details.join("\n"));
      }
    } else {
      toast({
        title: "Sync Failed",
        description: result.message,
        variant: "destructive",
        duration: 10000,
      });
       if (result.details) {
        console.error("Sync Failure Details:", result.details.join("\n"));
      }
    }
    setIsSyncing(false);
  };

  const totalPages = Math.ceil(filteredAndSortedSheetData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredAndSortedSheetData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleClearFilters = () => {
    setSelectedDate(undefined);
    setStatusFilter("");
    setAgentFilter("");
    setCurrentPage(1);
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

  if (error && paginatedData.length === 0 && allSheetData.length === 0) { 
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h2 className="text-3xl font-headline text-destructive mt-4">Error Loading Data</h2>
        <p className="text-muted-foreground max-w-lg">{error}</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-8 px-4 md:px-8 lg:px-16 py-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-card rounded-lg shadow">
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary flex items-center">
          <FileText className="mr-3 h-8 w-8" /> 
          {user?.role === 'admin' ? "All Sheet Data Entries" : 
           user?.teamNameForFilter ? `${getDisplayTeamName(user.teamNameForFilter)} - Sheet Data` : "Sheet Data"}
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

       {user?.role === 'admin' && !activeTournament && !EffectiveLoading && (
        <Alert variant="default" className="bg-yellow-50 border-yellow-400 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-600 dark:text-yellow-300">
          <AlertTriangle className="h-4 w-4 !text-yellow-600 dark:!text-yellow-400" />
          <AlertTitle className="text-yellow-700 dark:text-yellow-300">Admin Note: No Active Tournament</AlertTitle>
          <AlertDescription>
            The "Sync Scores" button is disabled because no active tournament could be found. Please create a tournament first.
          </AlertDescription>
        </Alert>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Refine the data displayed in the table below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-0 md:flex md:flex-wrap md:items-end md:gap-4">
          <div className="flex-grow space-y-1">
            <label htmlFor="date-filter" className="text-sm font-medium text-muted-foreground">Filter by Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date-filter"
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal bg-background",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex-grow space-y-1 min-w-[180px]">
            <label htmlFor="status-filter" className="text-sm font-medium text-muted-foreground">Filter by Status</label>
            <Select
              value={statusFilter === "" ? ALL_STATUSES_VALUE : statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value === ALL_STATUSES_VALUE ? "" : value);
              }}
            >
              <SelectTrigger id="status-filter" className="w-full bg-background">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUSES_VALUE}>All Statuses</SelectItem>
                {ALL_STATUSES.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-grow space-y-1">
            <label htmlFor="agent-filter" className="text-sm font-medium text-muted-foreground">Filter by Agent Name</label>
            <Input 
              id="agent-filter"
              placeholder="Enter agent name..."
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="w-full bg-background"
            />
          </div>
          <Button onClick={handleClearFilters} variant="outline" className="w-full md:w-auto">
            <FilterX className="mr-2 h-4 w-4" /> Clear Filters
          </Button>
        </CardContent>
      </Card>


      {paginatedData.length === 0 && !EffectiveLoading && !error && (
         <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-450px)] bg-card rounded-lg shadow-inner">
          <Info className="h-16 w-16 text-primary" />
          <h2 className="text-3xl font-headline text-primary mt-4">
            {allSheetData.length > 0 ? "No Matching Entries" : 
             (user?.role === 'teamMember' && !user.teamNameForFilter) 
             ? "No Team Assigned" 
             : `No Data Found for ${user?.teamNameForFilter || 'Your View'}`}
          </h2>
          <p className="text-muted-foreground max-w-lg">
            {allSheetData.length > 0 ? "No entries match your current filter criteria. Try adjusting or clearing your filters." :
             (user?.role === 'teamMember' && !user.teamNameForFilter) 
             ? "Your account is not assigned to a specific team. Please contact an administrator."
             : `No entries found in the '${SHEET_DATA_COLLECTION_PATH}' collection for your filter. Data will appear here in real-time as it's added.`}
          </p>
        </div>
      )}
      {error && paginatedData.length === 0 && allSheetData.length > 0 && ( 
        <Alert variant="default" className="bg-yellow-50 border-yellow-400 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-600 dark:text-yellow-300">
            <AlertTriangle className="h-4 w-4 !text-yellow-600 dark:!text-yellow-400" />
            <AlertTitle className="text-yellow-700 dark:text-yellow-300">Partial Data Note</AlertTitle>
            <AlertDescription>{error} Some data might be available if filters are cleared.</AlertDescription>
        </Alert>
      )}

      {paginatedData.length > 0 && (
        <Card>
          <CardHeader>
              <CardTitle>
                {user?.role === 'admin' ? "All Entries" : 
                 user?.teamNameForFilter ? `Entries for ${getDisplayTeamName(user.teamNameForFilter)}` : "Entries"}
                 <span className="text-sm font-normal text-muted-foreground ml-2">({filteredAndSortedSheetData.length} matching entries)</span>
              </CardTitle>
          </CardHeader>
          <CardContent>
              <Table>
              <TableCaption>
                Showing page {currentPage} of {totalPages}. 
                {user?.role === 'admin' 
                  ? " List of entries from Google Sheet. Use button above to sync to active tournament."
                  : ` List of entries for ${getDisplayTeamName(user.teamNameForFilter) || 'your team'}, updated in real-time.`}
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
                  {paginatedData.map((row) => (
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
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

