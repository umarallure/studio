
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
  console.log('[Genkit Flow GetEntriesForTeamByDate] Called with input:', JSON.stringify(input));
  const result = await getEntriesForTeamByDateFlow(input);
  console.log('[Genkit Flow GetEntriesForTeamByDate] Result count:', result.length, 'First entry (if any):', result.length > 0 ? JSON.stringify(result[0]) : 'N/A');
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
    console.log(`[Genkit Flow Internal - TeamEntries] Processing for team: "${teamName}", date: "${targetDate}"`);

    const entries: GetEntriesForTeamByDateOutput = [];

    try {
      const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
      
      const queryConstraints: QueryConstraint[] = [
        where("Date", "==", targetDate),
        where("Lead Vender", "==", teamName), 
        where("Status", "==", "Submitted")
      ];
      
      console.log(`[Genkit Flow Internal - TeamEntries] Query constraints:`, JSON.stringify(queryConstraints.map(qc => ({_op: (qc as any)._op, _field: (qc as any)._fieldPath.segments.join('.'), _value: (qc as any)._value }))));
      const q = query(sheetRowsCollectionRef, ...queryConstraints);
      const querySnapshot = await getDocs(q);
      
      querySnapshot.forEach(doc => {
        // console.log(`[Genkit Flow Internal - TeamEntries] Processing doc ID: ${doc.id}, Data:`, JSON.stringify(doc.data()));
        const rowData = mapDocToSheetRow(doc.id, doc.data());
        if (rowData) {
          entries.push(rowData as any); 
        } else {
           console.warn(`[Genkit Flow Internal - TeamEntries] mapDocToSheetRow returned null for doc ID: ${doc.id}`);
        }
      });
      
      console.log(`[Genkit Flow Internal - TeamEntries] Query returned ${entries.length} documents for team: "${teamName}", date: "${targetDate}".`);
      return entries;

    } catch (error) {
      console.error(`[Genkit Flow Internal - TeamEntries] Error in getEntriesForTeamByDateFlow for team "${teamName}", date "${targetDate}":`, error);
      return []; // Return empty array on error
    }
  }
);

