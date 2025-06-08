
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
    // console.log('[Genkit Flow getDailySubmissionsInRange] Sample data point:', JSON.stringify(result.dailySubmissions[0]));
  } else {
    // console.log('[Genkit Flow getDailySubmissionsInRange] No data points returned.');
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
      // console.log(`[FlowInternal DailySubmissionsRange] Dates to fill (if no data): ${datesInRange.length} days from ${formatDate(datesInRange[0], 'yyyy-MM-dd')} to ${formatDate(datesInRange[datesInRange.length - 1], 'yyyy-MM-dd')}`);

      const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
      // MODIFICATION: Removed LeadVender filter from Firestore query
      const queryConstraints: QueryConstraint[] = [
        where("Date", ">=", startDate),
        where("Date", "<=", endDate),
      ];
      // if (leadVenderFilter) {
      //   queryConstraints.push(where("Lead Vender", "==", leadVenderFilter.trim())); 
      //   console.log(`[FlowInternal DailySubmissionsRange] Filtering query by LeadVender: "${leadVenderFilter.trim()}" on field "Lead Vender"`);
      // } else {
      //   console.log(`[FlowInternal DailySubmissionsRange] Not applying LeadVender filter to Firestore query.`);
      // }
      
      const q = query(sheetRowsCollectionRef, ...queryConstraints);
      console.log(`[FlowInternal DailySubmissionsRange] Firestore query (DATE ONLY) constraints: ${JSON.stringify(queryConstraints.map(qc => ({_op: (qc as any)._op, _field: (qc as any)._fieldPath.segments.join('.'), _value: (qc as any)._value })))}`);
      
      const querySnapshot = await getDocs(q);
      console.log(`[FlowInternal DailySubmissionsRange] Firestore query (DATE ONLY) returned ${querySnapshot.size} documents.`);
      
      const submittedRowsByDate: Map<string, number> = new Map();
      let processedDocsCount = 0;
      querySnapshot.forEach(doc => {
        processedDocsCount++;
        const rawData = doc.data();
        console.log(`[FlowInternal DailySubmissionsRange] Processing doc ID: ${doc.id}. RAW DATA: ${JSON.stringify(rawData)}`);
        
        const row = mapDocToSheetRow(doc.id, rawData); 

        if (row) {
          console.log(`[FlowInternal DailySubmissionsRange] Mapped doc ID ${doc.id}: Date='${row.Date}', Status='${row.Status}', LeadVender='${row.LeadVender}'`);
          
          const isSubmitted = row.Status === "Submitted";
          const filterToCompare = leadVenderFilter ? leadVenderFilter.trim() : null;
          const rowLeadVender = row.LeadVender ? row.LeadVender.trim() : null;
          
          // MODIFICATION: LeadVender filter applied here in code
          const matchesLeadVender = !filterToCompare || (rowLeadVender === filterToCompare);
          
          let isValidDateInRange = false;
          if (row.Date && /^\d{4}-\d{2}-\d{2}$/.test(row.Date)) {
            const mappedDateObj = parseISO(row.Date);
            if (isValid(mappedDateObj)) {
                 isValidDateInRange = mappedDateObj >= parsedStartDate && mappedDateObj <= parsedEndDate;
            }
          }
          
          console.log(`[FlowInternal DailySubmissionsRange] Checking conditions for ID ${doc.id}: isSubmitted=${isSubmitted} (needs "Submitted"), matchesLeadVender=${matchesLeadVender} (row:'${rowLeadVender}' vs filter:'${filterToCompare}'), isValidDateInRange=${isValidDateInRange} (rowDate:'${row.Date}' vs range [${startDate}, ${endDate}])`);

          if (isSubmitted && matchesLeadVender && isValidDateInRange && row.Date) {
             submittedRowsByDate.set(row.Date, (submittedRowsByDate.get(row.Date) || 0) + 1);
             console.log(`[FlowInternal DailySubmissionsRange] COUNTED submission for '${filterToCompare || 'all teams'}' on ${row.Date}. New count for date ${row.Date}: ${submittedRowsByDate.get(row.Date)}`);
          } else {
            let skipReason = [];
            if (!isSubmitted) skipReason.push(`Status not 'Submitted' (is '${row.Status}')`);
            if (!matchesLeadVender) skipReason.push(`LeadVender mismatch ('${rowLeadVender}' vs filter '${filterToCompare}')`); // This is the key check now if filter is active
            if (!isValidDateInRange) skipReason.push(`Date out of range/invalid ('${row.Date}' vs [${formatDate(parsedStartDate, 'yyyy-MM-dd')}, ${formatDate(parsedEndDate, 'yyyy-MM-dd')}])`);
            if (!row.Date) skipReason.push('row.Date is missing after mapping');
            console.log(`[FlowInternal DailySubmissionsRange] SKIPPED counting doc ID ${doc.id}. Reasons: ${skipReason.join('; ')}`);
          }
        } else {
            console.warn(`[FlowInternal DailySubmissionsRange] mapDocToSheetRow returned null for doc ID: ${doc.id}. Raw data was logged above.`);
        }
      });
      console.log(`[FlowInternal DailySubmissionsRange] Finished processing ${querySnapshot.size} docs. Submitted counts by date (before filling gaps, after JS filter for LeadVender if active):`, JSON.stringify(Array.from(submittedRowsByDate.entries())));

      for (const dateObj of datesInRange) {
        const dateStr = formatDate(dateObj, 'yyyy-MM-dd');
        dailySubmissions.push({
          date: dateStr,
          count: submittedRowsByDate.get(dateStr) || 0,
        });
      }
      
      console.log(`[FlowInternal DailySubmissionsRange] FINAL dailySubmissions array for '${leadVenderFilter || 'all teams'}' (length ${dailySubmissions.length}):`);
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

