
'use server';
/**
 * @fileOverview A Genkit flow to calculate daily submissions for the dashboard.
 *
 * - getDailySubmissions - A function that calculates daily submissions.
 * - DailySubmissionsInput - The input type for the getDailySubmissions function.
 * - DailySubmissionsOutput - The return type for the getDailySubmissions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, type QueryConstraint } from 'firebase/firestore';
// mapDocToSheetRow and SheetRow are not strictly needed if we only count via query.size
// import { mapDocToSheetRow } from '@/lib/tournament-config';
// import type { SheetRow } from '@/lib/types';
import { format as formatDate } from 'date-fns';

const DailySubmissionsInputSchema = z.object({
  targetDate: z.string().describe("The target date for submissions in YYYY-MM-DD format."),
  leadVenderFilter: z.string().nullable().optional().describe("Optional: The 'LeadVender' name to filter submissions for a specific center/team. If null or undefined, all submissions for the date are counted."),
});
export type DailySubmissionsInput = z.infer<typeof DailySubmissionsInputSchema>;

const DailySubmissionsOutputSchema = z.object({
  submissionCount: z.number().describe("The total number of 'Submitted' entries for the given date and filter."),
  processedDate: z.string().describe("The date for which submissions were processed."),
  filterApplied: z.string().nullable().optional().describe("The LeadVender filter that was applied, if any."),
});
export type DailySubmissionsOutput = z.infer<typeof DailySubmissionsOutputSchema>;


export async function getDailySubmissions(input: DailySubmissionsInput): Promise<DailySubmissionsOutput> {
  console.log('[Genkit Flow] getDailySubmissions called with input:', input);
  const result = await getDailySubmissionsFlow(input);
  console.log('[Genkit Flow] getDailySubmissions result:', result);
  return result;
}

// This flow does not use an LLM prompt, it directly queries Firestore.
const getDailySubmissionsFlow = ai.defineFlow(
  {
    name: 'getDailySubmissionsFlow',
    inputSchema: DailySubmissionsInputSchema,
    outputSchema: DailySubmissionsOutputSchema,
  },
  async (input: DailySubmissionsInput) => {
    let submissionCount = 0;
    const { targetDate, leadVenderFilter } = input;
    console.log(`[Genkit Flow Internal] Processing for date: ${targetDate}, filter: ${leadVenderFilter || 'None'}`);

    try {
      const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
      
      const queryConstraints: QueryConstraint[] = [
        where("Date", "==", targetDate), // Assumes 'Date' field in Firestore is a 'YYYY-MM-DD' string
        where("Status", "==", "Submitted") // Assumes 'Status' field is a string
      ];

      if (leadVenderFilter) {
        queryConstraints.push(where("Lead Vender", "==", leadVenderFilter)); // Corrected field name
      }
      
      const q = query(sheetRowsCollectionRef, ...queryConstraints);
      console.log(`[Genkit Flow Internal] Executing Firestore query for date: ${targetDate}, filter: ${leadVenderFilter || 'None'}. Constraints: ${JSON.stringify(queryConstraints.map(qc => (qc as any)._op + " " + (qc as any)._field + " " + (qc as any)._value))}`);
      
      const querySnapshot = await getDocs(q);
      submissionCount = querySnapshot.size;
      
      console.log(`[Genkit Flow Internal] Query returned ${submissionCount} documents for date: ${targetDate}, filter: ${leadVenderFilter || 'None'}.`);
      
      return {
        submissionCount,
        processedDate: targetDate,
        filterApplied: leadVenderFilter
      };

    } catch (error) {
      console.error("[Genkit Flow Internal] Error in getDailySubmissionsFlow:", error);
      // For a production app, you might want to throw a more specific error or return a default error structure.
      // For now, we'll return 0 count on error to prevent dashboard crash.
      return {
        submissionCount: 0,
        processedDate: targetDate,
        filterApplied: leadVenderFilter,
        // You could add an error field to the output schema if needed:
        // error: error instanceof Error ? error.message : "Unknown error occurred" 
      };
    }
  }
);
