
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Matchup as MatchupType, SheetRow, GetMatchDailyResultOutput as MatchDailyResultType, GetMatchScheduledDatesOutput } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, BarChart3, ListChecks, Trophy, AlertTriangle, Info } from 'lucide-react';
import { format, startOfDay, isEqual, isBefore, isAfter, subDays, isValid, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { getEntriesForTeamByDate } from '@/ai/flows/get-entries-for-team-by-date-flow';
import { getMatchDailyResult } from '@/ai/flows/get-match-daily-result-flow';
import { getMatchScheduledDates } from '@/ai/flows/get-match-scheduled-dates-flow';
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
  
  const [matchScheduledDates, setMatchScheduledDates] = useState<GetMatchScheduledDatesOutput | null>(null);
  const [isFetchingScheduledDates, setIsFetchingScheduledDates] = useState(true);

  const { toast } = useToast();

  const formattedSelectedDate = useMemo(() => {
    return format(selectedDateInternal, 'yyyy-MM-dd');
  }, [selectedDateInternal]);

  const displaySelectedDate = useMemo(() => format(selectedDateInternal, 'PPP'), [selectedDateInternal]);
  
  // Effect to fetch scheduled dates for the current matchup
  useEffect(() => {
    if (isOpen && matchup && tournamentId && matchup.roundId) {
      console.log(`[PanelEffect ScheduledDates] Fetching scheduled dates for T:${tournamentId}, R:${matchup.roundId}, M:${matchup.id}`);
      setIsFetchingScheduledDates(true);
      setMatchScheduledDates(null); // Reset before fetching new ones

      getMatchScheduledDates({ tournamentId, roundNum: matchup.roundId, matchId: matchup.id })
        .then(dates => {
          console.log(`[PanelEffect ScheduledDates] Fetched scheduled dates for M:${matchup.id}:`, dates);
          setMatchScheduledDates(dates);
        })
        .catch(err => {
          console.error(`[PanelEffect ScheduledDates] Error fetching scheduled dates for M:${matchup.id}:`, err);
          toast({ title: "Error", description: "Could not load match schedule dates.", variant: "destructive" });
          setMatchScheduledDates([]); // Set to empty array on error to unblock calendar
        })
        .finally(() => {
          setIsFetchingScheduledDates(false);
        });
    } else if (!isOpen) {
      // Reset when panel closes
      setMatchScheduledDates(null);
      setIsFetchingScheduledDates(true);
    }
  }, [isOpen, matchup, tournamentId, toast]);

  // Effect to set the initial selectedDateInternal based on fetched scheduled dates
  useEffect(() => {
    if (isFetchingScheduledDates || !matchup) {
      console.log(`[PanelEffect InitialDate] Waiting for scheduled dates (isFetching: ${isFetchingScheduledDates}) or matchup.`);
      return; 
    }
  
    let newSelectedDateCandidate: Date | null = null;
  
    if (matchScheduledDates && matchScheduledDates.length > 0) {
      const clientToday = startOfDay(new Date());
      
      // Filter to get scheduled dates that are not in the client's future
      const validNonFutureScheduledDates = matchScheduledDates
        .map(dStr => parseISO(dStr)) // Dates from flow are YYYY-MM-DD, parseISO handles them as UTC midnight
        .filter(d => !isAfter(d, clientToday))
        .sort((a, b) => b.getTime() - a.getTime()); // Sort descending (latest first)
  
      console.log(`[PanelEffect InitialDate] Client's today: ${format(clientToday, 'yyyy-MM-dd')}`);
      console.log(`[PanelEffect InitialDate] All scheduled dates for M:${matchup.id}:`, matchScheduledDates);
      console.log(`[PanelEffect InitialDate] Valid non-future scheduled dates for M:${matchup.id}:`, validNonFutureScheduledDates.map(d => format(d, 'yyyy-MM-dd')));

      if (validNonFutureScheduledDates.some(d => isEqual(d, clientToday))) {
        newSelectedDateCandidate = clientToday;
        console.log(`[PanelEffect InitialDate] Case 1: Client's today is a valid, non-future match day. Setting to: ${format(newSelectedDateCandidate, 'yyyy-MM-dd')}`);
      } else if (validNonFutureScheduledDates.length > 0) {
        newSelectedDateCandidate = validNonFutureScheduledDates[0]; // Latest valid past/present scheduled date
        console.log(`[PanelEffect InitialDate] Case 2: Client's today not valid/scheduled or is future. Setting to latest past/present scheduled day: ${format(newSelectedDateCandidate, 'yyyy-MM-dd')}`);
      } else {
        // All scheduled dates are in the client's future. Pick the earliest one.
        const sortedFutureScheduledDates = matchScheduledDates.map(dStr => parseISO(dStr)).sort((a, b) => a.getTime() - b.getTime());
        if (sortedFutureScheduledDates.length > 0) {
          newSelectedDateCandidate = sortedFutureScheduledDates[0];
          console.log(`[PanelEffect InitialDate] Case 3: All scheduled dates are in client's future. Setting to earliest scheduled: ${format(newSelectedDateCandidate, 'yyyy-MM-dd')}`);
        }
      }
    } else {
        console.log(`[PanelEffect InitialDate] No matchScheduledDates found for M:${matchup.id} or list is empty. Defaulting to client's today.`);
    }
    
    // Fallback to client's today if no candidate determined from scheduled dates (e.g., flow error or empty results)
    if (!newSelectedDateCandidate) {
        newSelectedDateCandidate = startOfDay(new Date());
        console.log(`[PanelEffect InitialDate] Fallback or no scheduled dates: Setting to client's today: ${format(newSelectedDateCandidate, 'yyyy-MM-dd')}`);
    }

    if (isValid(newSelectedDateCandidate)) {
      const newDateStartOfDay = startOfDay(newSelectedDateCandidate);
      if (!selectedDateInternal || !isEqual(newDateStartOfDay, selectedDateInternal)) {
        console.log(`[PanelEffect InitialDate] Finalizing: Setting selectedDateInternal to: ${format(newDateStartOfDay, 'yyyy-MM-dd')}`);
        setSelectedDateInternal(newDateStartOfDay);
      } else {
        console.log(`[PanelEffect InitialDate] No change needed for selectedDateInternal. Current: ${format(selectedDateInternal, 'yyyy-MM-dd')}`);
      }
    } else {
        console.warn("[PanelEffect InitialDate] newSelectedDateCandidate was invalid. selectedDateInternal not changed.");
    }

  }, [matchScheduledDates, isFetchingScheduledDates, matchup]); // Removed selectedDateInternal


  const fetchPanelData = useCallback(async () => {
    if (!isOpen || !matchup || !tournamentId || !matchup.roundId) {
      console.error("[PanelFetch] Aborting fetch: Critical data (isOpen, matchup, tournamentId, roundId) is incomplete.", {isOpen, matchup, tournamentId});
      setPanelError("Matchup data is incomplete for fetching details.");
      if (isLoadingPanelData) setIsLoadingPanelData(false);
      return;
    }
    
    if (!matchup.team1Name || matchup.team1Name.toLowerCase() === "tbd" || 
        !matchup.team2Name || matchup.team2Name.toLowerCase() === "tbd") {
      console.log(`[PanelFetch] Aborting team-specific fetches for Matchup ID: ${matchup.id} as one or both teams are TBD.`);
      setPanelError("Teams for this matchup are not yet determined. Daily stats cannot be fetched.");
      setMatchDailyResult(null);
      setTeam1Entries([]);
      setTeam2Entries([]);
      if (isLoadingPanelData) setIsLoadingPanelData(false);
      return;
    }

    console.log(`[PanelFetch] Initiating fetch for Matchup ID: ${matchup.id} (R:${matchup.roundId}) (${matchup.team1Name} vs ${matchup.team2Name}) on Date: ${formattedSelectedDate} for Tournament: ${tournamentId}`);
    setIsLoadingPanelData(true);
    setPanelError(null);
    // Reset data for the new date fetch
    setMatchDailyResult(null); 
    setTeam1Entries([]);
    setTeam2Entries([]);

    try {
      console.log(`[PanelFetch] Calling getMatchDailyResult for M:${matchup.id} D:${formattedSelectedDate}...`);
      const dailyResultDataPromise = getMatchDailyResult({ tournamentId, roundNum: matchup.roundId, matchId: matchup.id, targetDate: formattedSelectedDate });
      
      console.log(`[PanelFetch] Calling getEntriesForTeamByDate for Team 1: ${matchup.team1Name} D:${formattedSelectedDate}...`);
      const entriesTeam1ResultPromise = getEntriesForTeamByDate({ targetDate: formattedSelectedDate, teamName: matchup.team1Name });
      
      console.log(`[PanelFetch] Calling getEntriesForTeamByDate for Team 2: ${matchup.team2Name} D:${formattedSelectedDate}...`);
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

      console.log(`[PanelFetch] Results for M:${matchup.id} on D:${formattedSelectedDate}:`);
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
      console.error(`[PanelFetch] Error fetching panel data for M:${matchup.id} on D:${formattedSelectedDate}:`, error);
      setPanelError("Failed to load match details. Please try again or check connection.");
      toast({
        title: "Error Loading Details",
        description: error instanceof Error ? error.message : "Could not fetch performance data for the selected date.",
        variant: "destructive",
      });
    } finally {
      console.log(`[PanelFetch] Finished fetch attempt for M:${matchup.id} on D:${formattedSelectedDate}. Setting isLoadingPanelData to false.`);
      setIsLoadingPanelData(false);
    }
  }, [isOpen, matchup, tournamentId, formattedSelectedDate, toast]); // isLoadingPanelData removed

  useEffect(() => {
    console.log(`[PanelEffect DataTrigger] Evaluating fetch. Conditions: isOpen=${isOpen}, matchupExists=${!!matchup}, tournamentIdExists=${!!tournamentId}, roundIdExists=${!!matchup?.roundId}, team1Valid=${matchup?.team1Name && matchup.team1Name.toLowerCase() !== "tbd"}, team2Valid=${matchup?.team2Name && matchup.team2Name.toLowerCase() !== "tbd"}, selectedDate=${formattedSelectedDate}`);
    
    if (isOpen && matchup && tournamentId && matchup.roundId && 
        matchup.team1Name && matchup.team1Name.toLowerCase() !== "tbd" && 
        matchup.team2Name && matchup.team2Name.toLowerCase() !== "tbd") {
      
      // Check if selectedDateInternal is a future date relative to client's system time
      const isFutureClientDate = isAfter(startOfDay(selectedDateInternal), startOfDay(new Date()));
      if (isFutureClientDate) {
        console.log(`[PanelEffect DataTrigger] Selected date ${formattedSelectedDate} for M:${matchup.id} is in the client's future. Clearing data, not fetching main panel data.`);
        setPanelError(null); 
        setMatchDailyResult(null);
        setTeam1Entries([]);
        setTeam2Entries([]);
        if (isLoadingPanelData) setIsLoadingPanelData(false); // Ensure loading spinner stops
      } else {
        console.log(`[PanelEffect DataTrigger] Conditions met. Calling fetchPanelData for M:${matchup.id} on D:${formattedSelectedDate}.`);
        fetchPanelData();
      }

    } else if (isOpen && matchup) { // Handle other cases where we shouldn't fetch
      console.log(`[PanelEffect DataTrigger] Conditions for full fetch not met. Matchup: ${matchup?.id}, Date: ${formattedSelectedDate}`);
      if (matchup.team1Name?.toLowerCase() === "tbd" || matchup.team2Name?.toLowerCase() === "tbd") {
        setPanelError("Teams for this matchup are not yet determined.");
      }
      setMatchDailyResult(null);
      setTeam1Entries([]);
      setTeam2Entries([]);
      if (isLoadingPanelData) setIsLoadingPanelData(false);
    }
  }, [isOpen, matchup, tournamentId, selectedDateInternal, fetchPanelData, formattedSelectedDate]);


  if (!matchup) {
    console.log("[PanelRender] No matchup data, rendering null (or effectively nothing if Sheet is controlled by isOpen=false).");
    return null;
  }

  const { team1Name, team2Name, team1DailyWins, team2DailyWins, seriesWinnerName } = matchup;
  
  const team1ScoreForDay = matchDailyResult?.exists ? matchDailyResult.team1Score : 0;
  const team2ScoreForDay = matchDailyResult?.exists ? matchDailyResult.team2Score : 0;
  const dailyWinnerName = matchDailyResult?.exists ? matchDailyResult.winner : null;
  const dailyMatchStatus = matchDailyResult?.exists ? matchDailyResult.status : "Awaiting Data";
  const isSelectedDateFutureForClient = isAfter(startOfDay(selectedDateInternal), startOfDay(new Date()));


  let dayPerformanceSummary = "";
  if (isLoadingPanelData && !isFetchingScheduledDates) { // Only show main loading if not also fetching schedule
    dayPerformanceSummary = `Loading performance data for ${displaySelectedDate}...`;
  } else if (panelError && (!matchup.team1Name || matchup.team1Name.toLowerCase() === "tbd" || !matchup.team2Name || matchup.team2Name.toLowerCase() === "tbd" )) {
    dayPerformanceSummary = panelError; // Show TBD error
  } else if (panelError) {
    dayPerformanceSummary = panelError; // Show other fetch errors
  } else if (isSelectedDateFutureForClient) {
    dayPerformanceSummary = "Data for future dates (relative to your system time) is not available.";
  } else if (seriesWinnerName && matchDailyResult) { 
     dayPerformanceSummary = `Match series concluded. Winner: ${seriesWinnerName}. Performance on ${displaySelectedDate} (${dailyMatchStatus || 'Status Unknown'}): `;
     if(dailyWinnerName) dayPerformanceSummary += `${dailyWinnerName} won.`; else if (dailyMatchStatus?.includes("Tie")) dayPerformanceSummary += `Tie.`; else dayPerformanceSummary += `Scores: ${team1Name} ${team1ScoreForDay} - ${team2Name} ${team2ScoreForDay}.`;
  } else if (!matchDailyResult || !matchDailyResult.exists) {
    dayPerformanceSummary = `No daily result record found for ${displaySelectedDate}. Submissions are assumed 0.`;
  } else if (dailyWinnerName) {
    dayPerformanceSummary = `${dailyWinnerName} won the battle on ${displaySelectedDate} (${dailyMatchStatus || 'Status Unknown'})!`;
  } else if (dailyMatchStatus?.includes("Tie") || (team1ScoreForDay === team2ScoreForDay && team1ScoreForDay >= 0) ) {
    dayPerformanceSummary = `It was a tie on ${displaySelectedDate} (${team1ScoreForDay}-${team2ScoreForDay}). Status: ${dailyMatchStatus || 'Status Unknown'}`;
  } else if (team1ScoreForDay === 0 && team2ScoreForDay === 0 && isBefore(selectedDateInternal, startOfDay(new Date()))) {
    dayPerformanceSummary = `No submissions recorded for either team on ${displaySelectedDate}.`;
  } else if (team1ScoreForDay === 0 && team2ScoreForDay === 0) { // Current day, no scores yet
    dayPerformanceSummary = `Awaiting submissions for ${displaySelectedDate}.`;
  } else {
     dayPerformanceSummary = `Performance for ${displaySelectedDate}: ${dailyMatchStatus || "Status Unknown"}`;
  }

  console.log(`[PanelRender] Rendering panel. isOpen: ${isOpen}, M_ID: ${matchup.id}, isLoadingData: ${isLoadingPanelData}, isFetchingSchedule: ${isFetchingScheduledDates}, panelError: ${panelError}, DailyResult:`, matchDailyResult, "DaySummary:", dayPerformanceSummary, "SelectedDate:", formattedSelectedDate);

  const renderEntryList = (entries: PanelEntry[], teamDisplayName: string | null) => {
    const actualTeamName = teamDisplayName || "this team";
    if (isLoadingPanelData) return <p className="text-sm text-muted-foreground italic">Loading entries...</p>;
    
    if (isSelectedDateFutureForClient) {
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
  
  const isCalendarButtonDisabled = isFetchingScheduledDates || isLoadingPanelData || (team1Name?.toLowerCase() === 'tbd' || team2Name?.toLowerCase() === 'tbd');
  let calendarButtonTitle = "Select date";
  if (isFetchingScheduledDates) calendarButtonTitle = "Loading match schedule...";
  else if (team1Name?.toLowerCase() === 'tbd' || team2Name?.toLowerCase() === 'tbd') calendarButtonTitle = "Date selection disabled until teams are determined";


  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl overflow-y-auto">
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
                Performance for: {isFetchingScheduledDates ? <Loader2 className="inline h-5 w-5 animate-spin" /> : displaySelectedDate}
              </h3>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className="w-full sm:w-auto bg-input hover:bg-accent/20"
                    disabled={isCalendarButtonDisabled}
                    title={calendarButtonTitle}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {isFetchingScheduledDates ? "Loading Dates..." : displaySelectedDate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDateInternal}
                    onSelect={(date) => {
                        if (date) {
                            console.log("[PanelCalendar] Date selected from picker:", date);
                            setSelectedDateInternal(startOfDay(date));
                        }
                    }}
                    disabled={(date) => {
                      if (isFetchingScheduledDates || !matchScheduledDates || matchScheduledDates.length === 0) {
                        return true; 
                      }
                      const dateString = format(date, 'yyyy-MM-dd');
                      const isThisDateScheduledForThisMatch = matchScheduledDates.includes(dateString);
                
                      if (!isThisDateScheduledForThisMatch) {
                        return true; 
                      }
                      return isAfter(startOfDay(date), startOfDay(new Date()));
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            {(isLoadingPanelData && !isFetchingScheduledDates) && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading daily stats for {displaySelectedDate}...</p>
              </div>
            )}
             {isFetchingScheduledDates && (
                 <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-3 text-muted-foreground">Loading match schedule...</p>
                 </div>
            )}


            {!isLoadingPanelData && !isFetchingScheduledDates && panelError && (
              <div className="text-destructive p-4 bg-destructive/10 rounded-md flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2"/> {panelError}
              </div>
            )}
            
            {!isLoadingPanelData && !isFetchingScheduledDates && !panelError && isSelectedDateFutureForClient && (
               <div className="text-blue-600 dark:text-blue-400 p-4 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center border border-blue-300 dark:border-blue-700">
                 <Info className="h-5 w-5 mr-2 text-blue-500 dark:text-blue-400"/> Data for future dates (relative to your system time) is not available.
               </div>
            )}
             {!isLoadingPanelData && !isFetchingScheduledDates && !panelError && !isSelectedDateFutureForClient && 
              (team1Name?.toLowerCase() === 'tbd' || team2Name?.toLowerCase() === 'tbd') && (
                 <div className="text-orange-600 dark:text-orange-400 p-4 bg-orange-100 dark:bg-orange-900/30 rounded-md flex items-center border border-orange-300 dark:border-orange-700">
                    <Info className="h-5 w-5 mr-2 text-orange-500 dark:text-orange-400"/> Teams for this matchup are not yet determined. Daily stats will be shown once teams are set.
                 </div>
            )}


            {!isLoadingPanelData && !isFetchingScheduledDates && !panelError && !isSelectedDateFutureForClient && 
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
    
