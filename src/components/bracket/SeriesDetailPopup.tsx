
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
import { Loader2, Info, CalendarX, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getMatchScheduledDates, type GetMatchScheduledDatesInput } from '@/ai/flows/get-match-scheduled-dates-flow';
import { getMatchDailyResult, type GetMatchDailyResultInput, type GetMatchDailyResultOutput } from '@/ai/flows/get-match-daily-result-flow';
import { format, parseISO, isValid, addDays, getDay } from 'date-fns';

interface SeriesDetailPopupProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  matchupId: string | null;
  roundId: string | null;
  team1Name: string | null;
  team2Name: string | null;
  tournamentId: string | null;
  tournamentStartDate: Date | null; // For calculating actual match week
}

interface DailyStatDisplayData {
  date: string; // Formatted for display, e.g., "MMM d" or "Mon, MMM d"
  originalDate: string; // YYYY-MM-DD
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  winner: string | null;
  status: string; // "Completed", "Scheduled", "Not Found", "Data Missing"
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
      setDailyStats([]); // Clear any previous stats
      setIsLoading(false);
      return;
    }

    const fetchSeriesDetails = async () => {
      setIsLoading(true);
      setError(null);
      setDailyStats([]); // Clear previous stats on new fetch

      try {
        // 1. Get the 5 scheduled dates for the match
        const scheduledDatesInput: GetMatchScheduledDatesInput = { tournamentId, roundId, matchId: matchupId };
        const fetchedScheduledDates = await getMatchScheduledDates(scheduledDatesInput);

        if (!fetchedScheduledDates || fetchedScheduledDates.length === 0) {
          // This case can happen if the dailyResults subcollection hasn't been created yet
          // We can attempt to derive the 5 working days based on tournamentStartDate and roundId
          console.warn(`[SeriesDetailPopup] No scheduled dates found via Genkit for R${roundId} M${matchupId}. Deriving dates.`);
          const roundNumInt = parseInt(roundId, 10);
          if (isNaN(roundNumInt) || !tournamentStartDate || !isValid(tournamentStartDate)) {
            throw new Error("Cannot derive match dates: Invalid roundId or tournamentStartDate.");
          }
          const matchWeekStartDate = addDays(tournamentStartDate, (roundNumInt - 1) * 7);
          
          let workingDaysFound = 0;
          let calendarDayOffset = 0;
          const derivedDates: string[] = [];
          while(workingDaysFound < 5 && calendarDayOffset < 20) { // Safety break
            const currentDate = addDays(matchWeekStartDate, calendarDayOffset);
            if (getDay(currentDate) >= 1 && getDay(currentDate) <= 5) { // Mon-Fri
              derivedDates.push(format(currentDate, 'yyyy-MM-dd'));
              workingDaysFound++;
            }
            calendarDayOffset++;
          }
          fetchedScheduledDates.push(...derivedDates.slice(0,5)); // Use up to 5 derived dates
          if(fetchedScheduledDates.length === 0) {
            throw new Error("Could not determine scheduled dates for this match.");
          }
        }

        const sortedScheduledDates = fetchedScheduledDates.sort((a, b) => a.localeCompare(b));

        // 2. Fetch daily result for each scheduled date
        const dailyResultsPromises = sortedScheduledDates.map(dateStr => {
          const dailyResultInput: GetMatchDailyResultInput = {
            tournamentId,
            roundId,
            matchId: matchupId,
            targetDate: dateStr,
          };
          return getMatchDailyResult(dailyResultInput);
        });

        const resultsFromFlow = await Promise.all(dailyResultsPromises);

        const newDailyStats: DailyStatDisplayData[] = resultsFromFlow.map((result, index) => {
          const originalDate = sortedScheduledDates[index];
          let displayDate = `Day ${index + 1}`;
          try {
            displayDate = format(parseISO(originalDate), 'EEE, MMM d');
          } catch (e) { /* ignore format error, use Day X */ }

          return {
            date: displayDate,
            originalDate: originalDate,
            team1Name: result.team1Name || team1Name || "Team 1",
            team2Name: result.team2Name || team2Name || "Team 2",
            team1Score: result.team1Score,
            team2Score: result.team2Score,
            winner: result.winner,
            status: result.exists ? (result.status || "Unknown") : "Not Found",
          };
        });
        
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] w-[95%] max-h-[90vh] flex flex-col bg-card">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="text-xl text-primary font-headline">
            Series Details: {team1Name || "Team 1"} vs {team2Name || "Team 2"}
          </DialogTitle>
          <DialogDescription>
            Daily submission counts for this match-up.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-grow p-4 -mx-0"> {/* Adjusted padding */}
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
            <div className="space-y-4">
              {dailyStats.map((day) => (
                <Card key={day.originalDate} className="shadow-md border-border/70">
                  <CardHeader className="p-3 bg-muted/30 rounded-t-md">
                    <CardTitle className="text-center text-sm font-semibold text-muted-foreground">{day.date}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-sm">
                        <span className={`font-medium ${day.winner === day.team1Name ? 'text-accent font-bold' : 'text-card-foreground'}`}>{day.team1Name}</span>
                        <span className="font-mono">{day.team1Score} subs</span>
                      </div>
                      <Progress 
                        value={maxSubmissionsPerDay > 0 ? (day.team1Score / maxSubmissionsPerDay) * 100 : 0} 
                        className={`h-2.5 ${day.winner === day.team1Name ? '[&>div]:bg-accent' : '[&>div]:bg-primary'}`} 
                      />
                    </div>

                    <Separator className="my-2"/>

                    <div className="space-y-1.5">
                       <div className="flex justify-between items-center text-sm">
                        <span className={`font-medium ${day.winner === day.team2Name ? 'text-accent font-bold' : 'text-card-foreground'}`}>{day.team2Name}</span>
                        <span className="font-mono">{day.team2Score} subs</span>
                      </div>
                      <Progress 
                        value={maxSubmissionsPerDay > 0 ? (day.team2Score / maxSubmissionsPerDay) * 100 : 0} 
                        className={`h-2.5 ${day.winner === day.team2Name ? '[&>div]:bg-accent' : '[&>div]:bg-primary'}`}
                      />
                    </div>
                    
                    {day.winner && day.status === "Completed" && (
                        <div className="text-xs text-center pt-2 text-accent font-semibold flex items-center justify-center gap-1">
                           <Trophy className="h-3 w-3"/> Daily Winner: {day.winner}
                        </div>
                    )}
                     {day.status !== "Completed" && day.status !== "Not Found" && (
                        <div className="text-xs text-center pt-2 text-muted-foreground">
                            Status: {day.status}
                        </div>
                    )}
                     {day.status === "Not Found" && (
                        <div className="text-xs text-center pt-2 text-muted-foreground">
                            No data recorded for this day.
                        </div>
                    )}

                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default SeriesDetailPopup;


    