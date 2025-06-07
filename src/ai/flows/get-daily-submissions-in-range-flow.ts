
'use server';
/**
 * @fileOverview A Genkit flow to get daily "Submitted" entry counts within a date range.
 *
 * - getDailySubmissionsInRange - Fetches daily submission counts.
 * - DateRangeFilterInput - The input type.
 * - DailySubmissionsInRangeOutput - The return type for this flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, type QueryConstraint } from 'firebase/firestore';
import type { DateRangeFilterInput, DailySubmissionsInRangeOutput as FlowOutput, DailyChartDataPoint } from '@/lib/types';
import { mapDocToSheetRow } from '@/lib/tournament-config';
import { format as formatDate, parseISO, eachDayOfInterval, isValid } from 'date-fns';

const DateRangeFilterInputSchema = z.object({
  leadVenderFilter: z.string().nullable().describe("Optional: The 'LeadVender' name to filter. Null for all."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Start date in YYYY-MM-DD format."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("End date in YYYY-MM-DD format."),
});

const DailyChartDataPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number(),
});

const DailySubmissionsInRangeOutputSchema = z.object({
  dailySubmissions: z.array(DailyChartDataPointSchema),
  startDate: z.string(),
  endDate: z.string(),
  filterApplied: z.string().nullable(),
});


export async function getDailySubmissionsInRange(input: DateRangeFilterInput): Promise<FlowOutput> {
  console.log('[Genkit Flow getDailySubmissionsInRange] Called with input:', input);
  const result = await getDailySubmissionsInRangeFlow(input);
  console.log('[Genkit Flow getDailySubmissionsInRange] Result count:', result.dailySubmissions.length);
  return result;
}

const getDailySubmissionsInRangeFlow = ai.defineFlow(
  {
    name: 'getDailySubmissionsInRangeFlow',
    inputSchema: DateRangeFilterInputSchema,
    outputSchema: DailySubmissionsInRangeOutputSchema,
  },
  async (input: DateRangeFilterInput): Promise<FlowOutput> => {
    const { leadVenderFilter, startDate, endDate } = input;
    const dailySubmissions: DailyChartDataPoint[] = [];

    console.log(`[Genkit Flow Internal - DailySubmissionsRange] Processing for ${startDate} to ${endDate}, filter: ${leadVenderFilter || 'None'}`);

    try {
      const parsedStartDate = parseISO(startDate);
      const parsedEndDate = parseISO(endDate);

      if (!isValid(parsedStartDate) || !isValid(parsedEndDate) || parsedEndDate < parsedStartDate) {
        console.error("[Genkit Flow Internal - DailySubmissionsRange] Invalid date range.");
        return { dailySubmissions: [], startDate, endDate, filterApplied: leadVenderFilter };
      }
      
      const datesInRange = eachDayOfInterval({ start: parsedStartDate, end: parsedEndDate });

      // Fetch all relevant rows in one go
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
      
      const submittedRowsByDate: Map<string, number> = new Map();
      querySnapshot.forEach(doc => {
        const row = mapDocToSheetRow(doc.id, doc.data());
        if (row && row.Status === "Submitted" && row.Date) {
           if (row.Date >= startDate && row.Date <= endDate) { // Double check date after mapping
             submittedRowsByDate.set(row.Date, (submittedRowsByDate.get(row.Date) || 0) + 1);
           }
        }
      });

      for (const dateObj of datesInRange) {
        const dateStr = formatDate(dateObj, 'yyyy-MM-dd');
        dailySubmissions.push({
          date: dateStr,
          count: submittedRowsByDate.get(dateStr) || 0,
        });
      }
      
      console.log(`[Genkit Flow Internal - DailySubmissionsRange] Processed ${dailySubmissions.length} days.`);
      return {
        dailySubmissions,
        startDate,
        endDate,
        filterApplied: leadVenderFilter,
      };

    } catch (error) {
      console.error("[Genkit Flow Internal - DailySubmissionsRange] Error:", error);
      return {
        dailySubmissions: [],
        startDate,
        endDate,
        filterApplied: leadVenderFilter,
      };
    }
  }
);
