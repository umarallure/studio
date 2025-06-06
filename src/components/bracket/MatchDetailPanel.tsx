
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Matchup as MatchupType, SheetRow } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, TrendingUp, TrendingDown, Users, BarChart3, ListChecks, Trophy, ShieldCheck, AlertTriangle, Info } from 'lucide-react';
import { format, startOfDay, isEqual, isBefore, subDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { getDailySubmissions } from '@/ai/flows/get-daily-submissions-flow';
import { getEntriesForTeamByDate } from '@/ai/flows/get-entries-for-team-by-date-flow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface MatchDetailPanelProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  matchup: MatchupType | null;
  tournamentStartDate: Date | null; // To limit calendar to relevant dates
}

// Simplified entry for panel display
interface PanelEntry {
  id: string;
  Agent?: string;
  INSURED_NAME?: string;
  ProductType?: string;
}

export default function MatchDetailPanel({ isOpen, onOpenChange, matchup, tournamentStartDate }: MatchDetailPanelProps) {
  const [selectedDateInternal, setSelectedDateInternal] = useState<Date>(startOfDay(new Date()));
  const [isLoadingPanelData, setIsLoadingPanelData] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  const [team1Submissions, setTeam1Submissions] = useState(0);
  const [team2Submissions, setTeam2Submissions] = useState(0);
  const [team1Entries, setTeam1Entries] = useState<PanelEntry[]>([]);
  const [team2Entries, setTeam2Entries] = useState<PanelEntry[]>([]);

  const { toast } = useToast();

  const formattedSelectedDate = useMemo(() => format(selectedDateInternal, 'yyyy-MM-dd'), [selectedDateInternal]);
  const displaySelectedDate = useMemo(() => format(selectedDateInternal, 'PPP'), [selectedDateInternal]);

  const fetchPanelData = useCallback(async () => {
    if (!matchup || !matchup.team1Name || !matchup.team2Name) {
      setPanelError("Matchup data is incomplete.");
      return;
    }
    setIsLoadingPanelData(true);
    setPanelError(null);

    try {
      const [
        dailySubmissionsTeam1Result,
        dailySubmissionsTeam2Result,
        entriesTeam1Result,
        entriesTeam2Result
      ] = await Promise.all([
        getDailySubmissions({ targetDate: formattedSelectedDate, leadVenderFilter: matchup.team1Name }),
        getDailySubmissions({ targetDate: formattedSelectedDate, leadVenderFilter: matchup.team2Name }),
        getEntriesForTeamByDate({ targetDate: formattedSelectedDate, teamName: matchup.team1Name }),
        getEntriesForTeamByDate({ targetDate: formattedSelectedDate, teamName: matchup.team2Name })
      ]);

      setTeam1Submissions(dailySubmissionsTeam1Result.submissionCount);
      setTeam2Submissions(dailySubmissionsTeam2Result.submissionCount);

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
      console.error("Error fetching match detail panel data:", error);
      setPanelError("Failed to load match details. Please try again.");
      toast({
        title: "Error Loading Details",
        description: "Could not fetch performance data for the selected date.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPanelData(false);
    }
  }, [matchup, formattedSelectedDate, toast]);

  useEffect(() => {
    if (isOpen && matchup) {
      // Reset to today's date when panel opens or matchup changes
      setSelectedDateInternal(startOfDay(new Date()));
      // Data fetching will be triggered by selectedDateInternal change or initial load
    }
  }, [isOpen, matchup]);

  useEffect(() => {
    if (isOpen && matchup && matchup.team1Name && matchup.team2Name) {
      fetchPanelData();
    }
  }, [isOpen, matchup, selectedDateInternal, fetchPanelData]);


  if (!matchup) return null;

  const { team1Name, team2Name, team1DailyWins, team2DailyWins, seriesWinnerName } = matchup;

  const dayWinner = team1Submissions > team2Submissions ? team1Name : team2Submissions > team1Submissions ? team2Name : null;
  const isTieForDay = team1Submissions === team2Submissions && team1Submissions > 0;
  const noSubmissionsForDay = team1Submissions === 0 && team2Submissions === 0;

  let dayPerformanceSummary = "";
  if (isLoadingPanelData) {
    dayPerformanceSummary = "Loading performance data...";
  } else if (panelError) {
    dayPerformanceSummary = "Error loading data.";
  } else if (seriesWinnerName) {
    dayPerformanceSummary = `Match series concluded. Winner: ${seriesWinnerName}.`;
  } else if (dayWinner) {
    dayPerformanceSummary = `${dayWinner} won the battle on ${displaySelectedDate}!`;
  } else if (isTieForDay) {
    dayPerformanceSummary = `It was a tie on ${displaySelectedDate}.`;
  } else if (noSubmissionsForDay && isBefore(selectedDateInternal, startOfDay(new Date()))) {
    dayPerformanceSummary = `No submissions recorded for either team on ${displaySelectedDate}.`;
  } else if (noSubmissionsForDay) {
    dayPerformanceSummary = `Awaiting submissions for ${displaySelectedDate}.`;
  } else {
     dayPerformanceSummary = `Submissions are equal for ${displaySelectedDate}, awaiting more data.`;
  }


  const renderEntryList = (entries: PanelEntry[], teamDisplayName: string | null) => {
    if (entries.length === 0) {
      return <p className="text-sm text-muted-foreground italic">No "Submitted" entries found for {teamDisplayName || 'this team'} on {displaySelectedDate}.</p>;
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

  const isFutureDateSelected = isBefore(startOfDay(new Date()), selectedDateInternal);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-2xl font-headline text-primary flex items-center">
            <BarChart3 className="mr-3 h-7 w-7" /> Match Insights: {team1Name} vs {team2Name}
          </SheetTitle>
          <SheetDescription>
            Detailed performance breakdown for this matchup. Overall series score is based on daily wins.
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
                  <p className="text-sm text-muted-foreground">{team1Name}</p>
                </div>
                <p className="text-2xl font-bold text-muted-foreground">vs</p>
                <div>
                  <p className="text-2xl font-bold font-headline">{team2DailyWins}</p>
                  <p className="text-sm text-muted-foreground">{team2Name}</p>
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
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {displaySelectedDate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDateInternal}
                    onSelect={(date) => date && setSelectedDateInternal(startOfDay(date))}
                    disabled={(date) => {
                      if (!tournamentStartDate) return false; // Allow all if no tournament start date
                      // Disable dates before tournament start OR too far in the past from "today" (e.g. > 60 days) or in future
                      const sixtyDaysAgo = subDays(startOfDay(new Date()), 60);
                      return isBefore(date, startOfDay(tournamentStartDate)) || isBefore(date, sixtyDaysAgo) || isBefore(startOfDay(new Date()), startOfDay(date));
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            {isLoadingPanelData && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Loading daily stats...</p>
              </div>
            )}

            {!isLoadingPanelData && panelError && (
              <div className="text-destructive p-4 bg-destructive/10 rounded-md flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2"/> {panelError}
              </div>
            )}
            
            {!isLoadingPanelData && !panelError && isFutureDateSelected && (
               <div className="text-info-foreground p-4 bg-info/10 rounded-md flex items-center">
                 <Info className="h-5 w-5 mr-2 text-blue-500"/> Data for future dates is not yet available.
               </div>
            )}

            {!isLoadingPanelData && !panelError && !isFutureDateSelected && (
              <>
                <Card className="mb-4">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-center">
                      <div>
                        <p className="text-4xl font-bold font-headline text-primary">{team1Submissions}</p>
                        <p className="text-sm text-muted-foreground">{team1Name} Submissions</p>
                      </div>
                      <div>
                        <p className="text-4xl font-bold font-headline text-primary">{team2Submissions}</p>
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
                        <ListChecks className="mr-2 h-5 w-5 text-primary" /> {team1Name} - Submitted Entries
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {renderEntryList(team1Entries, team1Name)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-md flex items-center">
                        <ListChecks className="mr-2 h-5 w-5 text-primary" /> {team2Name} - Submitted Entries
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

