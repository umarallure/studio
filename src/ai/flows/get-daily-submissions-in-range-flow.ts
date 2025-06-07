
'use server';
/**
 * @fileOverview A Genkit flow to get daily "Submitted" entry counts within a date range.
 *
 * - getDailySubmissionsInRange - Fetches daily submission counts.
 * - DateRangeFilterInput - The input type.
 * - DailySubmissionsInRangeOutput - The return type for this flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, type QueryConstraint } from 'firebase/firestore';
import type { DateRangeFilterInput, DailySubmissionsInRangeOutput as FlowOutput, DailyChartDataPoint } from '@/lib/types';
import { mapDocToSheetRow } from '@/lib/tournament-config';
import { format as formatDate, parseISO, eachDayOfInterval, isValid } from 'date-fns';

const DateRangeFilterInputSchema = z.object({
  leadVenderFilter: z.string().nullable().describe("Optional: The 'LeadVender' name to filter. Null for all."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Start date in YYYY-MM-DD format."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("End date in YYYY-MM-DD format."),
});

const DailyChartDataPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number(),
});

const DailySubmissionsInRangeOutputSchema = z.object({
  dailySubmissions: z.array(DailyChartDataPointSchema),
  startDate: z.string(),
  endDate: z.string(),
  filterApplied: z.string().nullable(),
});


export async function getDailySubmissionsInRange(input: DateRangeFilterInput): Promise<FlowOutput> {
  console.log('[Genkit Flow getDailySubmissionsInRange] Called with input:', JSON.stringify(input));
  const result = await getDailySubmissionsInRangeFlow(input);
  console.log(`[Genkit Flow getDailySubmissionsInRange] Result: ${result.dailySubmissions.length} data points. Filter: ${result.filterApplied}, Start: ${result.startDate}, End: ${result.endDate}`);
  if (result.dailySubmissions.length > 0) {
    console.log('[Genkit Flow getDailySubmissionsInRange] Sample data point:', JSON.stringify(result.dailySubmissions[0]));
  }
  return result;
}

const getDailySubmissionsInRangeFlow = ai.defineFlow(
  {
    name: 'getDailySubmissionsInRangeFlow',
    inputSchema: DateRangeFilterInputSchema,
    outputSchema: DailySubmissionsInRangeOutputSchema,
  },
  async (input: DateRangeFilterInput): Promise<FlowOutput> => {
    const { leadVenderFilter, startDate, endDate } = input;
    const dailySubmissions: DailyChartDataPoint[] = [];

    console.log(`[FlowInternal DailySubmissionsRange] START: Processing for ${startDate} to ${endDate}, Filter: "${leadVenderFilter || 'None'}"`);

    try {
      const parsedStartDate = parseISO(startDate);
      const parsedEndDate = parseISO(endDate);

      if (!isValid(parsedStartDate) || !isValid(parsedEndDate) || parsedEndDate < parsedStartDate) {
        console.error("[FlowInternal DailySubmissionsRange] Invalid date range provided.");
        return { dailySubmissions: [], startDate, endDate, filterApplied: leadVenderFilter };
      }
      
      const datesInRange = eachDayOfInterval({ start: parsedStartDate, end: parsedEndDate });
      console.log(`[FlowInternal DailySubmissionsRange] Dates in range: ${datesInRange.length} days from ${formatDate(datesInRange[0], 'yyyy-MM-dd')} to ${formatDate(datesInRange[datesInRange.length - 1], 'yyyy-MM-dd')}`);

      const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
      const queryConstraints: QueryConstraint[] = [
        where("Date", ">=", startDate),
        where("Date", "<=", endDate),
      ];
      if (leadVenderFilter) {
        queryConstraints.push(where("Lead Vender", "==", leadVenderFilter));
        console.log(`[FlowInternal DailySubmissionsRange] Added LeadVender filter: "${leadVenderFilter}"`);
      }
      
      const q = query(sheetRowsCollectionRef, ...queryConstraints);
      console.log(`[FlowInternal DailySubmissionsRange] Firestore query constraints: ${JSON.stringify(queryConstraints.map(qc => ({_op: (qc as any)._op, _field: (qc as any)._fieldPath.segments.join('.'), _value: (qc as any)._value })))}`);
      
      const querySnapshot = await getDocs(q);
      console.log(`[FlowInternal DailySubmissionsRange] Firestore query returned ${querySnapshot.size} documents matching date range and LeadVender filter (if any).`);
      
      const submittedRowsByDate: Map<string, number> = new Map();
      let processedDocsCount = 0;
      querySnapshot.forEach(doc => {
        processedDocsCount++;
        // console.log(`[FlowInternal DailySubmissionsRange] Processing doc ${processedDocsCount}/${querySnapshot.size}, ID: ${doc.id}. Raw Data:`, JSON.stringify(doc.data()));
        const row = mapDocToSheetRow(doc.id, doc.data());
        if (row) {
          // console.log(`[FlowInternal DailySubmissionsRange] Mapped doc ID ${doc.id}: LeadVender="${row.LeadVender}", Date="${row.Date}", Status="${row.Status}"`);
          if (row.Status === "Submitted") {
            // This check is only relevant if leadVenderFilter is active. If no filter, we count all "Submitted".
            const matchesLeadVenderFilter = !leadVenderFilter || row.LeadVender === leadVenderFilter;
            
            if (matchesLeadVenderFilter && row.Date && row.Date >= startDate && row.Date <= endDate) {
               submittedRowsByDate.set(row.Date, (submittedRowsByDate.get(row.Date) || 0) + 1);
               // console.log(`[FlowInternal DailySubmissionsRange] COUNTED: Doc ID ${doc.id}. Status: "Submitted", LeadVender: "${row.LeadVender}", Date: "${row.Date}". New count for date ${row.Date}: ${submittedRowsByDate.get(row.Date)}`);
            } else {
              // if (row.Date && (row.Date < startDate || row.Date > endDate)) {
              //    console.log(`[FlowInternal DailySubmissionsRange] SKIPPED (Date Mismatch after map): Doc ID ${doc.id}. Mapped Date "${row.Date}" vs Range [${startDate}, ${endDate}]`);
              // } else if (leadVenderFilter && row.LeadVender !== leadVenderFilter) {
              //    console.log(`[FlowInternal DailySubmissionsRange] SKIPPED (LeadVender Mismatch): Doc ID ${doc.id}. Mapped LeadVender "${row.LeadVender}" vs Filter "${leadVenderFilter}"`);
              // }
            }
          } else {
            // console.log(`[FlowInternal DailySubmissionsRange] SKIPPED (Not Submitted): Doc ID ${doc.id}. Status: "${row.Status}"`);
          }
        } else {
            console.warn(`[FlowInternal DailySubmissionsRange] mapDocToSheetRow returned null for doc ID: ${doc.id}. Raw Data:`, JSON.stringify(doc.data()));
        }
      });
      console.log(`[FlowInternal DailySubmissionsRange] Finished processing ${querySnapshot.size} docs. Submitted counts by date (before filling gaps):`, JSON.stringify(Array.from(submittedRowsByDate.entries())));

      for (const dateObj of datesInRange) {
        const dateStr = formatDate(dateObj, 'yyyy-MM-dd');
        dailySubmissions.push({
          date: dateStr,
          count: submittedRowsByDate.get(dateStr) || 0,
        });
      }
      
      console.log(`[FlowInternal DailySubmissionsRange] FINAL dailySubmissions array for ${leadVenderFilter || 'all teams'} (length ${dailySubmissions.length}):`);
      // dailySubmissions.forEach(ds => console.log(`  Date: ${ds.date}, Count: ${ds.count}`));
      
      return {
        dailySubmissions,
        startDate,
        endDate,
        filterApplied: leadVenderFilter,
      };

    } catch (error) {
      console.error("[FlowInternal DailySubmissionsRange] Error processing flow:", error);
      return {
        dailySubmissions: [],
        startDate,
        endDate,
        filterApplied: leadVenderFilter,
      };
    }
  }
);
