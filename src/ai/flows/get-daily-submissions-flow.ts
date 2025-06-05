
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
import { collection, query, where, getDocs, type DocumentData } from 'firebase/firestore';
import { mapDocToSheetRow } from '@/lib/tournament-config';
import type { SheetRow } from '@/lib/types';
import { format as formatDate } from 'date-fns';

export const DailySubmissionsInputSchema = z.object({
  targetDate: z.string().describe("The target date for submissions in YYYY-MM-DD format."),
  leadVenderFilter: z.string().nullable().optional().describe("Optional: The 'LeadVender' name to filter submissions for a specific center/team. If null or undefined, all submissions for the date are counted."),
});
export type DailySubmissionsInput = z.infer<typeof DailySubmissionsInputSchema>;

export const DailySubmissionsOutputSchema = z.object({
  submissionCount: z.number().describe("The total number of 'Submitted' entries for the given date and filter."),
  processedDate: z.string().describe("The date for which submissions were processed."),
  filterApplied: z.string().nullable().optional().describe("The LeadVender filter that was applied, if any."),
});
export type DailySubmissionsOutput = z.infer<typeof DailySubmissionsOutputSchema>;


export async function getDailySubmissions(input: DailySubmissionsInput): Promise<DailySubmissionsOutput> {
  return getDailySubmissionsFlow(input);
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

    try {
      const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
      
      // Firestore queries can be complex with multiple conditions.
      // We'll fetch based on date first if possible, or fetch all and filter locally if date filtering isn't direct on string.
      // For simplicity, we'll fetch all and filter in code. For large datasets, optimize Firestore query.
      
      const q = query(sheetRowsCollectionRef); // Potentially add where clauses if fields are indexed & suitable for direct query
      const querySnapshot = await getDocs(q);
      
      querySnapshot.forEach((doc) => {
        const rowData = mapDocToSheetRow(doc.id, doc.data() as DocumentData);
        if (rowData) {
          const rowDateStr = rowData.Date; // Assuming this is already normalized by Apps Script or mapDocToSheetRow
          
          let match = true;
          if (rowDateStr !== targetDate) {
            match = false;
          }
          if (leadVenderFilter && rowData.LeadVender !== leadVenderFilter) {
            match = false;
          }
          if (rowData.Status !== "Submitted") {
            match = false;
          }

          if (match) {
            submissionCount++;
          }
        }
      });

      return {
        submissionCount,
        processedDate: targetDate,
        filterApplied: leadVenderFilter
      };

    } catch (error) {
      console.error("Error in getDailySubmissionsFlow:", error);
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
