
'use server';
/**
 * @fileOverview A Genkit flow to fetch the daily result for a specific match.
 *
 * - getMatchDailyResult - Fetches a specific daily result.
 * - GetMatchDailyResultInput - Input type for the flow.
 * - GetMatchDailyResultOutput - Output type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/lib/firebase';
import { doc, getDoc, type DocumentData } from 'firebase/firestore';

const GetMatchDailyResultInputSchema = z.object({
  tournamentId: z.string().describe("The ID of the tournament."),
  roundNum: z.string().describe("The round number (e.g., '1', '2')."),
  matchId: z.string().describe("The match ID (e.g., 'match1')."),
  targetDate: z.string().describe("The target date in YYYY-MM-DD format."),
});
export type GetMatchDailyResultInput = z.infer<typeof GetMatchDailyResultInputSchema>;

const MatchDailyResultDataSchema = z.object({
  team1Name: z.string().nullable().describe("Name of team 1 for this daily result."),
  team2Name: z.string().nullable().describe("Name of team 2 for this daily result."),
  team1Score: z.number().describe("Score for team 1 on this day."),
  team2Score: z.number().describe("Score for team 2 on this day."),
  winner: z.string().nullable().describe("Name of the winning team for the day, or null if tie/not determined."),
  status: z.string().nullable().describe("Status of the daily result (e.g., Scheduled, Completed, Completed - Tie)."),
  exists: z.boolean().describe("Whether the daily result document was found."),
});
export type GetMatchDailyResultOutput = z.infer<typeof MatchDailyResultDataSchema>;


export async function getMatchDailyResult(input: GetMatchDailyResultInput): Promise<GetMatchDailyResultOutput> {
  console.log('[Genkit Flow] getMatchDailyResult called with input:', input);
  const result = await getMatchDailyResultFlow(input);
  console.log('[Genkit Flow] getMatchDailyResult result:', result);
  return result;
}

const getMatchDailyResultFlow = ai.defineFlow(
  {
    name: 'getMatchDailyResultFlow',
    inputSchema: GetMatchDailyResultInputSchema,
    outputSchema: MatchDailyResultDataSchema,
  },
  async (input: GetMatchDailyResultInput): Promise<GetMatchDailyResultOutput> => {
    const { tournamentId, roundNum, matchId, targetDate } = input;
    const defaultResponse: GetMatchDailyResultOutput = {
        team1Name: null, // These will be populated from matchup if not in daily doc
        team2Name: null,
        team1Score: 0,
        team2Score: 0,
        winner: null,
        status: "Not Found",
        exists: false,
    };

    try {
      const dailyResultDocRef = doc(
        db,
        "tournaments",
        tournamentId,
        "rounds",
        roundNum,
        'matches',
        matchId,
        'dailyResults',
        targetDate
      );
      
      const docSnap = await getDoc(dailyResultDocRef);

      if (!docSnap.exists()) {
        console.log(`[Genkit Flow Internal - MatchDailyResult] Document not found for T:${tournamentId}, R:${roundNum}, M:${matchId}, D:${targetDate}`);
        return defaultResponse;
      }

      const data = docSnap.data();
      const fields = data?.fields || data; // Handle both Firestore REST API structure and direct SDK structure

      if (!fields) {
        console.log(`[Genkit Flow Internal - MatchDailyResult] Document exists but data or fields are undefined for T:${tournamentId}, R:${roundNum}, M:${matchId}, D:${targetDate}`);
        return {...defaultResponse, exists: true, status: "Data Missing"};
      }
      
      // Helper to safely parse integer values
      const parseIntValue = (value: any): number => {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') return parseInt(value, 10) || 0;
        if (value && typeof value.integerValue === 'string') return parseInt(value.integerValue, 10) || 0;
        if (value && typeof value.integerValue === 'number') return value.integerValue;
        return 0;
      };
      
      // Helper to safely parse string values
       const parseStringValue = (value: any): string | null => {
        if (typeof value === 'string') return value;
        if (value && typeof value.stringValue === 'string') return value.stringValue;
        if (value && value.nullValue !== undefined) return null; // Explicit null
        return null;
      };
      
      return {
        team1Name: parseStringValue(fields.team1),
        team2Name: parseStringValue(fields.team2),
        team1Score: parseIntValue(fields.team1Score),
        team2Score: parseIntValue(fields.team2Score),
        winner: parseStringValue(fields.winner),
        status: parseStringValue(fields.status) || "Unknown",
        exists: true,
      };

    } catch (error) {
      console.error(`[Genkit Flow Internal - MatchDailyResult] Error for T:${tournamentId}, R:${roundNum}, M:${matchId}, D:${targetDate}:`, error);
      return {
        ...defaultResponse,
        status: error instanceof Error ? error.message : "Flow Error"
      };
    }
  }
);
