'use server';
/**
 * @fileOverview A Genkit flow to get chargeback rate comparison between current and previous periods.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, type QueryConstraint } from 'firebase/firestore';
import { format as formatDate, subDays, startOfDay, endOfDay } from 'date-fns';

const GetChargebackComparisonInputSchema = z.object({
  leadVenderFilter: z.string().nullable().describe("Optional: The 'LeadVender' name to filter. Null for all."),
  currentPeriodDays: z.number().default(30).describe("Number of days in the current period. Defaults to 30."),
});
export type GetChargebackComparisonInput = z.infer<typeof GetChargebackComparisonInputSchema>;

const GetChargebackComparisonOutputSchema = z.object({
  currentPeriod: z.object({
    rate: z.number(),
    startDate: z.string(),
    endDate: z.string(),
    totalEntries: z.number(),
    chargebackEntries: z.number(),
  }),
  previousPeriod: z.object({
    rate: z.number(),
    startDate: z.string(),
    endDate: z.string(),
    totalEntries: z.number(),
    chargebackEntries: z.number(),
  }),
  industryAverage: z.number().default(5.0),
  filterApplied: z.string().nullable(),
});
export type GetChargebackComparisonOutput = z.infer<typeof GetChargebackComparisonOutputSchema>;

export async function getChargebackComparison(input: GetChargebackComparisonInput): Promise<GetChargebackComparisonOutput> {
  console.log('[Genkit Flow getChargebackComparison] Called with input:', input);
  const result = await getChargebackComparisonFlow(input);
  console.log('[Genkit Flow getChargebackComparison] Result:', result);
  return result;
}

const getChargebackComparisonFlow = ai.defineFlow(
  {
    name: 'getChargebackComparisonFlow',
    inputSchema: GetChargebackComparisonInputSchema,
    outputSchema: GetChargebackComparisonOutputSchema,
  },
  async (input: GetChargebackComparisonInput): Promise<GetChargebackComparisonOutput> => {
    const { leadVenderFilter, currentPeriodDays = 30 } = input;
    
    const today = new Date();
    const currentPeriodEnd = endOfDay(today);
    const currentPeriodStart = startOfDay(subDays(today, currentPeriodDays - 1));
    const previousPeriodEnd = subDays(currentPeriodStart, 1);
    const previousPeriodStart = startOfDay(subDays(previousPeriodEnd, currentPeriodDays - 1));

    async function getStatsForPeriod(startDate: Date, endDate: Date) {
      try {
        const startDateStr = formatDate(startDate, 'yyyy-MM-dd');
        const endDateStr = formatDate(endDate, 'yyyy-MM-dd');
        
        const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
        const queryConstraints: QueryConstraint[] = [
          where("Date", ">=", startDateStr),
          where("Date", "<=", endDateStr)
        ];

        if (leadVenderFilter) {
          queryConstraints.push(where("Lead Vender", "==", leadVenderFilter));
        }

        const q = query(sheetRowsCollectionRef, ...queryConstraints);
        const querySnapshot = await getDocs(q);
        
        let totalEntries = 0;
        let chargebackEntries = 0;

        querySnapshot.forEach(doc => {
          const data = doc.data();
          totalEntries++;
          if (data.Status === "Rejected") {
            chargebackEntries++;
          }
        });

        const rate = totalEntries > 0 ? (chargebackEntries / totalEntries) * 100 : 0;

        return {
          rate,
          startDate: startDateStr,
          endDate: endDateStr,
          totalEntries,
          chargebackEntries,
        };
      } catch (error) {
        console.error("[Genkit Flow Internal] Error getting period stats:", error);
        throw error;
      }
    }

    try {
      const [currentPeriod, previousPeriod] = await Promise.all([
        getStatsForPeriod(currentPeriodStart, currentPeriodEnd),
        getStatsForPeriod(previousPeriodStart, previousPeriodEnd),
      ]);

      return {
        currentPeriod,
        previousPeriod,
        industryAverage: 5.0,
        filterApplied: leadVenderFilter,
      };
    } catch (error) {
      console.error("[Genkit Flow Internal] Error in getChargebackComparisonFlow:", error);
      
      const defaultPeriod = {
        rate: 0,
        startDate: '',
        endDate: '',
        totalEntries: 0,
        chargebackEntries: 0,
      };
      
      return {
        currentPeriod: defaultPeriod,
        previousPeriod: defaultPeriod,
        industryAverage: 5.0,
        filterApplied: leadVenderFilter,
      };
    }
  }
);
