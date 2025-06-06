
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Matchup as MatchupType, SheetRow, GetMatchDailyResultOutput as MatchDailyResultType } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, BarChart3, ListChecks, Trophy, AlertTriangle, Info } from 'lucide-react';
import { format, startOfDay, isEqual, isBefore, isAfter, subDays, isValid, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
// import { getDailySubmissions } from '@/ai/flows/get-daily-submissions-flow'; // No longer directly used for scores
import { getEntriesForTeamByDate } from '@/ai/flows/get-entries-for-team-by-date-flow';
import { getMatchDailyResult } from '@/ai/flows/get-match-daily-result-flow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface MatchDetailPanelProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  matchup: MatchupType | null;
  tournamentId: string | null; 
}

interface PanelEntry {
  id: string;
  Agent?: string | null;
  INSURED_NAME?: string | null;
  ProductType?: string | null;
}

export default function MatchDetailPanel({ isOpen, onOpenChange, matchup, tournamentId }: MatchDetailPanelProps) {
  const [selectedDateInternal, setSelectedDateInternal] = useState<Date>(startOfDay(new Date()));
  const [isLoadingPanelData, setIsLoadingPanelData] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  const [matchDailyResult, setMatchDailyResult] = useState<MatchDailyResultType | null>(null);
  const [team1Entries, setTeam1Entries] = useState<PanelEntry[]>([]);
  const [team2Entries, setTeam2Entries] = useState<PanelEntry[]>([]);
  const [tournamentStartDate, setTournamentStartDate] = useState<Date | null>(null); // For calendar disabling


  const { toast } = useToast();

  const formattedSelectedDate = useMemo(() => {
    console.log("[PanelMemo] selectedDateInternal changed to:", selectedDateInternal);
    return format(selectedDateInternal, 'yyyy-MM-dd');
  }, [selectedDateInternal]);

  const displaySelectedDate = useMemo(() => format(selectedDateInternal, 'PPP'), [selectedDateInternal]);
  const isFutureDateSelected = useMemo(() => isBefore(startOfDay(new Date()), selectedDateInternal), [selectedDateInternal]);

  useEffect(() => {
    // Placeholder for fetching actual tournament start date if needed for calendar
    // For now, using a default. This should ideally come from tournament settings if critical.
    if (matchup) { // Assuming matchup implies a tournament context exists
        setTournamentStartDate(subDays(new Date(), 90)); // Example: allow viewing up to 90 days past
    }
  }, [matchup]);


  const fetchPanelData = useCallback(async () => {
    if (!matchup || !tournamentId || !matchup.roundId) {
      console.error("[PanelFetch] Aborting fetch: Critical data (matchup, tournamentId, roundId) is incomplete.", {matchup, tournamentId});
      setPanelError("Matchup data is incomplete for fetching details.");
      setIsLoadingPanelData(false); // Ensure loading is stopped
      return;
    }
     // Explicitly check for TBD teams before proceeding with team-specific fetches
    if (!matchup.team1Name || matchup.team1Name.toLowerCase() === "tbd" || 
        !matchup.team2Name || matchup.team2Name.toLowerCase() === "tbd") {
      console.log(`[PanelFetch] Aborting team-specific fetches for Matchup ID: ${matchup.id} as one or both teams are TBD.`);
      setPanelError("Teams for this matchup are not yet determined. Daily stats cannot be fetched.");
      setMatchDailyResult(null);
      setTeam1Entries([]);
      setTeam2Entries([]);
      setIsLoadingPanelData(false); // Ensure loading is stopped
      return;
    }

    console.log(`[PanelFetch] Initiating fetch for Matchup ID: ${matchup.id} (R:${matchup.roundId}) (${matchup.team1Name} vs ${matchup.team2Name}) on Date: ${formattedSelectedDate} for Tournament: ${tournamentId}`);
    setIsLoadingPanelData(true);
    setPanelError(null);
    setMatchDailyResult(null); 
    setTeam1Entries([]);
    setTeam2Entries([]);

    try {
      console.log(`[PanelFetch] Calling getMatchDailyResult for ${matchup.id}...`);
      const dailyResultDataPromise = getMatchDailyResult({ tournamentId, roundNum: matchup.roundId, matchId: matchup.id, targetDate: formattedSelectedDate });
      
      console.log(`[PanelFetch] Calling getEntriesForTeamByDate for Team 1: ${matchup.team1Name}...`);
      const entriesTeam1ResultPromise = getEntriesForTeamByDate({ targetDate: formattedSelectedDate, teamName: matchup.team1Name });
      
      console.log(`[PanelFetch] Calling getEntriesForTeamByDate for Team 2: ${matchup.team2Name}...`);
      const entriesTeam2ResultPromise = getEntriesForTeamByDate({ targetDate: formattedSelectedDate, teamName: matchup.team2Name });

      const [
        dailyResultData,
        entriesTeam1Result,
        entriesTeam2Result
      ] = await Promise.all([
        dailyResultDataPromise,
        entriesTeam1ResultPromise,
        entriesTeam2ResultPromise
      ]);

      console.log(`[PanelFetch] Results for ${matchup.id} on ${formattedSelectedDate}:`);
      console.log(`  Daily Result:`, dailyResultData);
      console.log(`  Team 1 (${matchup.team1Name}) Entries Count:`, entriesTeam1Result.length);
      console.log(`  Team 2 (${matchup.team2Name}) Entries Count:`, entriesTeam2Result.length);

      setMatchDailyResult(dailyResultData);

      setTeam1Entries(entriesTeam1Result.map(entry => ({
        id: entry.id,
        Agent: entry.Agent,
        INSURED_NAME: entry.INSURED_NAME,
        ProductType: entry.ProductType,
      })));
      setTeam2Entries(entriesTeam2Result.map(entry => ({
        id: entry.id,
        Agent: entry.Agent,
        INSURED_NAME: entry.INSURED_NAME,
        ProductType: entry.ProductType,
      })));

    } catch (error) {
      console.error(`[PanelFetch] Error fetching panel data for ${matchup.id} on ${formattedSelectedDate}:`, error);
      setPanelError("Failed to load match details. Please try again or check connection.");
      toast({
        title: "Error Loading Details",
        description: error instanceof Error ? error.message : "Could not fetch performance data for the selected date.",
        variant: "destructive",
      });
    } finally {
      console.log(`[PanelFetch] Finished fetch attempt for ${matchup.id} on ${formattedSelectedDate}. Setting isLoadingPanelData to false.`);
      setIsLoadingPanelData(false);
    }
  }, [matchup, formattedSelectedDate, tournamentId, toast]);

  useEffect(() => {
    console.log("[PanelEffect isOpen/matchup] isOpen:", isOpen, "Matchup ID:", matchup?.id, "TournamentID:", tournamentId);
    if (isOpen && matchup) {
      console.log("[PanelEffect isOpen/matchup] Panel opened or matchup changed. Resetting selectedDateInternal to today by default.");
      // If matchup provides a specific start date relevant to its series, use that, otherwise today.
      // For now, defaulting to today for simplicity as series start date isn't directly on matchup.
      setSelectedDateInternal(startOfDay(new Date())); 
    } else if (!isOpen) {
        console.log("[PanelEffect isOpen/matchup] Panel closed. Resetting internal states.");
        setIsLoadingPanelData(false); // Ensure loading is off when closed
        setPanelError(null);
        setMatchDailyResult(null);
        setTeam1Entries([]);
        setTeam2Entries([]);
    }
  }, [isOpen, matchup]); // Removed tournamentId as it's less likely to change independently of matchup for *this specific effect*

  useEffect(() => {
    console.log(`[PanelEffect DataTrigger] Evaluating fetch. Conditions: isOpen=${isOpen}, matchupExists=${!!matchup}, tournamentIdExists=${!!tournamentId}, roundIdExists=${!!matchup?.roundId}, team1Valid=${matchup?.team1Name && matchup.team1Name.toLowerCase() !== "tbd"}, team2Valid=${matchup?.team2Name && matchup.team2Name.toLowerCase() !== "tbd"}, !isFutureDate=${!isFutureDateSelected}, selectedDate=${formattedSelectedDate}`);
    
    if (isOpen && matchup && tournamentId && matchup.roundId && 
        matchup.team1Name && matchup.team1Name.toLowerCase() !== "tbd" && 
        matchup.team2Name && matchup.team2Name.toLowerCase() !== "tbd" && 
        !isFutureDateSelected) {
      console.log(`[PanelEffect DataTrigger] Conditions met. Calling fetchPanelData for ${matchup.id} on ${formattedSelectedDate}.`);
      fetchPanelData();
    } else if (isOpen && matchup) { // Handle cases where we shouldn't fetch
      if (isFutureDateSelected) {
        console.log(`[PanelEffect DataTrigger] Future date ${formattedSelectedDate} selected for ${matchup.id}. Clearing data, not fetching.`);
        setPanelError(null); // Not an error, just no data
      } else if (matchup.team1Name?.toLowerCase() === "tbd" || matchup.team2Name?.toLowerCase() === "tbd") {
        console.log(`[PanelEffect DataTrigger] Matchup teams TBD for ${matchup.id}. Not fetching. Clearing data.`);
        setPanelError("Teams for this matchup are not yet determined.");
      } else {
        console.log(`[PanelEffect DataTrigger] Other condition not met for fetch. Matchup: ${matchup?.id}, Date: ${formattedSelectedDate}`);
        // Potentially set an error or clear data if conditions are invalid for fetching but panel is open
      }
      // Ensure loading state is reset if any of these conditions prevent fetching
      setMatchDailyResult(null);
      setTeam1Entries([]);
      setTeam2Entries([]);
      if (isLoadingPanelData) setIsLoadingPanelData(false);
    }
  }, [isOpen, matchup, tournamentId, selectedDateInternal, fetchPanelData, isFutureDateSelected, formattedSelectedDate]); // Key dependencies for triggering fetch


  if (!matchup) {
    console.log("[PanelRender] No matchup data, rendering null (or effectively nothing if Sheet is controlled by isOpen=false).");
    return null;
  }

  const { team1Name, team2Name, team1DailyWins, team2DailyWins, seriesWinnerName } = matchup;
  
  const team1ScoreForDay = matchDailyResult?.exists ? matchDailyResult.team1Score : 0;
  const team2ScoreForDay = matchDailyResult?.exists ? matchDailyResult.team2Score : 0;
  const dailyWinnerName = matchDailyResult?.exists ? matchDailyResult.winner : null;
  const dailyMatchStatus = matchDailyResult?.exists ? matchDailyResult.status : (isFutureDateSelected ? "Pending (Future Date)" : "Awaiting Data");


  let dayPerformanceSummary = "";
  if (isLoadingPanelData) {
    dayPerformanceSummary = `Loading performance data for ${displaySelectedDate}...`;
  } else if (panelError && !isFutureDateSelected && (!matchup.team1Name || matchup.team1Name.toLowerCase() === "tbd" || !matchup.team2Name || matchup.team2Name.toLowerCase() === "tbd" )) {
    dayPerformanceSummary = panelError; // Show TBD error
  } else if (panelError && !isFutureDateSelected) {
    dayPerformanceSummary = panelError; // Show other fetch errors
  } else if (isFutureDateSelected) {
    dayPerformanceSummary = "Data for future dates is not available.";
  } else if (seriesWinnerName && matchDailyResult) { // If series is won, but we have data for the day
     dayPerformanceSummary = `Match series concluded. Winner: ${seriesWinnerName}. Performance on ${displaySelectedDate} (${dailyMatchStatus || 'Status Unknown'}): `;
     if(dailyWinnerName) dayPerformanceSummary += `${dailyWinnerName} won.`; else if (dailyMatchStatus?.includes("Tie")) dayPerformanceSummary += `Tie.`; else dayPerformanceSummary += `Scores: ${team1Name} ${team1ScoreForDay} - ${team2Name} ${team2ScoreForDay}.`;
  } else if (!matchDailyResult || !matchDailyResult.exists) {
    dayPerformanceSummary = `No daily result record found for ${displaySelectedDate}. Submissions are assumed 0.`;
  } else if (dailyWinnerName) {
    dayPerformanceSummary = `${dailyWinnerName} won the battle on ${displaySelectedDate} (${dailyMatchStatus || 'Status Unknown'})!`;
  } else if (dailyMatchStatus?.includes("Tie") || (team1ScoreForDay === team2ScoreForDay && team1ScoreForDay >= 0) ) { // Ensure 0-0 also shows tie
    dayPerformanceSummary = `It was a tie on ${displaySelectedDate} (${team1ScoreForDay}-${team2ScoreForDay}). Status: ${dailyMatchStatus || 'Status Unknown'}`;
  } else if (team1ScoreForDay === 0 && team2ScoreForDay === 0 && isBefore(selectedDateInternal, startOfDay(new Date()))) {
    dayPerformanceSummary = `No submissions recorded for either team on ${displaySelectedDate}.`;
  } else if (team1ScoreForDay === 0 && team2ScoreForDay === 0) {
    dayPerformanceSummary = `Awaiting submissions for ${displaySelectedDate}.`;
  } else {
     dayPerformanceSummary = `Performance for ${displaySelectedDate}: ${dailyMatchStatus || "Status Unknown"}`;
  }

  console.log(`[PanelRender] Rendering panel. isOpen: ${isOpen}, Matchup ID: ${matchup.id}, isLoading: ${isLoadingPanelData}, panelError: ${panelError}, DailyResult:`, matchDailyResult, "DaySummary:", dayPerformanceSummary);

  const renderEntryList = (entries: PanelEntry[], teamDisplayName: string | null) => {
    const actualTeamName = teamDisplayName || "this team";
    if (isLoadingPanelData) return <p className="text-sm text-muted-foreground italic">Loading entries...</p>;
    
    if (isFutureDateSelected) {
      return <p className="text-sm text-muted-foreground italic">Entries for future dates are not shown.</p>;
    }
    if (matchup.team1Name?.toLowerCase() === 'tbd' || matchup.team2Name?.toLowerCase() === 'tbd') {
         return <p className="text-sm text-muted-foreground italic">Team not determined, entries cannot be displayed.</p>;
    }
    if (entries.length === 0) {
      return <p className="text-sm text-muted-foreground italic">No "Submitted" entries found contributing to {actualTeamName}'s score on {displaySelectedDate}.</p>;
    }

    return (
      <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
        {entries.map(entry => (
          <li key={entry.id} className="text-sm p-2 rounded-md bg-muted/50">
            <p className="font-medium">{entry.INSURED_NAME || 'N/A'}</p>
            <p className="text-xs text-muted-foreground">Agent: {entry.Agent || 'N/A'} | Product: {entry.ProductType || 'N/A'}</p>
          </li>
        ))}
      </ul>
    );
  };
  
  // Use a sensible default for tournamentStartDate if not available from props/state
  const safeTournamentStartDate = tournamentStartDate && isValid(tournamentStartDate) ? startOfDay(tournamentStartDate) : subDays(startOfDay(new Date()), 90) ;


  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-2xl font-headline text-primary flex items-center">
            <BarChart3 className="mr-3 h-7 w-7" /> Match Insights: {team1Name || "TBD"} vs {team2Name || "TBD"}
          </SheetTitle>
          <SheetDescription>
            Detailed performance for this matchup. Overall series score is based on daily wins.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center text-primary">
                <Trophy className="mr-2 h-5 w-5" /> Series Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-around items-center text-center">
                <div>
                  <p className="text-2xl font-bold font-headline">{team1DailyWins}</p>
                  <p className="text-sm text-muted-foreground">{team1Name || "TBD"}</p>
                </div>
                <p className="text-2xl font-bold text-muted-foreground">vs</p>
                <div>
                  <p className="text-2xl font-bold font-headline">{team2DailyWins}</p>
                  <p className="text-sm text-muted-foreground">{team2Name || "TBD"}</p>
                </div>
              </div>
              {seriesWinnerName && (
                <p className="mt-3 text-center font-semibold text-accent">
                  Series Winner: {seriesWinnerName}
                </p>
              )}
               {(!seriesWinnerName && (team1Name?.toLowerCase() === 'tbd' || team2Name?.toLowerCase() === 'tbd')) && (
                  <p className="mt-3 text-center text-sm text-muted-foreground">Awaiting teams to start series.</p>
              )}
            </CardContent>
          </Card>

          <Separator />

          <div>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-2">
              <h3 className="text-lg font-semibold font-headline text-foreground">
                Performance for: {displaySelectedDate}
              </h3>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className="w-full sm:w-auto bg-input hover:bg-accent/20"
                    disabled={isLoadingPanelData || (team1Name?.toLowerCase() === 'tbd' || team2Name?.toLowerCase() === 'tbd')}
                    title={(team1Name?.toLowerCase() === 'tbd' || team2Name?.toLowerCase() === 'tbd') ? "Date selection disabled until teams are determined" : "Select date"}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {displaySelectedDate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDateInternal}
                    onSelect={(date) => {
                        if (date) {
                            console.log("[PanelCalendar] Date selected:", date);
                            setSelectedDateInternal(startOfDay(date));
                        }
                    }}
                    disabled={(date) => {
                      const today = startOfDay(new Date());
                       // Allow selecting from a reasonable past date up to today
                       return isBefore(date, safeTournamentStartDate) || isAfter(date, today); 
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            {isLoadingPanelData && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading daily stats for {displaySelectedDate}...</p>
              </div>
            )}

            {!isLoadingPanelData && panelError && (
              <div className="text-destructive p-4 bg-destructive/10 rounded-md flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2"/> {panelError}
              </div>
            )}
            
            {!isLoadingPanelData && !panelError && isFutureDateSelected && (
               <div className="text-blue-600 dark:text-blue-400 p-4 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center border border-blue-300 dark:border-blue-700">
                 <Info className="h-5 w-5 mr-2 text-blue-500 dark:text-blue-400"/> Data for future dates is not yet available.
               </div>
            )}
             {!isLoadingPanelData && !panelError && !isFutureDateSelected && 
              (team1Name?.toLowerCase() === 'tbd' || team2Name?.toLowerCase() === 'tbd') && (
                 <div className="text-orange-600 dark:text-orange-400 p-4 bg-orange-100 dark:bg-orange-900/30 rounded-md flex items-center border border-orange-300 dark:border-orange-700">
                    <Info className="h-5 w-5 mr-2 text-orange-500 dark:text-orange-400"/> Teams for this matchup are not yet determined. Daily stats will be shown once teams are set.
                 </div>
            )}


            {!isLoadingPanelData && !panelError && !isFutureDateSelected && 
             (team1Name && team1Name.toLowerCase() !== 'tbd' && team2Name && team2Name.toLowerCase() !== 'tbd') && (
              <>
                <Card className="mb-4">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-center">
                      <div>
                        <p className="text-4xl font-bold font-headline text-primary">{team1ScoreForDay}</p>
                        <p className="text-sm text-muted-foreground">{team1Name} Submissions</p>
                      </div>
                      <div>
                        <p className="text-4xl font-bold font-headline text-primary">{team2ScoreForDay}</p>
                        <p className="text-sm text-muted-foreground">{team2Name} Submissions</p>
                      </div>
                    </div>
                    <p className="mt-4 text-center font-semibold text-accent-foreground">
                      {dayPerformanceSummary}
                    </p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-md flex items-center">
                        <ListChecks className="mr-2 h-5 w-5 text-primary" /> {team1Name} - Contributing Entries
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {renderEntryList(team1Entries, team1Name)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-md flex items-center">
                        <ListChecks className="mr-2 h-5 w-5 text-primary" /> {team2Name} - Contributing Entries
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {renderEntryList(team2Entries, team2Name)}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        </div>

        <SheetFooter className="mt-8">
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

    