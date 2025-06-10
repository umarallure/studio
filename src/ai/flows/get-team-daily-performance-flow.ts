'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, type QueryConstraint } from 'firebase/firestore';

const GetTeamDailyPerformanceInputSchema = z.object({
  teamName: z.string().describe("The team name to get stats for"),
  targetDate: z.string().describe("The date in YYYY-MM-DD format"),
});

const GetTeamDailyPerformanceOutputSchema = z.object({
  totalEntries: z.number(),
  submittedEntries: z.number(),
  chargebackEntries: z.number(),
  submissionRate: z.number(),
  chargebackRate: z.number(),
  bestAgent: z.object({
    name: z.string(),
    submissionCount: z.number(),
  }),
});

export type GetTeamDailyPerformanceInput = z.infer<typeof GetTeamDailyPerformanceInputSchema>;
export type GetTeamDailyPerformanceOutput = z.infer<typeof GetTeamDailyPerformanceOutputSchema>;

export const getTeamDailyPerformance = ai.defineFlow(
  {
    name: 'getTeamDailyPerformanceFlow',
    inputSchema: GetTeamDailyPerformanceInputSchema,
    outputSchema: GetTeamDailyPerformanceOutputSchema,
  },
  async (input: GetTeamDailyPerformanceInput): Promise<GetTeamDailyPerformanceOutput> => {
    const { teamName, targetDate } = input;

    try {
      const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
      const queryConstraints: QueryConstraint[] = [
        where("Date", "==", targetDate),
        where("Lead Vender", "==", teamName)
      ];

      const q = query(sheetRowsCollectionRef, ...queryConstraints);
      const querySnapshot = await getDocs(q);

      let totalEntries = 0;
      let submittedEntries = 0;
      const agentStats: { [key: string]: number } = {};

      querySnapshot.forEach(doc => {
        const data = doc.data();
        totalEntries++;
        
        if (data.Status === "Submitted") {
          submittedEntries++;
        }

        // Track agent submissions
        if (data.Agent) {
          agentStats[data.Agent] = (agentStats[data.Agent] || 0) + 1;
        }
      });

      const chargebackEntries = totalEntries - submittedEntries;
      const submissionRate = totalEntries > 0 ? (submittedEntries / totalEntries) * 100 : 0;
      const chargebackRate = totalEntries > 0 ? (chargebackEntries / totalEntries) * 100 : 0;

      // Find best performing agent
      let bestAgent = { name: "N/A", submissionCount: 0 };
      Object.entries(agentStats).forEach(([agent, count]) => {
        if (count > bestAgent.submissionCount) {
          bestAgent = { name: agent, submissionCount: count };
        }
      });

      return {
        totalEntries,
        submittedEntries,
        chargebackEntries,
        submissionRate: parseFloat(submissionRate.toFixed(2)),
        chargebackRate: parseFloat(chargebackRate.toFixed(2)),
        bestAgent,
      };

    } catch (error) {
      console.error('[getTeamDailyPerformanceFlow] Error:', error);
      return {
        totalEntries: 0,
        submittedEntries: 0,
        chargebackEntries: 0,
        submissionRate: 0,
        chargebackRate: 0,
        bestAgent: { name: "N/A", submissionCount: 0 },
      };
    }
  }
);
