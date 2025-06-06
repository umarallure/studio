
'use server';
/**
 * @fileOverview A Genkit flow to fetch scheduled dates for a specific match.
 *
 * - getMatchScheduledDates - Fetches all document IDs (dates) from the dailyResults subcollection.
 * - GetMatchScheduledDatesInput - Input type for the flow.
 * - GetMatchScheduledDatesOutput - Output type for the flow (array of date strings).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

const GetMatchScheduledDatesInputSchema = z.object({
  tournamentId: z.string().describe("The ID of the tournament."),
  roundNum: z.string().describe("The round number (e.g., '1', '2')."),
  matchId: z.string().describe("The match ID (e.g., 'match1')."),
});
export type GetMatchScheduledDatesInput = z.infer<typeof GetMatchScheduledDatesInputSchema>;

const GetMatchScheduledDatesOutputSchema = z.array(z.string().describe("Date string in YYYY-MM-DD format."));
export type GetMatchScheduledDatesOutput = z.infer<typeof GetMatchScheduledDatesOutputSchema>;


export async function getMatchScheduledDates(input: GetMatchScheduledDatesInput): Promise<GetMatchScheduledDatesOutput> {
  console.log('[Genkit Flow GetMatchScheduledDates] Called with input:', JSON.stringify(input));
  const result = await getMatchScheduledDatesFlow(input);
  console.log('[Genkit Flow GetMatchScheduledDates] Result (dates):', JSON.stringify(result));
  return result;
}

const getMatchScheduledDatesFlow = ai.defineFlow(
  {
    name: 'getMatchScheduledDatesFlow',
    inputSchema: GetMatchScheduledDatesInputSchema,
    outputSchema: GetMatchScheduledDatesOutputSchema,
  },
  async (input: GetMatchScheduledDatesInput): Promise<GetMatchScheduledDatesOutput> => {
    const { tournamentId, roundNum, matchId } = input;
    const dates: string[] = [];
    console.log(`[Genkit Flow Internal - MatchScheduledDates] Processing for T:${tournamentId}, R:${roundNum}, M:${matchId}`);

    try {
      const dailyResultsCollectionPath = `tournaments/${tournamentId}/rounds/${roundNum}/matches/${matchId}/dailyResults`;
      const dailyResultsCollectionRef = collection(db, dailyResultsCollectionPath);
      
      // Order by document ID (__name__) which is the date string YYYY-MM-DD
      const q = query(dailyResultsCollectionRef, orderBy('__name__'));
      const querySnapshot = await getDocs(q);

      querySnapshot.forEach(doc => {
        dates.push(doc.id); // The document ID is the date string
      });
      
      console.log(`[Genkit Flow Internal - MatchScheduledDates] Found ${dates.length} scheduled dates for path ${dailyResultsCollectionPath}. Dates: ${dates.join(', ')}`);
      return dates.sort(); // Ensure chronological sort just in case Firestore __name__ order has nuances

    } catch (error) {
      console.error(`[Genkit Flow Internal - MatchScheduledDates] Error for T:${tournamentId}, R:${roundNum}, M:${matchId}:`, error);
      return []; // Return empty array on error
    }
  }
);

