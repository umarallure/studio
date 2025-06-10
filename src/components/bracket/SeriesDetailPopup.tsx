"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Info, CalendarX, Trophy, X, BarChart3, Users, AlertCircle, TrendingUp, User, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getMatchScheduledDates, type GetMatchScheduledDatesInput } from '@/ai/flows/get-match-scheduled-dates-flow';
import { getMatchDailyResult, type GetMatchDailyResultInput, type GetMatchDailyResultOutput } from '@/ai/flows/get-match-daily-result-flow';
import { getTeamDailyPerformance } from '@/ai/flows/get-team-daily-performance-flow';
import { format as formatDate, parseISO, isValid, addDays, getDay } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SeriesDetailPopupProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  matchupId: string | null;
  roundId: string | null; 
  team1Name: string | null;
  team2Name: string | null;
  tournamentId: string | null;
  tournamentStartDate: Date | null;
}

interface TeamDailyStats {
  totalEntries: number;
  submittedEntries: number;
  chargebackEntries: number;
  submissionRate: number;
  chargebackRate: number;
  bestAgent: {
    name: string;
    submissionCount: number;
  };
}

interface DailyStatDisplayData {
  date: string; 
  originalDate: string; 
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  winner: string | null;
  status: string; 
  team1Stats: TeamDailyStats;
  team2Stats: TeamDailyStats;
  dailyWinner: string | null;
}

const SeriesDetailPopup: React.FC<SeriesDetailPopupProps> = ({
  isOpen,
  onOpenChange,
  matchupId,
  roundId, 
  team1Name,
  team2Name,
  tournamentId,
  tournamentStartDate,
}) => {
  const [dailyStats, setDailyStats] = useState<DailyStatDisplayData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const { toast } = useToast();

  const resetState = useCallback(() => {
    setDailyStats([]);
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetState();
      return;
    }

    if (!matchupId || !roundId || !tournamentId || !team1Name || !team2Name || !tournamentStartDate || !isValid(tournamentStartDate)) {
      setError("Required match details are missing or invalid. Cannot fetch daily stats.");
      setDailyStats([]);
      setIsLoading(false);
      return;
    }

    const fetchSeriesDetails = async () => {
      setIsLoading(true);
      setError(null);
      setDailyStats([]);

      try {
        const scheduledDatesInput: GetMatchScheduledDatesInput = { 
          tournamentId, 
          roundNum: roundId, 
          matchId: matchupId 
        };
        console.log("[SeriesDetailPopup] Calling getMatchScheduledDates with input:", JSON.stringify(scheduledDatesInput));
        let fetchedScheduledDates = await getMatchScheduledDates(scheduledDatesInput);

        if (!fetchedScheduledDates || fetchedScheduledDates.length === 0) {
          console.warn(`[SeriesDetailPopup] No scheduled dates found via Genkit for R${roundId} M${matchupId}. Deriving dates.`);
          const roundNumInt = parseInt(roundId, 10);
          if (isNaN(roundNumInt) || !tournamentStartDate || !isValid(tournamentStartDate)) {
            throw new Error("Cannot derive match dates: Invalid roundId or tournamentStartDate.");
          }
          const matchWeekStartDate = addDays(tournamentStartDate, (roundNumInt - 1) * 7);
          
          let workingDaysFound = 0;
          let calendarDayOffset = 0;
          const derivedDates: string[] = [];
          while(workingDaysFound < 5 && calendarDayOffset < 20) { 
            const currentDate = addDays(matchWeekStartDate, calendarDayOffset);
            if (getDay(currentDate) >= 1 && getDay(currentDate) <= 5) { 
              derivedDates.push(format(currentDate, 'yyyy-MM-dd'));
              workingDaysFound++;
            }
            calendarDayOffset++;
          }
          fetchedScheduledDates = derivedDates.slice(0,5); 
          if(fetchedScheduledDates.length === 0) {
            throw new Error("Could not determine scheduled dates for this match.");
          }
           console.log("[SeriesDetailPopup] Derived scheduled dates:", fetchedScheduledDates);
        }

        const sortedScheduledDates = fetchedScheduledDates.sort((a, b) => a.localeCompare(b));

        const dailyResultsPromises = sortedScheduledDates.map(dateStr => {
          const dailyResultInput: GetMatchDailyResultInput = {
            tournamentId,
            roundNum: roundId, 
            matchId: matchupId,
            targetDate: dateStr,
          };
          return getMatchDailyResult(dailyResultInput);
        });

        const resultsFromFlow = await Promise.all(dailyResultsPromises);

        const newDailyStats: DailyStatDisplayData[] = await Promise.all(
          sortedScheduledDates.map(async (dateStr) => {
            // Get basic match result
            const dailyResultInput: GetMatchDailyResultInput = {
              tournamentId,
              roundNum: roundId, 
              matchId: matchupId,
              targetDate: dateStr,
            };
            const matchResult = await getMatchDailyResult(dailyResultInput);

            // Get detailed team stats
            const [team1Performance, team2Performance] = await Promise.all([
              getTeamDailyPerformance({ teamName: team1Name, targetDate: dateStr }),
              getTeamDailyPerformance({ teamName: team2Name, targetDate: dateStr })
            ]);

            // Determine daily winner based on submission counts
            const dailyWinner = team1Performance.submittedEntries > team2Performance.submittedEntries ? team1Name :
                               team2Performance.submittedEntries > team1Performance.submittedEntries ? team2Name :
                               null;

            return {
              date: formatDate(parseISO(dateStr), 'EEE, MMM d'),
              originalDate: dateStr,
              team1Name: matchResult.team1Name || team1Name,
              team2Name: matchResult.team2Name || team2Name,
              team1Score: team1Performance.submittedEntries,
              team2Score: team2Performance.submittedEntries,
              winner: dailyWinner,
              status: matchResult.status || "Unknown",
              team1Stats: team1Performance,
              team2Stats: team2Performance,
              dailyWinner
            };
          })
        );

        setDailyStats(newDailyStats);

      } catch (err: any) {
        console.error("[SeriesDetailPopup] Error fetching series details:", err);
        setError(`Failed to load daily stats: ${err.message}`);
        toast({
          title: "Error Loading Details",
          description: err.message || "Could not fetch daily submission data for the match.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSeriesDetails();
  }, [isOpen, matchupId, roundId, team1Name, team2Name, tournamentId, tournamentStartDate, toast, resetState]);


  const maxSubmissionsPerDay = dailyStats.reduce((max, day) => {
    const dayMax = Math.max(day.team1Score, day.team2Score);
    return dayMax > max ? dayMax : max;
  }, 0);

  function DailyStatCard({ day }: { day: DailyStatDisplayData }) {
    // Calculate lead difference for winner statement
    const leadDifference = Math.abs(day.team1Stats.submittedEntries - day.team2Stats.submittedEntries);
    const winnerStatement = day.dailyWinner ? 
      `${day.dailyWinner} won by ${leadDifference} ${leadDifference === 1 ? 'submission' : 'submissions'}` : 
      'No winner determined';

    return (
      <Card className="shadow-md border-border/70">
        <CardHeader className="p-3 bg-muted/30 rounded-t-md">
          <CardTitle className="text-center text-sm font-semibold text-muted-foreground">{day.date}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {/* Winner Statement */}
          <div className="text-sm text-center font-medium text-muted-foreground bg-muted/30 py-1.5 px-2 rounded-md">
            {winnerStatement}
          </div>

          {/* Team 1 Stats */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                {day.team1Name}
                <span className="text-muted-foreground font-normal">
                  ({day.team1Stats.totalEntries} entries)
                </span>
              </h3>
              <Badge variant={day.winner === day.team1Name ? "default" : "secondary"}>
                {day.winner === day.team1Name ? "Winner" : ""}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Total Entries: {day.team1Stats.totalEntries}</span>
                </div>
                
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span className="text-muted-foreground">Submitted: {day.team1Stats.submittedEntries}</span>
                </div>
                
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-muted-foreground">Chargeback Rate: {day.team1Stats.chargebackRate}%</span>
                </div>
                
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Best Agent: {day.team1Stats.bestAgent.name}</span>
                </div>
                
              </div>
            </div>
          </div>

          <Separator />

          {/* Team 2 Stats */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                {day.team2Name}
                <span className="text-muted-foreground font-normal">
                  ({day.team2Stats.totalEntries} entries)
                </span>
              </h3>
              <Badge variant={day.winner === day.team2Name ? "default" : "secondary"}>
                {day.winner === day.team2Name ? "Winner" : ""}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Total Entries: {day.team2Stats.totalEntries}</span>
                </div>
                
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span className="text-muted-foreground">Submitted: {day.team2Stats.submittedEntries}</span>
                </div>
               
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-muted-foreground">Chargeback Rate: {day.team2Stats.chargebackRate}%</span>
                </div>
                
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Best Agent: {day.team2Stats.bestAgent.name}</span>
                </div>
                
                  
               
              </div>
            </div>
          </div>

          {day.status !== "Not Found" && (
            <div className="pt-2 text-center">
              <Badge variant={day.status === "Completed" ? "outline" : "secondary"}>
                {day.status}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const goToNextCard = () => {
    setCurrentCardIndex((prev) => (prev + 1) % dailyStats.length);
  };

  const goToPreviousCard = () => {
    setCurrentCardIndex((prev) => (prev - 1 + dailyStats.length) % dailyStats.length);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] min-h-[60vh] max-h-[85vh] flex flex-col bg-card p-0">
        <button 
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        <DialogHeader className="p-6 border-b flex-shrink-0 bg-card/50 backdrop-blur sticky top-0 z-10">
          <DialogTitle className="text-xl text-primary font-headline">
            Series Details: {team1Name || "Team 1"} vs {team2Name || "Team 2"}
          </DialogTitle>
          <DialogDescription className="text-base">
            Daily submission counts for this match-up (Round {roundId}).
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-grow px-6 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg text-foreground">Loading Daily Stats...</p>
            </div>
          ) : error ? (
            <div className="text-center py-10 text-destructive flex flex-col items-center gap-2">
              <CalendarX className="h-10 w-10"/>
              <p className="font-semibold">Error Loading Data</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : dailyStats.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground flex flex-col items-center gap-2">
              <Info className="h-10 w-10"/>
              <p>No daily data available for this match's scheduled days.</p>
            </div>
          ) : (
            <div className="relative px-16 max-w-2xl mx-auto"> {/* Increased padding from px-8 to px-16 */}
              {/* Navigation buttons - moved further out */}
              <div className="absolute -left-4 top-1/2 -translate-y-1/2 z-10">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToPreviousCard}
                  disabled={dailyStats.length <= 1}
                  className="rounded-full h-12 w-12 shadow-lg hover:bg-accent transition-colors"
                >
                  <ChevronLeft className="h-8 w-8" />
                  <span className="sr-only">Previous day</span>
                </Button>
              </div>

              <div className="absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToNextCard}
                  disabled={dailyStats.length <= 1}
                  className="rounded-full h-12 w-12 shadow-lg hover:bg-accent transition-colors"
                >
                  <ChevronRight className="h-8 w-8" />
                  <span className="sr-only">Next day</span>
                </Button>
              </div>

              {/* Page indicator */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-sm text-muted-foreground">
                Day {currentCardIndex + 1} of {dailyStats.length}
              </div>
              
              {/* Current card */}
              {dailyStats.length > 0 && (
                <DailyStatCard day={dailyStats[currentCardIndex]} />
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default SeriesDetailPopup;
