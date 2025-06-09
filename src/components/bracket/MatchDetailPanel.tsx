
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Matchup as MatchupType, SheetRow, GetMatchDailyResultOutput as MatchDailyResultType, GetMatchScheduledDatesOutput } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, BarChart3, ListChecks, Trophy, AlertTriangle, Info, Award, Star, Sigma, Users } from 'lucide-react';
import { format, startOfDay, isEqual, isAfter, parseISO, isValid } from 'date-fns';
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

interface TeamTopPerformer {
  name: string;
  count: number;
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
  
  const [topPerformerTeam1, setTopPerformerTeam1] = useState<TeamTopPerformer | null>(null);
  const [topPerformerTeam2, setTopPerformerTeam2] = useState<TeamTopPerformer | null>(null);

  const { toast } = useToast();

  const formattedSelectedDate = useMemo(() => {
    return format(selectedDateInternal, 'yyyy-MM-dd');
  }, [selectedDateInternal]);

  const displaySelectedDate = useMemo(() => selectedDateInternal ? format(selectedDateInternal, 'PPP') : "Select Date", [selectedDateInternal]);

  // Effect to reset states when the panel is closed OR when the matchup ID changes while the panel is open.
  useEffect(() => {
    if (!isOpen) {
      console.log("[PanelEffect isOpen=false] Panel closed. Full reset.");
      setSelectedDateInternal(startOfDay(new Date()));
      setMatchScheduledDates(null);
      setIsFetchingScheduledDates(true); // Reset to true so it fetches on next open
      setIsLoadingPanelData(false);
      setPanelError(null);
      setMatchDailyResult(null);
      setTeam1Entries([]);
      setTeam2Entries([]);
      setTopPerformerTeam1(null);
      setTopPerformerTeam2(null);
      return;
    }

    // This part runs if isOpen is true. We check if matchup.id has changed.
    // The dependency array [isOpen, matchup?.id] ensures this runs on open or if ID changes.
    if (matchup) {
      console.log(`[PanelEffect MatchID Change/Open] New/current matchup ID: ${matchup.id}. Resetting panel states for new match data load.`);
      // Reset date to a default to allow recalculation based on new match's schedule.
      // The effect for setting initial date will refine this.
      setSelectedDateInternal(startOfDay(new Date())); 

      // Reset data states
      setMatchDailyResult(null);
      setTeam1Entries([]);
      setTeam2Entries([]);
      setTopPerformerTeam1(null);
      setTopPerformerTeam2(null);
      setPanelError(null);
      
      // Reset schedule fetching states to trigger refetch for new match
      setMatchScheduledDates(null);
      setIsFetchingScheduledDates(true); // Trigger schedule fetch effect

      // Indicate that we are now loading data for this new/current match
      setIsLoadingPanelData(true); 
    }
  }, [isOpen, matchup?.id]); // Key: This effect depends on matchup.id to detect change in viewed match

  // Effect to fetch the specific scheduled dates for this match (runs after ID change reset)
  useEffect(() => {
    console.log(`[PanelEffect ScheduledDates Trigger] isOpen: ${isOpen}, matchupId: ${matchup?.id}, isFetchingScheduledDates: ${isFetchingScheduledDates}`);
    if (isOpen && matchup && tournamentId && matchup.roundId && isFetchingScheduledDates) {
      console.log(`[PanelEffect ScheduledDates CALLING] Fetching for T:${tournamentId}, R:${matchup.roundId}, M:${matchup.id}`);
      
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
          console.log(`[PanelEffect ScheduledDates FINALLY] M:${matchup.id}. isFetchingScheduledDates set to false.`);
          setIsFetchingScheduledDates(false);
        });
    } else if (isOpen && matchup && !isFetchingScheduledDates) {
        // This case means schedule was already fetched (or attempted) for current matchup.id
        console.log(`[PanelEffect ScheduledDates] Schedule already processed for M:${matchup.id}. isFetchingScheduledDates is false.`);
    }
  }, [isOpen, matchup, tournamentId, isFetchingScheduledDates, toast]); // isFetchingScheduledDates is a key dependency here

  // Effect to set initial selectedDateInternal based on fetched scheduled dates and client's current date
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

      if (validNonFutureScheduledDates.some(d => isEqual(d, clientToday))) {
        newSelectedDateCandidate = clientToday;
      } else if (validNonFutureScheduledDates.length > 0) {
        newSelectedDateCandidate = validNonFutureScheduledDates[0]; 
      } else { 
        const sortedFutureScheduledDates = matchScheduledDates.map(dStr => parseISO(dStr)).filter(isValid).sort((a,b) => a.getTime() - b.getTime());
        if (sortedFutureScheduledDates.length > 0) {
          newSelectedDateCandidate = sortedFutureScheduledDates[0]; 
        }
      }
    }
    
    if (!newSelectedDateCandidate || !isValid(newSelectedDateCandidate)) {
        newSelectedDateCandidate = clientToday; 
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
    if (!isOpen || !matchup || !tournamentId || !matchup.roundId || !selectedDateInternal) {
      console.error("[PanelFetch ABORT] Critical data incomplete.", { isOpen, matchupId: matchup?.id, tournamentId, roundId: matchup?.roundId, selectedDateInternal });
      setPanelError("Matchup data incomplete for details.");
      if(isLoadingPanelData) setIsLoadingPanelData(false); // Ensure loading stops if aborted early
      return;
    }

    if (!matchup.team1Name || matchup.team1Name.toLowerCase() === "tbd" ||
        !matchup.team2Name || matchup.team2Name.toLowerCase() === "tbd") {
      console.log(`[PanelFetch ABORT] Teams TBD for M:${matchup.id}.`);
      setPanelError("Teams for this matchup are not yet determined.");
      // Data states (matchDailyResult, entries) should have been cleared by matchup.id effect
      if(isLoadingPanelData) setIsLoadingPanelData(false); // Stop loading indicator
      return;
    }
    const currentFormattedDate = format(selectedDateInternal, 'yyyy-MM-dd');
    console.log(`[PanelFetch INITIATE] M_ID: ${matchup.id} (R:${matchup.roundId}) (${matchup.team1Name} vs ${matchup.team2Name}) on D:${currentFormattedDate} for T:${tournamentId}`);
    
    // isLoadingPanelData should already be true from the matchup.id change effect
    // If not, it means this fetch is for a date change, so set it.
    if (!isLoadingPanelData) setIsLoadingPanelData(true);
    setPanelError(null); // Clear previous errors for new fetch
    // Clear specific data being fetched - this is crucial if only date changes
    setMatchDailyResult(null); setTeam1Entries([]); setTeam2Entries([]); 
    setTopPerformerTeam1(null); setTopPerformerTeam2(null);


    try {
      console.log(`[PanelFetch CALLING] getMatchDailyResult for M:${matchup.id} D:${currentFormattedDate}...`);
      const dailyResultDataPromise = getMatchDailyResult({ tournamentId, roundNum: matchup.roundId, matchId: matchup.id, targetDate: currentFormattedDate });
      
      let entriesTeam1ResultPromise: Promise<SheetRow[]> = Promise.resolve([]);
      if (matchup.team1Name && matchup.team1Name.toLowerCase() !== "tbd") {
        console.log(`[PanelFetch CALLING] getEntriesForTeamByDate for Team 1 ("${matchup.team1Name}") D:${currentFormattedDate}...`);
        entriesTeam1ResultPromise = getEntriesForTeamByDate({ targetDate: currentFormattedDate, teamName: matchup.team1Name });
      }

      let entriesTeam2ResultPromise: Promise<SheetRow[]> = Promise.resolve([]);
      if (matchup.team2Name && matchup.team2Name.toLowerCase() !== "tbd") {
        console.log(`[PanelFetch CALLING] getEntriesForTeamByDate for Team 2 ("${matchup.team2Name}") D:${currentFormattedDate}...`);
        entriesTeam2ResultPromise = getEntriesForTeamByDate({ targetDate: currentFormattedDate, teamName: matchup.team2Name });
      }

      const [
        dailyResultData,
        entriesTeam1Result,
        entriesTeam2Result
      ] = await Promise.all([
        dailyResultDataPromise,
        entriesTeam1ResultPromise,
        entriesTeam2ResultPromise
      ]);
      
      setMatchDailyResult(dailyResultData);
      const panelEntriesTeam1 = entriesTeam1Result.map(entry => ({ id: entry.id, Agent: entry.Agent, INSURED_NAME: entry.INSURED_NAME, ProductType: entry.ProductType }));
      const panelEntriesTeam2 = entriesTeam2Result.map(entry => ({ id: entry.id, Agent: entry.Agent, INSURED_NAME: entry.INSURED_NAME, ProductType: entry.ProductType }));
      setTeam1Entries(panelEntriesTeam1);
      setTeam2Entries(panelEntriesTeam2);

    } catch (error) {
      console.error(`[PanelFetch ERROR] M:${matchup.id} D:${currentFormattedDate}:`, error);
      setPanelError("Failed to load match details. Please try again.");
      toast({ title: "Error Loading Details", description: error instanceof Error ? error.message : "Could not fetch performance data.", variant: "destructive" });
    } finally {
      console.log(`[PanelFetch FINALLY] M:${matchup.id} D:${currentFormattedDate}. Setting isLoadingPanelData to false.`);
      setIsLoadingPanelData(false);
    }
  }, [isOpen, matchup, tournamentId, selectedDateInternal, toast, isLoadingPanelData]); // Added isLoadingPanelData to deps of useCallback


  // Effect to fetch main panel data when inputs change
  useEffect(() => {
    console.log(`[PanelEffect DataTrigger] M_ID:${matchup?.id}, isOpen:${isOpen}, tournamentId:${!!tournamentId}, roundId:${!!matchup?.roundId}, team1Valid:${matchup?.team1Name && matchup.team1Name.toLowerCase() !== "tbd"}, team2Valid:${matchup?.team2Name && matchup.team2Name.toLowerCase() !== "tbd"}, selDate:${formattedSelectedDate}, isFetchingScheduledDates: ${isFetchingScheduledDates}`);

    if (
      isOpen &&
      matchup && // This is the prop
      tournamentId &&
      matchup.roundId &&
      matchup.team1Name && matchup.team1Name.toLowerCase() !== "tbd" &&
      matchup.team2Name && matchup.team2Name.toLowerCase() !== "tbd" &&
      selectedDateInternal &&
      !isFetchingScheduledDates // Ensure schedule is processed before fetching data for a date
    ) {
        console.log(`[PanelEffect DataTrigger] Conditions met. Calling fetchPanelData for M:${matchup.id} on D:${formattedSelectedDate}.`);
        fetchPanelData();
    } else if (isOpen && matchup && (matchup.team1Name?.toLowerCase() === "tbd" || matchup.team2Name?.toLowerCase() === "tbd")) {
      console.log(`[PanelEffect DataTrigger] Teams TBD for M:${matchup?.id}. Setting panelError and stopping load.`);
      setPanelError("Teams for this matchup are not yet determined.");
      setIsLoadingPanelData(false); // Ensure loading stops
      // Data states should have been cleared by the matchup.id effect
      setMatchDailyResult(null); setTeam1Entries([]); setTeam2Entries([]); 
      setTopPerformerTeam1(null); setTopPerformerTeam2(null);
    } else if (isOpen && matchup && isFetchingScheduledDates) {
        console.log(`[PanelEffect DataTrigger] Waiting for schedule to be fetched for M:${matchup.id}`);
        // Data cleared by matchup.id effect, isLoadingPanelData is true. Waiting for schedule.
    }
  }, [isOpen, matchup, tournamentId, selectedDateInternal, formattedSelectedDate, fetchPanelData, isFetchingScheduledDates]);

  // Effect to calculate top performers for each team
  useEffect(() => {
    const calculateTopPerformers = (entries: PanelEntry[]): TeamTopPerformer | null => {
      if (entries.length === 0) return null;
      const agentCounts: Map<string, number> = new Map();
      entries.forEach(entry => {
        if (entry.Agent) {
          agentCounts.set(entry.Agent, (agentCounts.get(entry.Agent) || 0) + 1);
        }
      });
      if (agentCounts.size === 0) return null;
      let topAgent: TeamTopPerformer = { name: 'N/A', count: 0 };
      let foundAgent = false;
      agentCounts.forEach((count, name) => {
        if (count > topAgent.count) {
          topAgent = { name, count };
          foundAgent = true;
        } else if (count === topAgent.count && !foundAgent) {
            topAgent = { name, count };
            foundAgent = true;
        }
      });
      return foundAgent ? topAgent : null;
    };

    if (matchup?.team1Name && matchup.team1Name.toLowerCase() !== "tbd") {
      setTopPerformerTeam1(calculateTopPerformers(team1Entries));
    } else {
      setTopPerformerTeam1(null);
    }

    if (matchup?.team2Name && matchup.team2Name.toLowerCase() !== "tbd") {
      setTopPerformerTeam2(calculateTopPerformers(team2Entries));
    } else {
      setTopPerformerTeam2(null);
    }
  }, [team1Entries, team2Entries, matchup]);


  if (!matchup) {
    return null;
  }

  const { team1Name, team2Name, team1DailyWins, team2DailyWins, seriesWinnerName } = matchup;

  const team1ScoreForDay = matchDailyResult?.exists ? matchDailyResult.team1Score : 0;
  const team2ScoreForDay = matchDailyResult?.exists ? matchDailyResult.team2Score : 0;
  const dailyWinnerName = matchDailyResult?.exists ? matchDailyResult.winner : null;
  const dailyMatchStatus = matchDailyResult?.exists ? matchDailyResult.status : "Awaiting Data";

  let dayPerformanceSummary = "";

  if (isLoadingPanelData && selectedDateInternal) { // Display loading only if a date is selected
    dayPerformanceSummary = `Loading performance data for ${displaySelectedDate}...`;
  } else if (panelError) { // This includes "Teams TBD"
    dayPerformanceSummary = panelError;
  } else if (!matchDailyResult || !matchDailyResult.exists) {
    dayPerformanceSummary = `No official daily result record found for ${displaySelectedDate}. Submitted entries via Sheet1Rows (if any) are displayed below.`;
  } else { 
    const diff = Math.abs(team1ScoreForDay - team2ScoreForDay);
     const team1Display = matchDailyResult.team1Name || team1Name || "Team 1";
     const team2Display = matchDailyResult.team2Name || team2Name || "Team 2";

    if (seriesWinnerName) { 
        dayPerformanceSummary = `Series Winner: ${seriesWinnerName}. On ${displaySelectedDate} (${dailyMatchStatus || 'Status Unknown'}): `;
        if(dailyWinnerName) dayPerformanceSummary += `${dailyWinnerName} won.`; else if (dailyMatchStatus?.includes("Tie")) dayPerformanceSummary += `Tie.`; else dayPerformanceSummary += `Scores: ${team1Display} ${team1ScoreForDay} - ${team2Display} ${team2ScoreForDay}.`;
    } else { 
        if (team1ScoreForDay > team2ScoreForDay) {
          dayPerformanceSummary = `${team1Display} won the day with ${team1ScoreForDay} submissions, leading by ${diff} over ${team2Display}'s ${team2ScoreForDay}. Status: ${dailyMatchStatus || 'Completed'}.`;
        } else if (team2ScoreForDay > team1ScoreForDay) {
          dayPerformanceSummary = `${team2Display} won the day with ${team2ScoreForDay} submissions, leading by ${diff} over ${team1Display}'s ${team1ScoreForDay}. Status: ${dailyMatchStatus || 'Completed'}.`;
        } else if (team1ScoreForDay === team2ScoreForDay && team1ScoreForDay > 0) {
          dayPerformanceSummary = `It was a tie on ${displaySelectedDate} with ${team1ScoreForDay} submissions each! Status: ${dailyMatchStatus || 'Completed - Tie'}.`;
        } else { 
          dayPerformanceSummary = `Awaiting submissions or no submissions recorded in dailyResults for ${displaySelectedDate}. Status: ${dailyMatchStatus || 'Scheduled'}.`;
        }
    }
  }
  
  const renderEntryList = (entries: PanelEntry[], teamDisplayName: string | null) => {
    const actualTeamName = teamDisplayName || "this team";
    if (isLoadingPanelData && selectedDateInternal) return <p className="text-sm text-muted-foreground italic">Loading entries for {actualTeamName}...</p>;

    if (matchup.team1Name?.toLowerCase() === 'tbd' || matchup.team2Name?.toLowerCase() === 'tbd') {
         return <p className="text-sm text-muted-foreground italic">Team not determined, entries cannot be displayed.</p>;
    }
    if (entries.length === 0 && !isLoadingPanelData) {
      return <p className="text-sm text-muted-foreground italic">No "Submitted" entries found for {actualTeamName} in Sheet1Rows on {displaySelectedDate}.</p>;
    }

    return (
      <ul className="space-y-2 max-h-28 overflow-y-auto pr-2">
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
            Daily performance and contributing entries for this matchup. Overall series score is based on daily wins.
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
                Details for: {(isFetchingScheduledDates || (isLoadingPanelData && !selectedDateInternal && !panelError)) ? <Loader2 className="inline h-5 w-5 animate-spin" /> : displaySelectedDate}
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
                            const newSelectedDate = startOfDay(date);
                            if (!isEqual(newSelectedDate, selectedDateInternal)) {
                                setSelectedDateInternal(newSelectedDate);
                            }
                        }
                    }}
                    disabled={(date) => {
                      const dateToCheck = startOfDay(date);
                      const dateString = format(dateToCheck, 'yyyy-MM-dd');
                      if (isFetchingScheduledDates) return true;
                      if (!matchScheduledDates || matchScheduledDates.length === 0) return true; 
                      return !matchScheduledDates.includes(dateString);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {(isFetchingScheduledDates || (isLoadingPanelData && !panelError && selectedDateInternal)) && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">
                  {isFetchingScheduledDates ? "Loading match schedule..." : `Loading daily stats for ${displaySelectedDate}...`}
                </p>
              </div>
            )}
            
            {!isLoadingPanelData && !isFetchingScheduledDates && panelError && (
              <div className="text-destructive p-4 bg-destructive/10 rounded-md flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2"/> {panelError}
              </div>
            )}

            {!isLoadingPanelData && !isFetchingScheduledDates && !panelError &&
             (team1Name && team1Name.toLowerCase() !== 'tbd' && team2Name && team2Name.toLowerCase() !== 'tbd') && (
              <>
                <Card className="mb-4 bg-secondary/30">
                  <CardHeader>
                     <CardTitle className="text-md">Daily Battle: {displaySelectedDate}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-center mb-3">
                      <div>
                        <p className="text-4xl font-bold font-headline text-primary">{team1ScoreForDay}</p>
                        <p className="text-sm text-muted-foreground">{matchDailyResult?.team1Name || team1Name} (from DailyResult)</p>
                      </div>
                      <div>
                        <p className="text-4xl font-bold font-headline text-primary">{team2ScoreForDay}</p>
                        <p className="text-sm text-muted-foreground">{matchDailyResult?.team2Name || team2Name} (from DailyResult)</p>
                      </div>
                    </div>
                    <p className="text-center font-semibold text-foreground/90 text-sm">
                      {dayPerformanceSummary}
                    </p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{(matchDailyResult?.team1Name || team1Name || "Team 1")} - Top Performer</CardTitle>
                      <Star className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                      {topPerformerTeam1 ? (
                        <>
                          <div className="text-2xl font-bold">{topPerformerTeam1.name}</div>
                          <p className="text-xs text-muted-foreground">
                            {topPerformerTeam1.count} submission(s)
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">No submissions found for {(matchDailyResult?.team1Name || team1Name || "Team 1")}.</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{(matchDailyResult?.team2Name || team2Name || "Team 2")} - Top Performer</CardTitle>
                       <Star className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                      {topPerformerTeam2 ? (
                        <>
                          <div className="text-2xl font-bold">{topPerformerTeam2.name}</div>
                          <p className="text-xs text-muted-foreground">
                            {topPerformerTeam2.count} submission(s)
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">No submissions found for {(matchDailyResult?.team2Name || team2Name || "Team 2")}.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-md flex items-center">
                        <ListChecks className="mr-2 h-5 w-5 text-primary" /> {(matchDailyResult?.team1Name || team1Name)} - Submitted Entries (Sheet1Rows)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {renderEntryList(team1Entries, (matchDailyResult?.team1Name || team1Name))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-md flex items-center">
                        <ListChecks className="mr-2 h-5 w-5 text-primary" /> {(matchDailyResult?.team2Name || team2Name)} - Submitted Entries (Sheet1Rows)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {renderEntryList(team2Entries, (matchDailyResult?.team2Name || team2Name))}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
             {!isLoadingPanelData && !isFetchingScheduledDates && !panelError &&
              (team1Name?.toLowerCase() === 'tbd' || team2Name?.toLowerCase() === 'tbd') && (
                 <div className="text-orange-600 dark:text-orange-400 p-4 bg-orange-100 dark:bg-orange-900/30 rounded-md flex items-center border border-orange-300 dark:border-orange-700">
                    <Info className="h-5 w-5 mr-2 text-orange-500 dark:text-orange-400"/> Teams for this matchup are not yet determined. Daily stats will be shown once teams are set.
                 </div>
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

    
