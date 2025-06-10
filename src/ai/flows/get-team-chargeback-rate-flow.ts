'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, type QueryConstraint } from 'firebase/firestore';
import { subDays } from 'date-fns';
import { format as formatDate } from 'date-fns';

const TeamChargebackRateInputSchema = z.object({
  leadVenderFilter: z.string().nullable().describe("The 'LeadVender' name to filter entries for a specific team."),
});

const TeamChargebackRateOutputSchema = z.object({
  chargebackRate: z.number().describe("The chargeback rate (percentage)"),
  totalEntries: z.number().describe("Total number of entries"),
  submittedEntries: z.number().describe("Number of submitted entries"),
  filterApplied: z.string().nullable().describe("The team filter that was applied"),
});

export type TeamChargebackRateInput = z.infer<typeof TeamChargebackRateInputSchema>;
export type TeamChargebackRateOutput = z.infer<typeof TeamChargebackRateOutputSchema>;

export async function getTeamChargebackRate(input: TeamChargebackRateInput): Promise<TeamChargebackRateOutput> {
  console.log('[Genkit Flow] getTeamChargebackRate called with input:', input);
  const result = await getTeamChargebackRateFlow(input);
  console.log('[Genkit Flow] getTeamChargebackRate result:', result);
  return result;
}

const getTeamChargebackRateFlow = ai.defineFlow(
  {
    name: 'getTeamChargebackRateFlow',
    description: 'Calculate chargeback rate for a team over the last 30 days',
    inputSchema: TeamChargebackRateInputSchema,
    outputSchema: TeamChargebackRateOutputSchema,
  },
  async (input: TeamChargebackRateInput) => {
    try {
      const { leadVenderFilter } = input;
      
      // Calculate date range
      const endDate = new Date();
      const startDate = subDays(endDate, 30);
      const startDateStr = formatDate(startDate, 'yyyy-MM-dd');
      const endDateStr = formatDate(endDate, 'yyyy-MM-dd');

      const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
      
      // Query constraints for total entries
      const totalQueryConstraints: QueryConstraint[] = [
        where("Date", ">=", startDateStr),
        where("Date", "<=", endDateStr),
      ];

      // Query constraints for submitted entries
      const submittedQueryConstraints: QueryConstraint[] = [
        ...totalQueryConstraints,
        where("Status", "==", "Submitted")
      ];

      // Add team filter if specified
      if (leadVenderFilter) {
        totalQueryConstraints.push(where("Lead Vender", "==", leadVenderFilter));
        submittedQueryConstraints.push(where("Lead Vender", "==", leadVenderFilter));
      }

      // Execute queries in parallel
      const [totalSnapshot, submittedSnapshot] = await Promise.all([
        getDocs(query(sheetRowsCollectionRef, ...totalQueryConstraints)),
        getDocs(query(sheetRowsCollectionRef, ...submittedQueryConstraints))
      ]);

      const totalEntries = totalSnapshot.size;
      const submittedEntries = submittedSnapshot.size;
      
      // Calculate chargeback rate
      const chargebackRate = totalEntries > 0 
        ? (submittedEntries / totalEntries) * 100 
        : 0;

      console.log(`[Genkit Flow Internal] Team: ${leadVenderFilter || 'All'}, Total: ${totalEntries}, Submitted: ${submittedEntries}, Rate: ${chargebackRate.toFixed(2)}%`);

      return {
        chargebackRate,
        totalEntries,
        submittedEntries,
        filterApplied: leadVenderFilter
      };

    } catch (error) {
      console.error("[Genkit Flow Internal] Error in getTeamChargebackRateFlow:", error);
      return {
        chargebackRate: 0,
        totalEntries: 0,
        submittedEntries: 0,
        filterApplied: input.leadVenderFilter
      };
    }
  }
);
