
'use server';
/**
 * @fileOverview A Genkit flow to calculate total "Submitted" points within a date range.
 *
 * - getTotalPointsInRange - Calculates total submitted entries in a range.
 * - DateRangeFilterInput - The input type (shared with other range flows).
 * - TotalPointsInRangeOutput - The return type for this flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, type QueryConstraint } from 'firebase/firestore';
import type { DateRangeFilterInput, TotalPointsInRangeOutput as FlowOutput } from '@/lib/types';
import { mapDocToSheetRow } from '@/lib/tournament-config'; // To handle potential 'fields' wrapper

const DateRangeFilterInputSchema = z.object({
  leadVenderFilter: z.string().nullable().describe("Optional: The 'LeadVender' name to filter. Null for all."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Start date in YYYY-MM-DD format."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("End date in YYYY-MM-DD format."),
});

const TotalPointsInRangeOutputSchema = z.object({
  totalPoints: z.number().describe("Total 'Submitted' entries in the range."),
  startDate: z.string().describe("Start date processed."),
  endDate: z.string().describe("End date processed."),
  filterApplied: z.string().nullable().describe("The LeadVender filter applied, if any."),
});

export async function getTotalPointsInRange(input: DateRangeFilterInput): Promise<FlowOutput> {
  console.log('[Genkit Flow getTotalPointsInRange] Called with input:', input);
  const result = await getTotalPointsInRangeFlow(input);
  console.log('[Genkit Flow getTotalPointsInRange] Result:', result);
  return result;
}

const getTotalPointsInRangeFlow = ai.defineFlow(
  {
    name: 'getTotalPointsInRangeFlow',
    inputSchema: DateRangeFilterInputSchema,
    outputSchema: TotalPointsInRangeOutputSchema,
  },
  async (input: DateRangeFilterInput): Promise<FlowOutput> => {
    const { leadVenderFilter, startDate, endDate } = input;
    let totalPoints = 0;

    console.log(`[Genkit Flow Internal - TotalPoints] Processing for ${startDate} to ${endDate}, filter: ${leadVenderFilter || 'None'}`);

    try {
      const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
      const queryConstraints: QueryConstraint[] = [
        where("Date", ">=", startDate),
        where("Date", "<=", endDate),
        // No, we cannot filter by Status == "Submitted" here directly AND use mapDocToSheetRow efficiently for robust status checking.
        // We fetch all docs in range and filter status after mapping.
      ];

      if (leadVenderFilter) {
        queryConstraints.push(where("Lead Vender", "==", leadVenderFilter));
      }
      
      const q = query(sheetRowsCollectionRef, ...queryConstraints);
      const querySnapshot = await getDocs(q);
      
      querySnapshot.forEach(doc => {
        const row = mapDocToSheetRow(doc.id, doc.data());
        if (row && row.Status === "Submitted") {
            // Additional check for date match because Firestore where clauses on date strings
            // might sometimes include boundary days incorrectly if times are involved or string comparisons act oddly.
            // Explicitly check if row.Date is within [startDate, endDate]
             if (row.Date && row.Date >= startDate && row.Date <= endDate) {
                totalPoints++;
            }
        }
      });
      
      console.log(`[Genkit Flow Internal - TotalPoints] Query returned ${querySnapshot.size} docs, ${totalPoints} submitted points found for range.`);
      return {
        totalPoints,
        startDate,
        endDate,
        filterApplied: leadVenderFilter,
      };

    } catch (error) {
      console.error("[Genkit Flow Internal - TotalPoints] Error:", error);
      return {
        totalPoints: 0,
        startDate,
        endDate,
        filterApplied: leadVenderFilter,
      };
    }
  }
);
