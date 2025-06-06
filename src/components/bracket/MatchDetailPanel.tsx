
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Matchup as MatchupType, SheetRow, GetMatchDailyResultOutput as MatchDailyResultType, GetMatchScheduledDatesOutput } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, BarChart3, ListChecks, Trophy, AlertTriangle, Info } from 'lucide-react';
import { format, startOfDay, isEqual, isBefore, isAfter, parseISO, isValid } from 'date-fns';
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
  
  useEffect(() => {
    if (isOpen && matchup && tournamentId && matchup.roundId) {
      console.log(`[PanelEffect ScheduledDates Trigger] Fetching for T:${tournamentId}, R:${matchup.roundId}, M:${matchup.id}`);
      setIsFetchingScheduledDates(true);
      setMatchScheduledDates(null); 

      getMatchScheduledDates({ tournamentId, roundNum: matchup.roundId, matchId: matchup.id })
        .then(dates => {
          console.log(`[PanelEffect ScheduledDates SUCCESS] M:${matchup.id}. Dates:`, JSON.stringify(dates));
          setMatchScheduledDates(dates);
        })
        .catch(err => {
          console.error(`[PanelEffect ScheduledDates ERROR] M:${matchup.id}:`, err);
          toast({ title: "Error", description: "Could not load match schedule dates.", variant: "destructive" });
          setMatchScheduledDates([]); 
        })
        .finally(() => {
          setIsFetchingScheduledDates(false);
          console.log(`[PanelEffect ScheduledDates FINALLY] M:${matchup.id}. isFetchingScheduledDates set to false.`);
        });
    } else if (!isOpen) {
      setMatchScheduledDates(null);
      setIsFetchingScheduledDates(true); 
      setSelectedDateInternal(startOfDay(new Date())); 
      console.log("[PanelEffect ScheduledDates] Panel closed. Reset states.");
    }
  }, [isOpen, matchup, tournamentId, toast]);

  useEffect(() => {
    console.log(`[PanelEffect InitialDate Trigger] M:${matchup?.id}, isFetchingScheduledDates: ${isFetchingScheduledDates}, matchScheduledDates:`, JSON.stringify(matchScheduledDates));
    if (isFetchingScheduledDates || !matchup) {
      console.log(`[PanelEffect InitialDate] Waiting for schedule or matchup.`);
      return; 
    }
  
    let newSelectedDateCandidate: Date | null = null;
    const clientToday = startOfDay(new Date());
  
    if (matchScheduledDates && matchScheduledDates.length > 0) {
      const validNonFutureScheduledDates = matchScheduledDates
        .map(dStr => parseISO(dStr)) 
        .filter(d => isValid(d) && !isAfter(d, clientToday))
        .sort((a, b) => b.getTime() - a.getTime()); 
  
      console.log(`[PanelEffect InitialDate] M:${matchup.id}. Client Today: ${format(clientToday, 'yyyy-MM-dd')}`);
      console.log(`[PanelEffect InitialDate] M:${matchup.id}. All fetched scheduled:`, matchScheduledDates.map(d => format(parseISO(d), 'yyyy-MM-dd')));
      console.log(`[PanelEffect InitialDate] M:${matchup.id}. Valid non-future scheduled:`, validNonFutureScheduledDates.map(d => format(d, 'yyyy-MM-dd')));

      if (validNonFutureScheduledDates.some(d => isEqual(d, clientToday))) {
        newSelectedDateCandidate = clientToday;
        console.log(`[PanelEffect InitialDate] M:${matchup.id}. Case 1: Today is valid. Set to: ${format(newSelectedDateCandidate, 'yyyy-MM-dd')}`);
      } else if (validNonFutureScheduledDates.length > 0) {
        newSelectedDateCandidate = validNonFutureScheduledDates[0]; 
        console.log(`[PanelEffect InitialDate] M:${matchup.id}. Case 2: Today not valid. Set to latest past/present: ${format(newSelectedDateCandidate, 'yyyy-MM-dd')}`);
      } else { 
        const sortedFutureScheduledDates = matchScheduledDates.map(dStr => parseISO(dStr)).filter(isValid).sort((a, b) => a.getTime() - b.getTime());
        if (sortedFutureScheduledDates.length > 0) {
          newSelectedDateCandidate = sortedFutureScheduledDates[0];
          console.log(`[PanelEffect InitialDate] M:${matchup.id}. Case 3: All scheduled are future. Set to earliest: ${format(newSelectedDateCandidate, 'yyyy-MM-dd')}`);
        }
      }
    } else {
        console.log(`[PanelEffect InitialDate] M:${matchup.id}. No matchScheduledDates found or empty. Fallback logic will apply.`);
    }
    
    if (!newSelectedDateCandidate || !isValid(newSelectedDateCandidate)) {
        newSelectedDateCandidate = clientToday; 
        console.log(`[PanelEffect InitialDate] M:${matchup.id}. Fallback or invalid candidate. Set to client's today: ${format(newSelectedDateCandidate, 'yyyy-MM-dd')}`);
    }

    const newDateStartOfDay = startOfDay(newSelectedDateCandidate);
    if (!isEqual(newDateStartOfDay, selectedDateInternal)) {
      console.log(`[PanelEffect InitialDate Finalizing] M:${matchup.id}. Setting selectedDateInternal to: ${format(newDateStartOfDay, 'yyyy-MM-dd')}`);
      setSelectedDateInternal(newDateStartOfDay);
    } else {
      console.log(`[PanelEffect InitialDate NoChange] M:${matchup.id}. selectedDateInternal already: ${format(selectedDateInternal, 'yyyy-MM-dd')}`);
    }
  }, [matchScheduledDates, isFetchingScheduledDates, matchup]); 


  const fetchPanelData = useCallback(async () => {
    if (!isOpen || !matchup || !tournamentId || !matchup.roundId) {
      console.error("[PanelFetch ABORT] Critical data incomplete.", {isOpen, matchupId: matchup?.id, tournamentId, roundId: matchup?.roundId});
      setPanelError("Matchup data incomplete for details.");
      if (isLoadingPanelData) setIsLoadingPanelData(false);
      return;
    }
    
    if (!matchup.team1Name || matchup.team1Name.toLowerCase() === "tbd" || 
        !matchup.team2Name || matchup.team2Name.toLowerCase() === "tbd") {
      console.log(`[PanelFetch ABORT] Teams TBD for M:${matchup.id}.`);
      setPanelError("Teams for this matchup are not yet determined.");
      setMatchDailyResult(null); setTeam1Entries([]); setTeam2Entries([]);
      if (isLoadingPanelData) setIsLoadingPanelData(false);
      return;
    }

    console.log(`[PanelFetch INITIATE] M_ID: ${matchup.id} (R:${matchup.roundId}) (${matchup.team1Name} vs ${matchup.team2Name}) on D:${formattedSelectedDate} for T:${tournamentId}`);
    setIsLoadingPanelData(true);
    setPanelError(null);
    setMatchDailyResult(null); setTeam1Entries([]); setTeam2Entries([]);

    try {
      console.log(`[PanelFetch CALLING] getMatchDailyResult for M:${matchup.id} D:${formattedSelectedDate}...`);
      const dailyResultDataPromise = getMatchDailyResult({ tournamentId, roundNum: matchup.roundId, matchId: matchup.id, targetDate: formattedSelectedDate });
      
      console.log(`[PanelFetch CALLING] getEntriesForTeamByDate for Team 1 ("${matchup.team1Name}") D:${formattedSelectedDate}...`);
      const entriesTeam1ResultPromise = getEntriesForTeamByDate({ targetDate: formattedSelectedDate, teamName: matchup.team1Name });
      
      console.log(`[PanelFetch CALLING] getEntriesForTeamByDate for Team 2 ("${matchup.team2Name}") D:${formattedSelectedDate}...`);
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

      console.log(`[PanelFetch RESULTS] M:${matchup.id} D:${formattedSelectedDate}:`);
      console.log(`  Daily Result:`, JSON.stringify(dailyResultData));
      console.log(`  Team 1 ("${matchup.team1Name}") Entries Count:`, entriesTeam1Result.length, `Sample:`, entriesTeam1Result.length > 0 ? JSON.stringify(entriesTeam1Result[0]) : 'N/A');
      console.log(`  Team 2 ("${matchup.team2Name}") Entries Count:`, entriesTeam2Result.length, `Sample:`, entriesTeam2Result.length > 0 ? JSON.stringify(entriesTeam2Result[0]) : 'N/A');

      setMatchDailyResult(dailyResultData);
      setTeam1Entries(entriesTeam1Result.map(entry => ({ id: entry.id, Agent: entry.Agent, INSURED_NAME: entry.INSURED_NAME, ProductType: entry.ProductType })));
      setTeam2Entries(entriesTeam2Result.map(entry => ({ id: entry.id, Agent: entry.Agent, INSURED_NAME: entry.INSURED_NAME, ProductType: entry.ProductType })));

    } catch (error) {
      console.error(`[PanelFetch ERROR] M:${matchup.id} D:${formattedSelectedDate}:`, error);
      setPanelError("Failed to load match details. Please try again.");
      toast({ title: "Error Loading Details", description: error instanceof Error ? error.message : "Could not fetch performance data.", variant: "destructive" });
    } finally {
      console.log(`[PanelFetch FINALLY] M:${matchup.id} D:${formattedSelectedDate}. Setting isLoadingPanelData to false.`);
      setIsLoadingPanelData(false);
    }
  }, [isOpen, matchup, tournamentId, formattedSelectedDate, toast, isLoadingPanelData]); 

  const isSelectedDateFutureForClient = useMemo(() => {
    const isFuture = isAfter(startOfDay(selectedDateInternal), startOfDay(new Date()));
    console.log(`[PanelMemo isSelectedDateFutureForClient] Date: ${format(selectedDateInternal, 'yyyy-MM-dd')} isFuture: ${isFuture}`);
    return isFuture;
  }, [selectedDateInternal]);

  useEffect(() => {
    console.log(`[PanelEffect DataTrigger] M_ID:${matchup?.id}, isOpen:${isOpen}, tournamentId:${!!tournamentId}, roundId:${!!matchup?.roundId}, team1Valid:${matchup?.team1Name && matchup.team1Name.toLowerCase() !== "tbd"}, team2Valid:${matchup?.team2Name && matchup.team2Name.toLowerCase() !== "tbd"}, selDate:${formattedSelectedDate}, isClientFuture:${isSelectedDateFutureForClient}`);
    
    if (isOpen && matchup && tournamentId && matchup.roundId && 
        matchup.team1Name && matchup.team1Name.toLowerCase() !== "tbd" && 
        matchup.team2Name && matchup.team2Name.toLowerCase() !== "tbd") {
      
      if (isSelectedDateFutureForClient) {
        console.log(`[PanelEffect DataTrigger] Selected D:${formattedSelectedDate} for M:${matchup.id} is future. Clearing data, not fetching.`);
        setPanelError(null); setMatchDailyResult(null); setTeam1Entries([]); setTeam2Entries([]);
        if (isLoadingPanelData) setIsLoadingPanelData(false); 
      } else {
        console.log(`[PanelEffect DataTrigger] Conditions met. Calling fetchPanelData for M:${matchup.id} on D:${formattedSelectedDate}.`);
        fetchPanelData();
      }

    } else if (isOpen && matchup) { 
      console.log(`[PanelEffect DataTrigger] Conditions for full fetch NOT met. M:${matchup?.id}, D:${formattedSelectedDate}. Clearing data.`);
      if (matchup.team1Name?.toLowerCase() === "tbd" || matchup.team2Name?.toLowerCase() === "tbd") {
        setPanelError("Teams for this matchup are not yet determined.");
      } else {
        setPanelError(null); 
      }
      setMatchDailyResult(null); setTeam1Entries([]); setTeam2Entries([]);
      if (isLoadingPanelData) setIsLoadingPanelData(false); 
    }
  }, [isOpen, matchup, tournamentId, formattedSelectedDate, isSelectedDateFutureForClient, fetchPanelData, isLoadingPanelData]);


  if (!matchup) {
    console.log("[PanelRender] No matchup data, rendering null.");
    return null;
  }

  const { team1Name, team2Name, team1DailyWins, team2DailyWins, seriesWinnerName } = matchup;
  
  const team1ScoreForDay = matchDailyResult?.exists ? matchDailyResult.team1Score : 0;
  const team2ScoreForDay = matchDailyResult?.exists ? matchDailyResult.team2Score : 0;
  const dailyWinnerName = matchDailyResult?.exists ? matchDailyResult.winner : null;
  const dailyMatchStatus = matchDailyResult?.exists ? matchDailyResult.status : "Awaiting Data";


  let dayPerformanceSummary = "";
  if (isLoadingPanelData && !isFetchingScheduledDates) { 
    dayPerformanceSummary = `Loading performance data for ${displaySelectedDate}...`;
  } else if (panelError && (!matchup.team1Name || matchup.team1Name.toLowerCase() === "tbd" || !matchup.team2Name || matchup.team2Name.toLowerCase() === "tbd" )) {
    dayPerformanceSummary = panelError; 
  } else if (panelError) {
    dayPerformanceSummary = panelError; 
  } else if (isSelectedDateFutureForClient) {
    dayPerformanceSummary = "Data for future dates (relative to your system time) is not available.";
  } else if (seriesWinnerName && matchDailyResult) { 
     dayPerformanceSummary = `Match series concluded. Winner: ${seriesWinnerName}. Performance on ${displaySelectedDate} (${dailyMatchStatus || 'Status Unknown'}): `;
     if(dailyWinnerName) dayPerformanceSummary += `${dailyWinnerName} won.`; else if (dailyMatchStatus?.includes("Tie")) dayPerformanceSummary += `Tie.`; else dayPerformanceSummary += `Scores: ${team1Name} ${team1ScoreForDay} - ${team2Name} ${team2ScoreForDay}.`;
  } else if (!matchDailyResult || !matchDailyResult.exists) {
    dayPerformanceSummary = `No daily result record found for ${displaySelectedDate}. Submissions via Sheet1Rows are displayed below if any.`;
  } else if (dailyWinnerName) {
    dayPerformanceSummary = `${dailyWinnerName} won the battle on ${displaySelectedDate} (${dailyMatchStatus || 'Status Unknown'})! Score: ${team1ScoreForDay}-${team2ScoreForDay}.`;
  } else if (dailyMatchStatus?.includes("Tie") || (team1ScoreForDay === team2ScoreForDay && team1ScoreForDay >= 0) ) {
    dayPerformanceSummary = `It was a tie on ${displaySelectedDate} (${team1ScoreForDay}-${team2ScoreForDay}). Status: ${dailyMatchStatus || 'Status Unknown'}`;
  } else if (team1ScoreForDay === 0 && team2ScoreForDay === 0 && isBefore(selectedDateInternal, startOfDay(new Date()))) {
    dayPerformanceSummary = `No submissions recorded for either team via dailyResults on ${displaySelectedDate}. Check Sheet1Rows entries below.`;
  } else if (team1ScoreForDay === 0 && team2ScoreForDay === 0) { 
    dayPerformanceSummary = `Awaiting submissions via dailyResults for ${displaySelectedDate}. Check Sheet1Rows entries below.`;
  } else {
     dayPerformanceSummary = `Performance for ${displaySelectedDate}: ${dailyMatchStatus || "Status Unknown"}. Score: ${team1Name} ${team1ScoreForDay} - ${team2Name} ${team2ScoreForDay}.`;
  }

  console.log(`[PanelRender] M_ID: ${matchup.id}, isLoadingData: ${isLoadingPanelData}, isFetchingSchedule: ${isFetchingScheduledDates}, panelError: ${panelError}, DailyResult:`, JSON.stringify(matchDailyResult), "DaySummary:", dayPerformanceSummary, "SelDate:", formattedSelectedDate);

  const renderEntryList = (entries: PanelEntry[], teamDisplayName: string | null) => {
    const actualTeamName = teamDisplayName || "this team";
    if (isLoadingPanelData && !isFetchingScheduledDates) return <p className="text-sm text-muted-foreground italic">Loading entries for {actualTeamName}...</p>;
    
    if (isSelectedDateFutureForClient) {
      return <p className="text-sm text-muted-foreground italic">Entries for future dates are not shown.</p>;
    }
    if (matchup.team1Name?.toLowerCase() === 'tbd' || matchup.team2Name?.toLowerCase() === 'tbd') {
         return <p className="text-sm text-muted-foreground italic">Team not determined, entries cannot be displayed.</p>;
    }
    if (entries.length === 0 && !isLoadingPanelData) { 
      return <p className="text-sm text-muted-foreground italic">No "Submitted" entries found for {actualTeamName} in Sheet1Rows on {displaySelectedDate}.</p>;
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
  else if (isLoadingPanelData) calendarButtonTitle = "Loading daily data...";
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
                    {isFetchingScheduledDates ? "Loading Dates..." : (isLoadingPanelData ? "Loading Data..." : displaySelectedDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDateInternal}
                    onSelect={(date) => {
                        if (date) {
                            const newSelectedDate = startOfDay(date)
                            console.log("[PanelCalendar] Date selected from picker:", format(newSelectedDate, 'yyyy-MM-dd'));
                            setSelectedDateInternal(newSelectedDate);
                        }
                    }}
                    disabled={(date) => {
                      const clientToday = startOfDay(new Date());
                      const dateToCheck = startOfDay(date);
                      const dateString = format(dateToCheck, 'yyyy-MM-dd');

                      if (isFetchingScheduledDates || !matchScheduledDates) {
                        // console.log(`[CalendarDisabled] Date ${dateString}: Disabled because schedule fetching (${isFetchingScheduledDates}) or no schedule array.`);
                        return true; 
                      }
                      if (matchScheduledDates.length === 0) {
                        //  console.log(`[CalendarDisabled] Date ${dateString}: Disabled because matchScheduledDates is empty.`);
                         return true;
                      }

                      const isThisDateScheduledForThisMatch = matchScheduledDates.includes(dateString);
                      if (!isThisDateScheduledForThisMatch) {
                        // console.log(`[CalendarDisabled] Date ${dateString}: Disabled (not in [${matchScheduledDates.join(', ')}])`);
                        return true; 
                      }
                      
                      const isFutureForClient = isAfter(dateToCheck, clientToday);
                      if (isFutureForClient) {
                        // console.log(`[CalendarDisabled] Date ${dateString}: Disabled (future for client: ${format(clientToday, 'yyyy-MM-dd')}).`);
                        return true;
                      }
                      // console.log(`[CalendarDisabled] Date ${dateString}: ENABLED.`);
                      return false;
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
                        <p className="text-sm text-muted-foreground">{team1Name} Submissions (from DailyResult)</p>
                      </div>
                      <div>
                        <p className="text-4xl font-bold font-headline text-primary">{team2ScoreForDay}</p>
                        <p className="text-sm text-muted-foreground">{team2Name} Submissions (from DailyResult)</p>
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
                        <ListChecks className="mr-2 h-5 w-5 text-primary" /> {team1Name} - Contributing Entries (Sheet1Rows)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {renderEntryList(team1Entries, team1Name)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-md flex items-center">
                        <ListChecks className="mr-2 h-5 w-5 text-primary" /> {team2Name} - Contributing Entries (Sheet1Rows)
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
    
