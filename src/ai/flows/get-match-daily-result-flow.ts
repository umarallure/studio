
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
  console.log('[Genkit Flow GetMatchDailyResult] Called with input:', JSON.stringify(input));
  const result = await getMatchDailyResultFlow(input);
  console.log('[Genkit Flow GetMatchDailyResult] Result:', JSON.stringify(result));
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
        team1Name: null, 
        team2Name: null,
        team1Score: 0,
        team2Score: 0,
        winner: null,
        status: "Not Found",
        exists: false,
    };
    
    const dailyResultDocPath = `tournaments/${tournamentId}/rounds/${roundNum}/matches/${matchId}/dailyResults/${targetDate}`;
    console.log(`[Genkit Flow Internal - MatchDailyResult] Attempting to fetch doc: ${dailyResultDocPath}`);

    try {
      const dailyResultDocRef = doc(db, dailyResultDocPath);
      const docSnap = await getDoc(dailyResultDocRef);

      if (!docSnap.exists()) {
        console.log(`[Genkit Flow Internal - MatchDailyResult] Document not found at ${dailyResultDocPath}`);
        return defaultResponse;
      }
      console.log(`[Genkit Flow Internal - MatchDailyResult] Document found at ${dailyResultDocPath}.`);

      const data = docSnap.data();
      // Handle both Firestore REST API structure (data.fields) and direct SDK structure (data directly)
      const fields = data?.fields || data; 

      if (!fields) {
        console.log(`[Genkit Flow Internal - MatchDailyResult] Document exists at ${dailyResultDocPath} but data or fields are undefined.`);
        return {...defaultResponse, exists: true, status: "Data Missing"};
      }
      
      console.log(`[Genkit Flow Internal - MatchDailyResult] Raw fields data for ${dailyResultDocPath}:`, JSON.stringify(fields));
      
      const parseIntValue = (value: any): number => {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') return parseInt(value, 10) || 0;
        if (value && typeof value.integerValue === 'string') return parseInt(value.integerValue, 10) || 0;
        if (value && typeof value.integerValue === 'number') return value.integerValue; // Handle if it's already a number
        console.warn(`[Genkit Flow Internal - MatchDailyResult] Could not parse integer from:`, value, `for ${dailyResultDocPath}`);
        return 0;
      };
      
       const parseStringValue = (value: any): string | null => {
        if (typeof value === 'string') return value;
        if (value && typeof value.stringValue === 'string') return value.stringValue;
        if (value && value.nullValue !== undefined) return null; 
        // console.warn(`[Genkit Flow Internal - MatchDailyResult] Could not parse string from:`, value, `for ${dailyResultDocPath}`);
        return null; // Be more graceful with missing string values
      };
      
      const parsedResult = {
        team1Name: parseStringValue(fields.team1),
        team2Name: parseStringValue(fields.team2),
        team1Score: parseIntValue(fields.team1Score),
        team2Score: parseIntValue(fields.team2Score),
        winner: parseStringValue(fields.winner),
        status: parseStringValue(fields.status) || "Unknown", // Default status if not found
        exists: true,
      };
      console.log(`[Genkit Flow Internal - MatchDailyResult] Parsed result for ${dailyResultDocPath}:`, JSON.stringify(parsedResult));
      return parsedResult;

    } catch (error) {
      console.error(`[Genkit Flow Internal - MatchDailyResult] Error for ${dailyResultDocPath}:`, error);
      return {
        ...defaultResponse,
        status: error instanceof Error ? error.message : "Flow Error"
      };
    }
  }
);

