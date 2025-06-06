
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
  const [tournamentStartDate, setTournamentStartDate] = useState<Date | null>(null);


  const { toast } = useToast();

  const formattedSelectedDate = useMemo(() => {
    console.log("[PanelMemo] selectedDateInternal changed to:", selectedDateInternal);
    return format(selectedDateInternal, 'yyyy-MM-dd');
  }, [selectedDateInternal]);

  const displaySelectedDate = useMemo(() => format(selectedDateInternal, 'PPP'), [selectedDateInternal]);
  const isFutureDateSelected = useMemo(() => isBefore(startOfDay(new Date()), selectedDateInternal), [selectedDateInternal]);

  useEffect(() => {
    if (tournamentId) {
        // Fetch tournament start date if needed for calendar disabling, or pass it if available
        // For now, let's assume a reasonable default if not directly available
        // This part might need actual fetching if tournamentStartDate is crucial and not passed
        setTournamentStartDate(subDays(new Date(), 90)); // Placeholder: 90 days ago as a default start
    }
  }, [tournamentId]);


  const fetchPanelData = useCallback(async () => {
    if (!matchup || !matchup.team1Name || !matchup.team2Name || !tournamentId || !matchup.roundId) {
      console.error("[PanelFetch] Aborting fetch: Matchup data, tournamentId, or roundId is incomplete.", {matchup, tournamentId});
      setPanelError("Matchup data is incomplete for fetching.");
      setIsLoadingPanelData(false);
      return;
    }
    console.log(`[PanelFetch] Initiating fetch for Matchup ID: ${matchup.id} (R:${matchup.roundId}) (${matchup.team1Name} vs ${matchup.team2Name}) on Date: ${formattedSelectedDate} for Tournament: ${tournamentId}`);
    setIsLoadingPanelData(true);
    setPanelError(null);
    setMatchDailyResult(null); // Clear previous daily result
    setTeam1Entries([]);
    setTeam2Entries([]);

    try {
      const [
        dailyResultData,
        entriesTeam1Result,
        entriesTeam2Result
      ] = await Promise.all([
        getMatchDailyResult({ tournamentId, roundNum: matchup.roundId, matchId: matchup.id, targetDate: formattedSelectedDate }),
        getEntriesForTeamByDate({ targetDate: formattedSelectedDate, teamName: matchup.team1Name }),
        getEntriesForTeamByDate({ targetDate: formattedSelectedDate, teamName: matchup.team2Name })
      ]);

      console.log(`[PanelFetch] Results for ${matchup.id} on ${formattedSelectedDate}:`);
      console.log(`  Daily Result:`, dailyResultData);
      console.log(`  Team 1 (${matchup.team1Name}) Entries:`, entriesTeam1Result.length);
      console.log(`  Team 2 (${matchup.team2Name}) Entries:`, entriesTeam2Result.length);

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
      setPanelError("Failed to load match details. Please try again.");
      toast({
        title: "Error Loading Details",
        description: "Could not fetch performance data for the selected date.",
        variant: "destructive",
      });
    } finally {
      console.log(`[PanelFetch] Finished fetch for ${matchup.id} on ${formattedSelectedDate}. Setting isLoadingPanelData to false.`);
      setIsLoadingPanelData(false);
    }
  }, [matchup, formattedSelectedDate, tournamentId, toast]);

  useEffect(() => {
    console.log("[PanelEffect isOpen/matchup] isOpen:", isOpen, "Matchup ID:", matchup?.id, "TournamentID:", tournamentId);
    if (isOpen && matchup) {
      console.log("[PanelEffect isOpen/matchup] Panel opened or matchup changed. Resetting selectedDateInternal to today.");
      // Check if matchup.startDate is available and use it, otherwise default to today.
      // For now, defaulting to today.
      setSelectedDateInternal(startOfDay(new Date()));
    } else if (!isOpen) {
        console.log("[PanelEffect isOpen/matchup] Panel closed. Resetting internal states.");
        setIsLoadingPanelData(false);
        setPanelError(null);
        setMatchDailyResult(null);
        setTeam1Entries([]);
        setTeam2Entries([]);
    }
  }, [isOpen, matchup, tournamentId]);

  useEffect(() => {
    console.log(`[PanelEffect DataTrigger] Evaluating fetch. isOpen: ${isOpen}, matchup: ${!!matchup}, tId: ${tournamentId}, rId: ${matchup?.roundId}, team1: ${matchup?.team1Name}, team2: ${matchup?.team2Name}, isFuture: ${isFutureDateSelected}, selectedDate: ${formattedSelectedDate}`);
    if (isOpen && matchup && tournamentId && matchup.roundId && matchup.team1Name && matchup.team1Name.toLowerCase() !== "tbd" && matchup.team2Name && matchup.team2Name.toLowerCase() !== "tbd" && !isFutureDateSelected) {
      console.log(`[PanelEffect DataTrigger] Conditions met. Calling fetchPanelData for ${matchup.id} on ${formattedSelectedDate}.`);
      fetchPanelData();
    } else if (isOpen && matchup && isFutureDateSelected) {
      console.log(`[PanelEffect DataTrigger] Future date ${formattedSelectedDate} selected for ${matchup.id}. Clearing data, not fetching.`);
      setMatchDailyResult(null);
      setTeam1Entries([]);
      setTeam2Entries([]);
      setPanelError(null);
      if(isLoadingPanelData) setIsLoadingPanelData(false);
    } else if (isOpen && matchup && (matchup.team1Name?.toLowerCase() === "tbd" || matchup.team2Name?.toLowerCase() === "tbd")) {
      console.log(`[PanelEffect DataTrigger] Matchup teams TBD for ${matchup.id}. Not fetching. Clearing data.`);
      setMatchDailyResult(null);
      setTeam1Entries([]);
      setTeam2Entries([]);
      setPanelError("Teams for this matchup are not yet determined.");
      if(isLoadingPanelData) setIsLoadingPanelData(false);
    } else if (!isOpen) {
        if(isLoadingPanelData) setIsLoadingPanelData(false); 
        if(panelError) setPanelError(null);
    }
  }, [isOpen, matchup, selectedDateInternal, fetchPanelData, isFutureDateSelected, formattedSelectedDate, tournamentId, isLoadingPanelData]);


  if (!matchup) {
    console.log("[PanelRender] No matchup data, rendering null.");
    return null;
  }

  const { team1Name, team2Name, team1DailyWins, team2DailyWins, seriesWinnerName } = matchup;
  
  const team1ScoreForDay = matchDailyResult?.exists ? matchDailyResult.team1Score : 0;
  const team2ScoreForDay = matchDailyResult?.exists ? matchDailyResult.team2Score : 0;
  const dailyWinnerName = matchDailyResult?.exists ? matchDailyResult.winner : null;
  const dailyMatchStatus = matchDailyResult?.exists ? matchDailyResult.status : (isFutureDateSelected ? "Pending" : "Awaiting Data");


  let dayPerformanceSummary = "";
  if (isLoadingPanelData) {
    dayPerformanceSummary = "Loading performance data...";
  } else if (panelError && !isFutureDateSelected) {
    dayPerformanceSummary = panelError;
  } else if (isFutureDateSelected) {
    dayPerformanceSummary = "Data for future dates is not available.";
  } else if (seriesWinnerName) {
     dayPerformanceSummary = `Match series concluded. Winner: ${seriesWinnerName}. Performance for ${displaySelectedDate}:`;
  } else if (!matchDailyResult || !matchDailyResult.exists) {
    dayPerformanceSummary = `No daily result record found for ${displaySelectedDate}. Scores are assumed 0.`;
  } else if (dailyWinnerName) {
    dayPerformanceSummary = `${dailyWinnerName} won the battle on ${displaySelectedDate} (${dailyMatchStatus})!`;
  } else if (dailyMatchStatus === "Completed - Tie" || (team1ScoreForDay === team2ScoreForDay && team1ScoreForDay > 0) ) {
    dayPerformanceSummary = `It was a tie on ${displaySelectedDate} with ${team1ScoreForDay} submissions each.`;
  } else if (team1ScoreForDay === 0 && team2ScoreForDay === 0 && isBefore(selectedDateInternal, startOfDay(new Date()))) {
    dayPerformanceSummary = `No submissions recorded for either team on ${displaySelectedDate}.`;
  } else if (team1ScoreForDay === 0 && team2ScoreForDay === 0) {
    dayPerformanceSummary = `Awaiting submissions for ${displaySelectedDate}.`;
  } else {
     dayPerformanceSummary = `Performance for ${displaySelectedDate}: ${dailyMatchStatus || "Status Unknown"}`;
  }

  console.log(`[PanelRender] Rendering panel. isOpen: ${isOpen}, Matchup ID: ${matchup.id}, isLoading: ${isLoadingPanelData}, panelError: ${panelError}, DailyResult:`, matchDailyResult);

  const renderEntryList = (entries: PanelEntry[], teamDisplayName: string | null) => {
    if (isLoadingPanelData) return <p className="text-sm text-muted-foreground italic">Loading entries...</p>;
    if (entries.length === 0 && !isFutureDateSelected && matchDailyResult?.exists) {
      return <p className="text-sm text-muted-foreground italic">No "Submitted" entries found contributing to {teamDisplayName || 'this team'}'s score on {displaySelectedDate}.</p>;
    }
     if (entries.length === 0 && !isFutureDateSelected && !matchDailyResult?.exists) {
      return <p className="text-sm text-muted-foreground italic">Awaiting data for {displaySelectedDate}.</p>;
    }
    if (isFutureDateSelected) {
      return <p className="text-sm text-muted-foreground italic">Entries for future dates are not shown.</p>;
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
                    disabled={isLoadingPanelData}
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

            {!isLoadingPanelData && panelError && !isFutureDateSelected && (
              <div className="text-destructive p-4 bg-destructive/10 rounded-md flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2"/> {panelError}
              </div>
            )}
            
            {!isLoadingPanelData && !panelError && isFutureDateSelected && (
               <div className="text-blue-700 p-4 bg-blue-100 rounded-md flex items-center border border-blue-300">
                 <Info className="h-5 w-5 mr-2 text-blue-500"/> Data for future dates is not yet available.
               </div>
            )}

            {!isLoadingPanelData && !panelError && !isFutureDateSelected && (
              <>
                <Card className="mb-4">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-center">
                      <div>
                        <p className="text-4xl font-bold font-headline text-primary">{team1ScoreForDay}</p>
                        <p className="text-sm text-muted-foreground">{team1Name || "TBD"} Submissions</p>
                      </div>
                      <div>
                        <p className="text-4xl font-bold font-headline text-primary">{team2ScoreForDay}</p>
                        <p className="text-sm text-muted-foreground">{team2Name || "TBD"} Submissions</p>
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
                        <ListChecks className="mr-2 h-5 w-5 text-primary" /> {team1Name || "TBD"} - Contributing Entries
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {renderEntryList(team1Entries, team1Name)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-md flex items-center">
                        <ListChecks className="mr-2 h-5 w-5 text-primary" /> {team2Name || "TBD"} - Contributing Entries
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
