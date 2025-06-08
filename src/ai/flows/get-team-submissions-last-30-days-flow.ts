
'use server';
/**
 * @fileOverview A Genkit flow to count 'Submitted' entries for a team over the last 30 days.
 *
 * - getTeamSubmissionsLast30Days - Calculates the count.
 * - GetTeamSubmissionsLast30DaysInput - Input type for the flow.
 * - GetTeamSubmissionsLast30DaysOutput - Output type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, type QueryConstraint } from 'firebase/firestore';
import { format as formatDate, subDays, startOfDay, endOfDay } from 'date-fns';
import { mapDocToSheetRow } from '@/lib/tournament-config';

const GetTeamSubmissionsLast30DaysInputSchema = z.object({
  leadVenderFilter: z.string().nullable().describe("Optional: The 'LeadVender' name to filter entries for a specific center/team. If null, considers all teams for the 'Submitted' count."),
});
export type GetTeamSubmissionsLast30DaysInput = z.infer<typeof GetTeamSubmissionsLast30DaysInputSchema>;

const GetTeamSubmissionsLast30DaysOutputSchema = z.object({
  submissionCount: z.number().describe("The total number of 'Submitted' entries for the given filter over the last 30 days."),
  filterApplied: z.string().nullable().describe("The LeadVender filter that was applied, if any."),
  startDate: z.string().describe("The start date of the 30-day period (YYYY-MM-DD)."),
  endDate: z.string().describe("The end date of the 30-day period (YYYY-MM-DD)."),
});
export type GetTeamSubmissionsLast30DaysOutput = z.infer<typeof GetTeamSubmissionsLast30DaysOutputSchema>;


export async function getTeamSubmissionsLast30Days(input: GetTeamSubmissionsLast30DaysInput): Promise<GetTeamSubmissionsLast30DaysOutput> {
  console.log('[Genkit Flow getTeamSubmissionsLast30Days] Called with input:', input);
  const result = await getTeamSubmissionsLast30DaysFlow(input);
  console.log('[Genkit Flow getTeamSubmissionsLast30Days] Result:', result);
  return result;
}

const getTeamSubmissionsLast30DaysFlow = ai.defineFlow(
  {
    name: 'getTeamSubmissionsLast30DaysFlow',
    inputSchema: GetTeamSubmissionsLast30DaysInputSchema,
    outputSchema: GetTeamSubmissionsLast30DaysOutputSchema,
  },
  async (input: GetTeamSubmissionsLast30DaysInput): Promise<GetTeamSubmissionsLast30DaysOutput> => {
    const { leadVenderFilter } = input;

    const today = endOfDay(new Date()); // Use end of today for inclusive range
    const pastDate = startOfDay(subDays(today, 29)); // 29 days ago to make it 30 days inclusive of today

    const startDateStr = formatDate(pastDate, 'yyyy-MM-dd');
    const endDateStr = formatDate(today, 'yyyy-MM-dd');

    console.log(`[FlowInternal TeamSubmissions30D] Processing for ${startDateStr} to ${endDateStr}, filter: ${leadVenderFilter || 'All Teams'}`);

    try {
      const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
      const queryConstraints: QueryConstraint[] = [
        where("Date", ">=", startDateStr),
        where("Date", "<=", endDateStr),
        where("Status", "==", "Submitted") 
      ];

      if (leadVenderFilter) {
        queryConstraints.push(where("Lead Vender", "==", leadVenderFilter));
        console.log(`[FlowInternal TeamSubmissions30D] Applying LeadVender filter: '${leadVenderFilter}'`);
      } else {
        console.log(`[FlowInternal TeamSubmissions30D] Not applying LeadVender filter (counting all 'Submitted' entries).`);
      }

      const q = query(sheetRowsCollectionRef, ...queryConstraints);
      console.log(`[FlowInternal TeamSubmissions30D] Firestore Query Constraints:`, JSON.stringify(queryConstraints.map(qc => ({_op: (qc as any)._op, _field: (qc as any)._fieldPath.segments.join('.'), _value: (qc as any)._value }))));
      
      const querySnapshot = await getDocs(q);
      const submissionCount = querySnapshot.size;

      console.log(`[FlowInternal TeamSubmissions30D] Query returned ${submissionCount} 'Submitted' documents for filter '${leadVenderFilter || 'All Teams'}' in range ${startDateStr} to ${endDateStr}.`);
      
      // Optional: Log individual documents if count is low and filter is applied
      if (leadVenderFilter && submissionCount < 5 && submissionCount >= 0) { 
         console.log(`[FlowInternal TeamSubmissions30D] Listing matched documents for filter '${leadVenderFilter}':`);
         querySnapshot.forEach(doc => {
            const raw = doc.data();
            const mapped = mapDocToSheetRow(doc.id, raw); // Use your existing mapper for consistent field access
            console.log(`  - Doc ID: ${doc.id}, Mapped Date: ${mapped?.Date}, Mapped LeadVender: ${mapped?.LeadVender}, Mapped Status: ${mapped?.Status}`);
         });
      }


      return {
        submissionCount,
        filterApplied: leadVenderFilter,
        startDate: startDateStr,
        endDate: endDateStr,
      };

    } catch (error) {
      console.error(`[FlowInternal TeamSubmissions30D] Error for filter '${leadVenderFilter || 'All Teams'}':`, error);
      return {
        submissionCount: -1, // Indicate error with -1 or similar
        filterApplied: leadVenderFilter,
        startDate: startDateStr,
        endDate: endDateStr,
      };
    }
  }
);
