
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

  useEffect(() => {
    console.log(`[PanelEffect isOpen/matchup] isOpen: ${isOpen}, matchupId: ${matchup?.id}`);
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
          console.log(`[PanelEffect ScheduledDates FINALLY] M:${matchup.id}. isFetchingScheduledDates set to false.`);
          setIsFetchingScheduledDates(false);
        });
    } else if (!isOpen) {
      console.log("[PanelEffect isOpen/matchup] Panel closed. Reset states.");
      setMatchScheduledDates(null);
      setIsFetchingScheduledDates(true);
      setIsLoadingPanelData(false);
      setSelectedDateInternal(startOfDay(new Date()));
      setPanelError(null);
      setMatchDailyResult(null);
      setTeam1Entries([]);
      setTeam2Entries([]);
      setTopPerformerTeam1(null);
      setTopPerformerTeam2(null);
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
      console.log(`[PanelEffect InitialDate] M:${matchup.id}. All fetched scheduled:`, matchScheduledDates.map(d => { const pd = parseISO(d); return isValid(pd) ? format(pd, 'yyyy-MM-dd') : 'Invalid Date';}));
      console.log(`[PanelEffect InitialDate] M:${matchup.id}. Valid non-future scheduled (past or present):`, validNonFutureScheduledDates.map(d => format(d, 'yyyy-MM-dd')));
      
      if (validNonFutureScheduledDates.some(d => isEqual(d, clientToday))) {
        newSelectedDateCandidate = clientToday;
        console.log(`[PanelEffect InitialDate] M:${matchup.id}. Case 1: Today is valid & scheduled. Set to: ${format(newSelectedDateCandidate, 'yyyy-MM-dd')}`);
      } else if (validNonFutureScheduledDates.length > 0) {
        newSelectedDateCandidate = validNonFutureScheduledDates[0]; 
        console.log(`[PanelEffect InitialDate] M:${matchup.id}. Case 2: Today not valid/scheduled. Set to latest past/present scheduled: ${format(newSelectedDateCandidate, 'yyyy-MM-dd')}`);
      } else { 
        const sortedFutureScheduledDates = matchScheduledDates.map(dStr => parseISO(dStr)).filter(isValid).sort((a,b) => a.getTime() - b.getTime());
        if (sortedFutureScheduledDates.length > 0) {
          newSelectedDateCandidate = sortedFutureScheduledDates[0]; 
          console.log(`[PanelEffect InitialDate] M:${matchup.id}. Case 3: All scheduled are future (relative to client). Set to earliest scheduled: ${format(newSelectedDateCandidate, 'yyyy-MM-dd')}`);
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
    if (!isOpen || !matchup || !tournamentId || !matchup.roundId || !selectedDateInternal) {
      console.error("[PanelFetch ABORT] Critical data incomplete.", { isOpen, matchupId: matchup?.id, tournamentId, roundId: matchup?.roundId, selectedDateInternal });
      setPanelError("Matchup data incomplete for details.");
      if(isLoadingPanelData) setIsLoadingPanelData(false);
      return;
    }

    if (!matchup.team1Name || matchup.team1Name.toLowerCase() === "tbd" ||
        !matchup.team2Name || matchup.team2Name.toLowerCase() === "tbd") {
      console.log(`[PanelFetch ABORT] Teams TBD for M:${matchup.id}.`);
      setPanelError("Teams for this matchup are not yet determined.");
      setMatchDailyResult(null); setTeam1Entries([]); setTeam2Entries([]);
      setTopPerformerTeam1(null); setTopPerformerTeam2(null);
      if(isLoadingPanelData) setIsLoadingPanelData(false);
      return;
    }
    const currentFormattedDate = format(selectedDateInternal, 'yyyy-MM-dd');
    console.log(`[PanelFetch INITIATE] M_ID: ${matchup.id} (R:${matchup.roundId}) (${matchup.team1Name} vs ${matchup.team2Name}) on D:${currentFormattedDate} for T:${tournamentId}`);
    setIsLoadingPanelData(true);
    setPanelError(null);
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
      
      console.log(`[PanelFetch RESULTS] M:${matchup.id} D:${currentFormattedDate}:`);
      console.log(`  Daily Result:`, JSON.stringify(dailyResultData));
      console.log(`  Team 1 ("${matchup.team1Name}") Entries Count:`, entriesTeam1Result.length, "Sample:", entriesTeam1Result.length > 0 ? JSON.stringify(entriesTeam1Result[0]) : "N/A");
      console.log(`  Team 2 ("${matchup.team2Name}") Entries Count:`, entriesTeam2Result.length, "Sample:", entriesTeam2Result.length > 0 ? JSON.stringify(entriesTeam2Result[0]) : "N/A");

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
  }, [isOpen, matchup, tournamentId, selectedDateInternal, toast]);


  useEffect(() => {
    console.log(`[PanelEffect DataTrigger] M_ID:${matchup?.id}, isOpen:${isOpen}, tournamentId:${!!tournamentId}, roundId:${!!matchup?.roundId}, team1Valid:${matchup?.team1Name && matchup.team1Name.toLowerCase() !== "tbd"}, team2Valid:${matchup?.team2Name && matchup.team2Name.toLowerCase() !== "tbd"}, selDate:${selectedDateInternal ? format(selectedDateInternal, 'yyyy-MM-dd') : 'null'}`);

    if (isOpen && matchup && tournamentId && matchup.roundId &&
        matchup.team1Name && matchup.team1Name.toLowerCase() !== "tbd" &&
        matchup.team2Name && matchup.team2Name.toLowerCase() !== "tbd" &&
        selectedDateInternal
    ) {
        console.log(`[PanelEffect DataTrigger] Conditions met. Calling fetchPanelData for M:${matchup.id} on D:${format(selectedDateInternal, 'yyyy-MM-dd')}.`);
        fetchPanelData();
    } else if (isOpen && matchup) {
      console.log(`[PanelEffect DataTrigger] Conditions for full fetch NOT met. M:${matchup?.id}, D:${selectedDateInternal ? format(selectedDateInternal, 'yyyy-MM-dd') : 'null'}. Clearing data or showing TBD message.`);
      if (matchup.team1Name?.toLowerCase() === "tbd" || matchup.team2Name?.toLowerCase() === "tbd") {
        setPanelError("Teams for this matchup are not yet determined.");
      } else {
         setPanelError(null); 
      }
      setMatchDailyResult(null); setTeam1Entries([]); setTeam2Entries([]);
      setTopPerformerTeam1(null); setTopPerformerTeam2(null);
      if (isLoadingPanelData) setIsLoadingPanelData(false);
    }
  }, [isOpen, matchup, tournamentId, selectedDateInternal, fetchPanelData]);


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
      let topAgent: TeamTopPerformer = { name: '', count: 0 };
      agentCounts.forEach((count, name) => {
        if (count > topAgent.count) {
          topAgent = { name, count };
        }
      });
      return topAgent.count > 0 ? topAgent : null;
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
    console.log("[PanelRender] No matchup data, rendering null.");
    return null;
  }

  const { team1Name, team2Name, team1DailyWins, team2DailyWins, seriesWinnerName } = matchup;

  const team1ScoreForDay = matchDailyResult?.exists ? matchDailyResult.team1Score : 0;
  const team2ScoreForDay = matchDailyResult?.exists ? matchDailyResult.team2Score : 0;
  const dailyWinnerName = matchDailyResult?.exists ? matchDailyResult.winner : null;
  const dailyMatchStatus = matchDailyResult?.exists ? matchDailyResult.status : "Awaiting Data";

  let dayPerformanceSummary = "";

  if (isLoadingPanelData && !isFetchingScheduledDates && selectedDateInternal) {
    dayPerformanceSummary = `Loading performance data for ${displaySelectedDate}...`;
  } else if (panelError && (!matchup.team1Name || matchup.team1Name.toLowerCase() === "tbd" || !matchup.team2Name || matchup.team2Name.toLowerCase() === "tbd" )) {
    dayPerformanceSummary = panelError;
  } else if (panelError) {
    dayPerformanceSummary = panelError;
  } else if (!matchDailyResult || !matchDailyResult.exists) {
    dayPerformanceSummary = `No official daily result record found for ${displaySelectedDate}. Check Sheet1Rows below for submitted entries.`;
  } else { 
    const diff = Math.abs(team1ScoreForDay - team2ScoreForDay);
    if (seriesWinnerName) { // Series already decided
        dayPerformanceSummary = `Series Winner: ${seriesWinnerName}. On ${displaySelectedDate} (${dailyMatchStatus || 'Status Unknown'}): `;
        if(dailyWinnerName) dayPerformanceSummary += `${dailyWinnerName} won.`; else if (dailyMatchStatus?.includes("Tie")) dayPerformanceSummary += `Tie.`; else dayPerformanceSummary += `Scores: ${team1Name} ${team1ScoreForDay} - ${team2Name} ${team2ScoreForDay}.`;
    } else { // Series ongoing
        if (team1ScoreForDay > team2ScoreForDay) {
          dayPerformanceSummary = `${team1Name} won the day with ${team1ScoreForDay} submissions, leading by ${diff} over ${team2Name}'s ${team2ScoreForDay}. Status: ${dailyMatchStatus || 'Completed'}.`;
        } else if (team2ScoreForDay > team1ScoreForDay) {
          dayPerformanceSummary = `${team2Name} won the day with ${team2ScoreForDay} submissions, leading by ${diff} over ${team1Name}'s ${team1ScoreForDay}. Status: ${dailyMatchStatus || 'Completed'}.`;
        } else if (team1ScoreForDay === team2ScoreForDay && team1ScoreForDay > 0) {
          dayPerformanceSummary = `It was a tie on ${displaySelectedDate} with ${team1ScoreForDay} submissions each! Status: ${dailyMatchStatus || 'Completed - Tie'}.`;
        } else { 
          dayPerformanceSummary = `Awaiting submissions or no submissions recorded in dailyResults for ${displaySelectedDate}. Status: ${dailyMatchStatus || 'Scheduled'}.`;
        }
    }
  }
  
  console.log(`[PanelRender] M_ID: ${matchup.id}, isLoadingPanelData: ${isLoadingPanelData}, isFetchingScheduledDates: ${isFetchingScheduledDates}, panelError: ${panelError}, DailyResult:`, JSON.stringify(matchDailyResult), "DaySummary:", dayPerformanceSummary, "SelDate:", selectedDateInternal ? format(selectedDateInternal, 'yyyy-MM-dd') : 'null', "MatchScheduledDates:", JSON.stringify(matchScheduledDates));

  const renderEntryList = (entries: PanelEntry[], teamDisplayName: string | null) => {
    const actualTeamName = teamDisplayName || "this team";
    if (isLoadingPanelData && !isFetchingScheduledDates && selectedDateInternal) return <p className="text-sm text-muted-foreground italic">Loading entries for {actualTeamName}...</p>;

    if (matchup.team1Name?.toLowerCase() === 'tbd' || matchup.team2Name?.toLowerCase() === 'tbd') {
         return <p className="text-sm text-muted-foreground italic">Team not determined, entries cannot be displayed.</p>;
    }
    if (entries.length === 0 && !isLoadingPanelData) {
      return <p className="text-sm text-muted-foreground italic">No "Submitted" entries found for {actualTeamName} in Sheet1Rows on {displaySelectedDate}.</p>;
    }

    return (
      <ul className="space-y-2 max-h-32 overflow-y-auto pr-2">
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
                Details for: {isFetchingScheduledDates || (isLoadingPanelData && !selectedDateInternal && !panelError) ? <Loader2 className="inline h-5 w-5 animate-spin" /> : displaySelectedDate}
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
                            console.log("[PanelCalendar] Date selected from picker:", format(newSelectedDate, 'yyyy-MM-dd'));
                            if (!isEqual(newSelectedDate, selectedDateInternal)) {
                                setSelectedDateInternal(newSelectedDate);
                            }
                        }
                    }}
                    disabled={(date) => {
                      const dateToCheck = startOfDay(date);
                      const dateString = format(dateToCheck, 'yyyy-MM-dd');
                      
                      if (isFetchingScheduledDates) {
                        console.log(`[CalendarDisabled] Date ${dateString}: Disabled because schedule fetching.`);
                        return true;
                      }
                      if (!matchScheduledDates || matchScheduledDates.length === 0) {
                         console.log(`[CalendarDisabled] Date ${dateString}: Disabled because matchScheduledDates is null or empty.`);
                         return true; 
                      }
                      const isThisDateScheduledForThisMatch = matchScheduledDates.includes(dateString);
                      console.log(`[CalendarDisabled] Date ${dateString}: Scheduled? ${isThisDateScheduledForThisMatch}. All sched: ${JSON.stringify(matchScheduledDates)}`);
                      
                      return !isThisDateScheduledForThisMatch; 
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {isFetchingScheduledDates && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading match schedule...</p>
              </div>
            )}
            
            {isLoadingPanelData && !isFetchingScheduledDates && selectedDateInternal && !panelError && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading daily stats for {displaySelectedDate}...</p>
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
                        <p className="text-sm text-muted-foreground">{team1Name} (from DailyResult)</p>
                      </div>
                      <div>
                        <p className="text-4xl font-bold font-headline text-primary">{team2ScoreForDay}</p>
                        <p className="text-sm text-muted-foreground">{team2Name} (from DailyResult)</p>
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
                      <CardTitle className="text-sm font-medium">{team1Name || "Team 1"} - Top Performer</CardTitle>
                      <Star className="h-4 w-4 text-muted-foreground text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                      {topPerformerTeam1 ? (
                        <>
                          <div className="text-2xl font-bold">{topPerformerTeam1.name}</div>
                          <p className="text-xs text-muted-foreground">
                            {topPerformerTeam1.count} submissions
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">No submissions found for {team1Name || "Team 1"}.</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{team2Name || "Team 2"} - Top Performer</CardTitle>
                       <Star className="h-4 w-4 text-muted-foreground text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                      {topPerformerTeam2 ? (
                        <>
                          <div className="text-2xl font-bold">{topPerformerTeam2.name}</div>
                          <p className="text-xs text-muted-foreground">
                            {topPerformerTeam2.count} submissions
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">No submissions found for {team2Name || "Team 2"}.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-md flex items-center">
                        <ListChecks className="mr-2 h-5 w-5 text-primary" /> {team1Name} - Submitted Entries (Sheet1Rows)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {renderEntryList(team1Entries, team1Name)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-md flex items-center">
                        <ListChecks className="mr-2 h-5 w-5 text-primary" /> {team2Name} - Submitted Entries (Sheet1Rows)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {renderEntryList(team2Entries, team2Name)}
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

