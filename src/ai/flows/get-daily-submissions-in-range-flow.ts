'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, type QueryConstraint } from 'firebase/firestore';
import { subDays, format as formatDate } from 'date-fns';

const DailySubmissionsInRangeInputSchema = z.object({
  leadVenderFilter: z.string().nullable().describe("Optional: The 'LeadVender' name to filter submissions for a specific team."),
  daysToLookBack: z.number().describe("Number of days to look back from today."),
});

const DailySubmissionsInRangeOutputSchema = z.object({
  dailyStats: z.array(z.object({
    date: z.string().describe("The date in YYYY-MM-DD format"),
    count: z.number().describe("Number of submissions for this date"),
  })),
  filterApplied: z.string().nullable(),
});

export type DailySubmissionsInRangeInput = z.infer<typeof DailySubmissionsInRangeInputSchema>;
export type DailySubmissionsInRangeOutput = z.infer<typeof DailySubmissionsInRangeOutputSchema>;

export async function getDailySubmissionsInRange(input: DailySubmissionsInRangeInput): Promise<DailySubmissionsInRangeOutput> {
  try {
    const { leadVenderFilter, daysToLookBack } = input;
    
    const endDate = new Date();
    const startDate = subDays(endDate, daysToLookBack - 1);
    
    const startDateStr = formatDate(startDate, 'yyyy-MM-dd');
    const endDateStr = formatDate(endDate, 'yyyy-MM-dd');

    console.log(`[getDailySubmissionsInRange] Fetching submissions from ${startDateStr} to ${endDateStr}`);

    const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
    const queryConstraints: QueryConstraint[] = [
      where("Date", ">=", startDateStr),
      where("Date", "<=", endDateStr)
    ];

    if (leadVenderFilter) {
      queryConstraints.push(where("Lead Vender", "==", leadVenderFilter));
    }

    const q = query(sheetRowsCollectionRef, ...queryConstraints);
    const querySnapshot = await getDocs(q);

    // Initialize counts for all days in range
    const dailyCounts: { [key: string]: number } = {};

    // Count all entries per day
    querySnapshot.forEach(doc => {
      const data = doc.data();
      const date = data.Date;
      if (date) {
        dailyCounts[date] = (dailyCounts[date] || 0) + 1;
      }
    });

    // Convert to array format
    const dailyStats = Object.entries(dailyCounts).map(([date, count]) => ({
      date,
      count
    })).sort((a, b) => a.date.localeCompare(b.date));

    console.log(`[getDailySubmissionsInRange] Found ${dailyStats.length} days with submissions`);
    console.log('[getDailySubmissionsInRange] Sample data:', dailyStats.slice(0, 3));

    return {
      dailyStats,
      filterApplied: leadVenderFilter
    };

  } catch (error) {
    console.error("[getDailySubmissionsInRange] Error:", error);
    return {
      dailyStats: [],
      filterApplied: input.leadVenderFilter
    };
  }
}
