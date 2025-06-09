"use client";

import React, { useState, useEffect } from 'react';
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
import { Loader2 } from "lucide-react";
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { format, subDays } from 'date-fns';
import { useToast } from "@/hooks/use-toast";

interface SeriesDetailPopupProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  matchupId: string | null;
  team1Name: string | null;
  roundId: string | null; // Add roundId prop
  team2Name: string | null;
  tournamentId: string | null; // Add tournamentId prop
}

interface DailyStats {
  date: string;
  team1Count: number;
  team2Count: number;
  team1Name: string;
  team2Name: string;
}

const SeriesDetailPopup: React.FC<SeriesDetailPopupProps> = ({
  isOpen,
  onOpenChange,
  matchupId,
  team1Name,
  team2Name,
  roundId,
  tournamentId,
}) => {
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast(); // Ensure useToast is imported and used

  useEffect(() => {
    if (!isOpen || !matchupId || !team1Name || !team2Name || !tournamentId) {
      setDailyStats([]);
      setError(null);
      return;
    }

    const fetchDailyStats = async () => {
      setIsLoading(true);
      setError(null);
      const stats: DailyStats[] = []; // Declared here
      try {
        const datesToFetch = Array.from({ length: 5 }).map((_, i) =>
          format(subDays(new Date(), i), 'yyyy-MM-dd')
        );

        if (!roundId || !tournamentId) {
           throw new Error("Missing roundId or tournamentId");
        }

        // Query the dailyResults subcollection for the last 5 days for the specific match
        const dailyResultsCollectionRef = collection(db, "tournaments", tournamentId, "rounds", roundId, "matches", matchupId, "dailyResults");

        // Fetch all daily result documents for the last 5 days
        const querySnapshot = await getDocs(query(dailyResultsCollectionRef,
          where("__name__", "in", datesToFetch) // Filter by document ID (which is the date string)
          // Optional: orderBy("Date") if you want results ordered by date from Firestore
        ));
        
        const dailyDataMap: { [date: string]: any } = {};
        querySnapshot.docs.forEach(doc => {
            dailyDataMap[doc.id] = doc.data();
        });

        // Process fetched documents to update daily stats
        datesToFetch.forEach(date => {
            const data = dailyDataMap[date];
            stats.push({
                date: format(new Date(date), 'MMM d'),
                team1Count: data?.team1Score || 0,
                team2Count: data?.team2Score || 0,
                team1Name: team1Name || "TBD",
                team2Name: team2Name || "TBD",
            });
        });

        // Sort stats by date (oldest first for display)
        stats.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setDailyStats(stats);
      } catch (err: any) { // Add type annotation for err
        console.error("Error fetching daily stats:", err);
        setError(`Failed to load daily stats: ${err.message}`); // Display error message
        toast({
          title: "Error",
          description: "Could not fetch daily submission data.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDailyStats(); // Call the async function

  }, [isOpen, matchupId, team1Name, team2Name, tournamentId, toast, roundId]); // Added roundId to dependencies

   // Determine overall maximum submissions for progress bar scaling
   const maxSubmissionsPerDay = dailyStats.reduce((max, day) => {
        const dayMax = Math.max(day.team1Count, day.team2Count);
        return dayMax > max ? dayMax : max;
    }, 0);


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] w-[95%] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Daily Submission Battle</DialogTitle>
          <DialogDescription>
            Submission counts for the last 5 days for this series.
          </DialogDescription>
        </DialogHeader>
        <Separator />
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg text-foreground">Loading Daily Stats...</p>
          </div>
        ) : error ? (
          <div className="text-center py-10 text-destructive">{error}</div>
        ) : (
          <ScrollArea className="flex-grow max-h-[60vh] p-4 -mx-4"> {/* Add negative margin to counter padding from parent */}
             {dailyStats.length === 0 ? (
                 <div className="text-center py-10 text-muted-foreground">No daily data available for the last 5 days.</div>
             ) : (
                <div className="flex flex-col gap-4">
                    {dailyStats.map((day, index) => (
                        <Card key={index}>
                            <CardHeader>
                                <CardTitle className="text-center text-md">{day.date}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-4">
                                <div className="flex justify-between items-center text-sm font-medium">
                                    <span>{day.team1Name}</span>
                                    <span>{day.team1Count} submissions</span>
                                </div>
                                <Progress value={maxSubmissionsPerDay > 0 ? (day.team1Count / maxSubmissionsPerDay) * 100 : 0} className="h-3" />

                                <Separator />

                                <div className="flex justify-between items-center text-sm font-medium">
                                    <span>{day.team2Name}</span>
                                    <span>{day.team2Count} submissions</span>
                                </div>
                                <Progress value={maxSubmissionsPerDay > 0 ? (day.team2Count / maxSubmissionsPerDay) * 100 : 0} className="h-3" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
             )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SeriesDetailPopup;