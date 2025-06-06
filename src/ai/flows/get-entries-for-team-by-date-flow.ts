
'use server';
/**
 * @fileOverview A Genkit flow to fetch 'Submitted' entries for a specific team on a specific date.
 *
 * - getEntriesForTeamByDate - Fetches submitted entries.
 * - GetEntriesForTeamByDateInput - Input type for the flow.
 * - GetEntriesForTeamByDateOutput - Output type (array of SheetRow).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, type QueryConstraint } from 'firebase/firestore';
import type { SheetRow } from '@/lib/types';
import { mapDocToSheetRow } from '@/lib/tournament-config';

const GetEntriesForTeamByDateInputSchema = z.object({
  teamName: z.string().describe("The 'Lead Vender' name of the team."),
  targetDate: z.string().describe("The target date in YYYY-MM-DD format."),
});
export type GetEntriesForTeamByDateInput = z.infer<typeof GetEntriesForTeamByDateInputSchema>;

// Define a Zod schema that matches the SheetRow type for output validation
const SheetRowSchema = z.object({
    id: z.string(),
    Agent: z.string().optional().nullable(),
    Date: z.string().optional().nullable(),
    FromCallback: z.boolean().optional().nullable(),
    INSURED_NAME: z.string().optional().nullable(),
    LeadVender: z.string().optional().nullable(),
    Notes: z.string().optional().nullable(),
    ProductType: z.string().optional().nullable(),
    Status: z.string().optional().nullable(),
});

const GetEntriesForTeamByDateOutputSchema = z.array(SheetRowSchema);
export type GetEntriesForTeamByDateOutput = z.infer<typeof GetEntriesForTeamByDateOutputSchema>;


export async function getEntriesForTeamByDate(input: GetEntriesForTeamByDateInput): Promise<GetEntriesForTeamByDateOutput> {
  console.log('[Genkit Flow] getEntriesForTeamByDate called with input:', input);
  const result = await getEntriesForTeamByDateFlow(input);
  console.log('[Genkit Flow] getEntriesForTeamByDate result count:', result.length);
  return result;
}

const getEntriesForTeamByDateFlow = ai.defineFlow(
  {
    name: 'getEntriesForTeamByDateFlow',
    inputSchema: GetEntriesForTeamByDateInputSchema,
    outputSchema: GetEntriesForTeamByDateOutputSchema,
  },
  async (input: GetEntriesForTeamByDateInput): Promise<GetEntriesForTeamByDateOutput> => {
    const { teamName, targetDate } = input;
    console.log(`[Genkit Flow Internal - TeamEntries] Processing for team: ${teamName}, date: ${targetDate}`);

    const entries: GetEntriesForTeamByDateOutput = [];

    try {
      const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
      
      const queryConstraints: QueryConstraint[] = [
        where("Date", "==", targetDate),
        where("Lead Vender", "==", teamName), // Uses "Lead Vender" with a space
        where("Status", "==", "Submitted")
      ];
      
      const q = query(sheetRowsCollectionRef, ...queryConstraints);
      const querySnapshot = await getDocs(q);
      
      querySnapshot.forEach(doc => {
        const rowData = mapDocToSheetRow(doc.id, doc.data());
        if (rowData) {
          // Ensure the mapped data conforms to SheetRowSchema for type safety if needed,
          // but mapDocToSheetRow should already produce compatible objects.
          entries.push(rowData as any); // Cast as any if mapDocToSheetRow doesn't return strictly Zod-inferred type
        }
      });
      
      console.log(`[Genkit Flow Internal - TeamEntries] Query returned ${entries.length} documents for team: ${teamName}, date: ${targetDate}.`);
      return entries;

    } catch (error) {
      console.error("[Genkit Flow Internal - TeamEntries] Error in getEntriesForTeamByDateFlow:", error);
      return []; // Return empty array on error
    }
  }
);
