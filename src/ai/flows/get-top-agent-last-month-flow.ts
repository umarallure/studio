
'use server';
/**
 * @fileOverview A Genkit flow to find the top performing agent based on submissions in the last 30 days.
 *
 * - getTopAgentLastMonth - A function that calculates the top agent.
 * - TopAgentLastMonthInput - The input type for the function.
 * - TopAgentLastMonthOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, type QueryConstraint } from 'firebase/firestore';
import { format as formatDate, subDays } from 'date-fns';
import type { SheetRow } from '@/lib/types';
import { mapDocToSheetRow } from '@/lib/tournament-config'; // Assuming this can map SheetRow

const TopAgentLastMonthInputSchema = z.object({
  leadVenderFilter: z.string().nullable().describe("Optional: The 'LeadVender' name to filter submissions for a specific center/team. If null, considers all teams."),
});
export type TopAgentLastMonthInput = z.infer<typeof TopAgentLastMonthInputSchema>;

const TopAgentLastMonthOutputSchema = z.object({
  agentName: z.string().nullable().describe("The name of the top performing agent. Null if no agent or no submissions."),
  submissionCount: z.number().describe("The total number of 'Submitted' entries by the top agent in the last 30 days."),
});
export type TopAgentLastMonthOutput = z.infer<typeof TopAgentLastMonthOutputSchema>;

export async function getTopAgentLastMonth(input: TopAgentLastMonthInput): Promise<TopAgentLastMonthOutput> {
  console.log('[Genkit Flow] getTopAgentLastMonth called with input:', input);
  const result = await getTopAgentLastMonthFlow(input);
  console.log('[Genkit Flow] getTopAgentLastMonth result:', result);
  return result;
}

const getTopAgentLastMonthFlow = ai.defineFlow(
  {
    name: 'getTopAgentLastMonthFlow',
    inputSchema: TopAgentLastMonthInputSchema,
    outputSchema: TopAgentLastMonthOutputSchema,
  },
  async (input: TopAgentLastMonthInput): Promise<TopAgentLastMonthOutput> => {
    const { leadVenderFilter } = input;    const endDate = new Date();
    const startDate = subDays(endDate, 30);
    
    const startDateStr = formatDate(startDate, 'yyyy-MM-dd');
    const endDateStr = formatDate(endDate, 'yyyy-MM-dd');

    console.log(`[Genkit Flow Internal - TopAgent] Processing for last 30 days: ${startDateStr} to ${endDateStr}, filter: ${leadVenderFilter || 'None'}`);

    try {
      const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
      const queryConstraints: QueryConstraint[] = [
        where("Date", ">=", startDateStr),
        where("Date", "<=", endDateStr),
        where("Status", "==", "Submitted")
      ];

      if (leadVenderFilter) {
        queryConstraints.push(where("Lead Vender", "==", leadVenderFilter)); // Corrected field name
      }

      const q = query(sheetRowsCollectionRef, ...queryConstraints);
      const querySnapshot = await getDocs(q);

      const agentSubmissions: Record<string, number> = {};

      querySnapshot.forEach(doc => {
        const row = mapDocToSheetRow(doc.id, doc.data()); // Use your existing mapper
        if (row && row.Agent) {
          agentSubmissions[row.Agent] = (agentSubmissions[row.Agent] || 0) + 1;
        }
      });

      if (Object.keys(agentSubmissions).length === 0) {
        console.log('[Genkit Flow Internal - TopAgent] No submitted entries found in the last 30 days with the given criteria.');
        return { agentName: null, submissionCount: 0 };
      }

      let topAgent: string | null = null;
      let maxSubmissions = 0;

      for (const agent in agentSubmissions) {
        if (agentSubmissions[agent] > maxSubmissions) {
          maxSubmissions = agentSubmissions[agent];
          topAgent = agent;
        }
      }
      
      console.log(`[Genkit Flow Internal - TopAgent] Top agent: ${topAgent} with ${maxSubmissions} submissions.`);
      return { agentName: topAgent, submissionCount: maxSubmissions };

    } catch (error) {
      console.error("[Genkit Flow Internal - TopAgent] Error in getTopAgentLastMonthFlow:", error);
      return { agentName: null, submissionCount: 0 };
    }
  }
);
