
'use server';
/**
 * @fileOverview A Genkit flow to calculate the daily "Rejected" status rate.
 *
 * - getDailyNegativeStatusRateInRange - Calculates daily rejected rates.
 * - DateRangeFilterInput - The input type.
 * - DailyNegativeStatusRateInRangeOutput - The return type for this flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, type QueryConstraint } from 'firebase/firestore';
import type { DateRangeFilterInput, DailyNegativeStatusRateInRangeOutput as FlowOutput, RateChartDataPoint } from '@/lib/types';
import { mapDocToSheetRow } from '@/lib/tournament-config';
import { format as formatDate, parseISO, eachDayOfInterval, isValid } from 'date-fns';

const DateRangeFilterInputSchema = z.object({
  leadVenderFilter: z.string().nullable().describe("Optional: The 'LeadVender' name to filter. Null for all."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Start date in YYYY-MM-DD format."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("End date in YYYY-MM-DD format."),
});

const RateChartDataPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rate: z.number(), // Percentage
});

const DailyNegativeStatusRateInRangeOutputSchema = z.object({
  dailyRates: z.array(RateChartDataPointSchema),
  startDate: z.string(),
  endDate: z.string(),
  filterApplied: z.string().nullable(),
});

export async function getDailyNegativeStatusRateInRange(input: DateRangeFilterInput): Promise<FlowOutput> {
  console.log('[Genkit Flow getDailyNegativeStatusRateInRange] Called with input:', input);
  const result = await getDailyNegativeStatusRateInRangeFlow(input);
  console.log('[Genkit Flow getDailyNegativeStatusRateInRange] Result count:', result.dailyRates.length);
  return result;
}

const getDailyNegativeStatusRateInRangeFlow = ai.defineFlow(
  {
    name: 'getDailyNegativeStatusRateInRangeFlow',
    inputSchema: DateRangeFilterInputSchema,
    outputSchema: DailyNegativeStatusRateInRangeOutputSchema,
  },
  async (input: DateRangeFilterInput): Promise<FlowOutput> => {
    const { leadVenderFilter, startDate, endDate } = input;
    const dailyRates: RateChartDataPoint[] = [];

    console.log(`[Genkit Flow Internal - NegativeRateRange] Processing for ${startDate} to ${endDate}, filter: ${leadVenderFilter || 'None'}`);

    try {
      const parsedStartDate = parseISO(startDate);
      const parsedEndDate = parseISO(endDate);

      if (!isValid(parsedStartDate) || !isValid(parsedEndDate) || parsedEndDate < parsedStartDate) {
        console.error("[Genkit Flow Internal - NegativeRateRange] Invalid date range.");
        return { dailyRates: [], startDate, endDate, filterApplied: leadVenderFilter };
      }
      
      const datesInRange = eachDayOfInterval({ start: parsedStartDate, end: parsedEndDate });

      // Fetch all relevant rows in one go to optimize Firestore reads
      const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
      const queryConstraints: QueryConstraint[] = [
        where("Date", ">=", startDate),
        where("Date", "<=", endDate),
      ];
      if (leadVenderFilter) {
        queryConstraints.push(where("Lead Vender", "==", leadVenderFilter));
      }
      
      const q = query(sheetRowsCollectionRef, ...queryConstraints);
      const querySnapshot = await getDocs(q);
      
      // Pre-process rows into a map for quick lookup by date
      const rowsByDate: Map<string, { submitted: number, approved: number, rejected: number }> = new Map();
      querySnapshot.forEach(doc => {
        const row = mapDocToSheetRow(doc.id, doc.data());
        if (row && row.Date && row.Status) {
          if (row.Date >= startDate && row.Date <= endDate) { // Double check date range after mapping
            const counts = rowsByDate.get(row.Date) || { submitted: 0, approved: 0, rejected: 0 };
            if (row.Status === "Submitted") counts.submitted++;
            else if (row.Status === "Approved") counts.approved++;
            else if (row.Status === "Rejected") counts.rejected++;
            rowsByDate.set(row.Date, counts);
          }
        }
      });

      for (const dateObj of datesInRange) {
        const dateStr = formatDate(dateObj, 'yyyy-MM-dd');
        const counts = rowsByDate.get(dateStr) || { submitted: 0, approved: 0, rejected: 0 };
        
        const denominator = counts.submitted + counts.approved + counts.rejected;
        const rate = denominator > 0 ? (counts.rejected / denominator) * 100 : 0;
        
        dailyRates.push({
          date: dateStr,
          rate: parseFloat(rate.toFixed(2)), // Store rate as a number, rounded
        });
      }
      
      console.log(`[Genkit Flow Internal - NegativeRateRange] Processed ${dailyRates.length} days.`);
      return {
        dailyRates,
        startDate,
        endDate,
        filterApplied: leadVenderFilter,
      };

    } catch (error) {
      console.error("[Genkit Flow Internal - NegativeRateRange] Error:", error);
      return {
        dailyRates: [],
        startDate,
        endDate,
        filterApplied: leadVenderFilter,
      };
    }
  }
);
