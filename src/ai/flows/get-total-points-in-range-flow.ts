
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

    console.log(`[Genkit Flow Internal - TotalPoints] INPUT: leadVenderFilter="${leadVenderFilter}", startDate="${startDate}", endDate="${endDate}"`);

    try {
      const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
      // MODIFICATION: Removed LeadVender filter from Firestore query
      const queryConstraints: QueryConstraint[] = [
        where("Date", ">=", startDate),
        where("Date", "<=", endDate),
      ];

      // if (leadVenderFilter) {
      //   queryConstraints.push(where("Lead Vender", "==", leadVenderFilter));
      //   console.log(`[Genkit Flow Internal - TotalPoints] Added LeadVender filter: "${leadVenderFilter}" TO QUERY`);
      // } else {
      //    console.log(`[Genkit Flow Internal - TotalPoints] No LeadVender filter applied to Firestore query.`);
      // }
      
      const q = query(sheetRowsCollectionRef, ...queryConstraints);
      console.log(`[Genkit Flow Internal - TotalPoints] Firestore query (DATE ONLY) constraints: ${JSON.stringify(queryConstraints.map(qc => ({_op: (qc as any)._op, _field: (qc as any)._fieldPath.segments.join('.'), _value: (qc as any)._value })))}`);
      const querySnapshot = await getDocs(q);
      
      console.log(`[Genkit Flow Internal - TotalPoints] Firestore query (DATE ONLY) returned ${querySnapshot.size} documents.`);

      querySnapshot.forEach(doc => {
        const rawData = doc.data();
        console.log(`[Genkit Flow Internal - TotalPoints] Processing doc ID: ${doc.id}, Raw Data:`, JSON.stringify(rawData));
        const row = mapDocToSheetRow(doc.id, rawData);

        if (row) {
          console.log(`[Genkit Flow Internal - TotalPoints] Mapped row ID ${row.id}: LeadVender="${row.LeadVender}", Date="${row.Date}", Status="${row.Status}"`);
          
          // MODIFICATION: Apply leadVenderFilter here in code
          const filterToCompare = leadVenderFilter ? leadVenderFilter.trim() : null;
          const rowLeadVender = row.LeadVender ? row.LeadVender.trim() : null;
          const matchesLeadVender = !filterToCompare || (rowLeadVender === filterToCompare);

          if (!matchesLeadVender) {
            console.log(`[Genkit Flow Internal - TotalPoints] SKIPPED counting doc ID ${row.id} due to LeadVender mismatch (row: '${rowLeadVender}', filter: '${filterToCompare}').`);
            return; 
          }

          if (row.Status === "Submitted") {
            if (row.Date && row.Date >= startDate && row.Date <= endDate) {
                totalPoints++;
                console.log(`[Genkit Flow Internal - TotalPoints] COUNTED point for doc ID ${row.id} (Status: "${row.Status}", LeadVender: "${row.LeadVender}", Date: "${row.Date}"). Current total: ${totalPoints}`);
            } else {
                console.log(`[Genkit Flow Internal - TotalPoints] Doc ID ${row.id} was "Submitted" and matched LeadVender filter, but date ("${row.Date}") out of range [${startDate}, ${endDate}] or date missing after map.`);
            }
          } else {
            console.log(`[Genkit Flow Internal - TotalPoints] Doc ID ${row.id} (LeadVender: "${row.LeadVender}", Date: "${row.Date}") matched LeadVender filter BUT was NOT "Submitted" (Status: "${row.Status}").`);
          }
        } else {
            console.warn(`[Genkit Flow Internal - TotalPoints] mapDocToSheetRow returned null for doc ID: ${doc.id}. Raw Data:`, JSON.stringify(rawData));
        }
      });
      
      console.log(`[Genkit Flow Internal - TotalPoints] FINAL count: ${totalPoints} "Submitted" points found for the given criteria (filter: '${leadVenderFilter || 'None'}').`);
      return {
        totalPoints,
        startDate,
        endDate,
        filterApplied: leadVenderFilter,
      };

    } catch (error)
      {
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

