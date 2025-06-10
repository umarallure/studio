'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, type QueryConstraint } from 'firebase/firestore';
import { subDays, format as formatDate, parseISO, isValid } from 'date-fns';

const DailyChargebackRateInputSchema = z.object({
  leadVenderFilter: z.string().nullable().describe("Optional: The 'LeadVender' name to filter submissions for a specific team."),
  daysToLookBack: z.number().describe("Number of days to look back from today."),
});

const DailyChargebackRateOutputSchema = z.object({
  dailyStats: z.array(z.object({
    date: z.string().describe("The date in YYYY-MM-DD format"),
    rate: z.number().describe("Chargeback rate for this date (percentage)"),
    totalEntries: z.number().describe("Total entries for this date"),
    chargebackEntries: z.number().describe("Number of chargeback entries for this date"),
  })),
  filterApplied: z.string().nullable(),
});

export type DailyChargebackRateInput = z.infer<typeof DailyChargebackRateInputSchema>;
export type DailyChargebackRateOutput = z.infer<typeof DailyChargebackRateOutputSchema>;

export async function getDailyChargebackRate(input: DailyChargebackRateInput): Promise<DailyChargebackRateOutput> {
  console.log('[Genkit Flow] getDailyChargebackRate called with input:', input);
  const result = await getDailyChargebackRateFlow(input);
  console.log('[Genkit Flow] getDailyChargebackRate result:', result);
  return result;
}

const getDailyChargebackRateFlow = ai.defineFlow(
  {
    name: 'getDailyChargebackRateFlow',
    description: 'Get daily chargeback rates for a date range',
    inputSchema: DailyChargebackRateInputSchema,
    outputSchema: DailyChargebackRateOutputSchema,
  },
  async (input: DailyChargebackRateInput) => {
    try {
      const { leadVenderFilter, daysToLookBack } = input;
      
      const endDate = new Date();
      const startDate = subDays(endDate, daysToLookBack - 1); // -1 because we want to include today
      
      const startDateStr = formatDate(startDate, 'yyyy-MM-dd');
      const endDateStr = formatDate(endDate, 'yyyy-MM-dd');

      // Validate dates
      if (!isValid(startDate) || !isValid(endDate) || endDate < startDate) {
        console.error("[Genkit Flow Internal] Invalid date range:", { startDateStr, endDateStr });
        return { dailyStats: [], filterApplied: leadVenderFilter };
      }

      console.log(`[Genkit Flow Internal] Processing chargeback rates from ${startDateStr} to ${endDateStr}`);

      const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
      
      // Initialize stats for all days in range
      const dailyStats: Record<string, { total: number, chargebacks: number }> = {};
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = formatDate(currentDate, 'yyyy-MM-dd');
        dailyStats[dateStr] = { total: 0, chargebacks: 0 };
        currentDate = new Date(currentDate.setDate(currentDate.getDate() + 1));
      }

      // Query all entries in date range
      const queryConstraints: QueryConstraint[] = [
        where("Date", ">=", startDateStr),
        where("Date", "<=", endDateStr),
      ];

      if (leadVenderFilter) {
        queryConstraints.push(where("Lead Vender", "==", leadVenderFilter));
      }

      const q = query(sheetRowsCollectionRef, ...queryConstraints);
      const querySnapshot = await getDocs(q);

      // Process entries
      querySnapshot.forEach(doc => {
        const data = doc.data();
        const date = data.Date;
        if (date && dailyStats.hasOwnProperty(date)) {
          dailyStats[date].total++;
          // Count as chargeback if status is NOT "Submitted"
          if (data.Status !== "Submitted") {
            dailyStats[date].chargebacks++;
          }
        }
      });

      console.log('[getDailyChargebackRateFlow] Daily stats sample:', 
        Object.entries(dailyStats).slice(0, 3).map(([date, stats]) => ({
          date,
          total: stats.total,
          chargebacks: stats.chargebacks,
          nonSubmitted: `${stats.chargebacks} non-submitted out of ${stats.total} total`,
          rate: stats.total > 0 ? (stats.chargebacks / stats.total) * 100 : 0
        }))
      );

      // Calculate daily rates and convert to array format
      const result = Object.entries(dailyStats)
        .map(([date, stats]) => ({
          date,
          totalEntries: stats.total,
          chargebackEntries: stats.chargebacks,
          rate: parseFloat((stats.total > 0 ? (stats.chargebacks / stats.total) * 100 : 0).toFixed(2))
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        dailyStats: result,
        filterApplied: leadVenderFilter
      };

    } catch (error) {
      console.error("[Genkit Flow Internal] Error in getDailyChargebackRateFlow:", error);
      return {
        dailyStats: [],
        filterApplied: input.leadVenderFilter
      };
    }
  }
);
