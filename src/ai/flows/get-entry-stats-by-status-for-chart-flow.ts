
'use server';
/**
 * @fileOverview A Genkit flow to get aggregated entry statistics by status for a chart.
 *
 * - getEntryStatsByStatusForChart - A function that calculates status counts.
 * - EntryStatsByStatusForChartInput - The input type for the function.
 * - EntryStatsByStatusForChartOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, type QueryConstraint } from 'firebase/firestore';
import { format as formatDate, subDays, startOfDay, endOfDay } from 'date-fns';
import type { ChartSegment } from '@/lib/types'; // Assuming ChartSegment is defined
import { mapDocToSheetRow } from '@/lib/tournament-config';

const EntryStatsByStatusForChartInputSchema = z.object({
  leadVenderFilter: z.string().nullable().describe("Optional: The 'LeadVender' name to filter entries for a specific center/team. If null, considers all teams."),
  daysToCover: z.number().min(1).describe("The number of past days to include in the statistics (e.g., 30 for last 30 days)."),
});
export type EntryStatsByStatusForChartInput = z.infer<typeof EntryStatsByStatusForChartInputSchema>;

const EntryStatsByStatusForChartOutputSchema = z.array(
  z.object({
    name: z.string().describe("The status name."),
    value: z.number().describe("The count of entries for this status."),
    fill: z.string().describe("The CSS variable for the chart segment color (e.g., 'var(--chart-1)')."),
  })
);
export type EntryStatsByStatusForChartOutput = z.infer<typeof EntryStatsByStatusForChartOutputSchema>;


export async function getEntryStatsByStatusForChart(input: EntryStatsByStatusForChartInput): Promise<EntryStatsByStatusForChartOutput> {
  console.log('[Genkit Flow] getEntryStatsByStatusForChart called with input:', input);
  const result = await getEntryStatsByStatusForChartFlow(input);
  console.log('[Genkit Flow] getEntryStatsByStatusForChart result:', result);
  return result;
}

const STATUS_COLORS: Record<string, string> = {
  default: 'var(--muted)', 
  Submitted: 'var(--chart-1)',
  Approved: 'var(--chart-2)',
  Pending: 'var(--chart-3)',
  Rejected: 'var(--chart-4)',
  Cancelled: 'var(--chart-5)',
};
let chartColorIndex = 1; 
const MAX_CHART_COLORS = 5; 

function getNextColor(statusName: string): string {
    if (STATUS_COLORS[statusName]) {
        return STATUS_COLORS[statusName];
    }
    const color = `var(--chart-${chartColorIndex})`;
    chartColorIndex++;
    if (chartColorIndex > MAX_CHART_COLORS) {
        chartColorIndex = 1; 
    }
    STATUS_COLORS[statusName] = color; 
    return color;
}


const getEntryStatsByStatusForChartFlow = ai.defineFlow(
  {
    name: 'getEntryStatsByStatusForChartFlow',
    inputSchema: EntryStatsByStatusForChartInputSchema,
    outputSchema: EntryStatsByStatusForChartOutputSchema,
  },
  async (input: EntryStatsByStatusForChartInput): Promise<EntryStatsByStatusForChartOutput> => {
    const { leadVenderFilter, daysToCover } = input;
    chartColorIndex = 1; 

    const endDate = endOfDay(new Date()); 
    const startDate = startOfDay(subDays(endDate, daysToCover -1)); 

    const startDateStr = formatDate(startDate, 'yyyy-MM-dd');
    const endDateStr = formatDate(endDate, 'yyyy-MM-dd');

    console.log(`[Genkit Flow Internal - ChartStats] Processing for ${daysToCover} days: ${startDateStr} to ${endDateStr}, filter: ${leadVenderFilter || 'None'}`);

    try {
      const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
      const queryConstraints: QueryConstraint[] = [
        where("Date", ">=", startDateStr),
        where("Date", "<=", endDateStr),
      ];

      if (leadVenderFilter) {
        queryConstraints.push(where("Lead Vender", "==", leadVenderFilter)); // Corrected field name
      }

      const q = query(sheetRowsCollectionRef, ...queryConstraints);
      const querySnapshot = await getDocs(q);

      const statusCounts: Record<string, number> = {};

      querySnapshot.forEach(doc => {
        const row = mapDocToSheetRow(doc.id, doc.data());
        if (row && row.Status) {
          statusCounts[row.Status] = (statusCounts[row.Status] || 0) + 1;
        } else if (row && !row.Status) {
            const unknownStatus = "Unknown Status";
            statusCounts[unknownStatus] = (statusCounts[unknownStatus] || 0) + 1;
        }
      });

      if (Object.keys(statusCounts).length === 0) {
        console.log('[Genkit Flow Internal - ChartStats] No entries found for the period with the given criteria.');
        return [];
      }

      const chartData: ChartSegment[] = Object.entries(statusCounts).map(([statusName, count]) => ({
        name: statusName,
        value: count,
        fill: getNextColor(statusName),
      })).sort((a,b) => b.value - a.value); 

      console.log('[Genkit Flow Internal - ChartStats] Aggregated status counts:', chartData);
      return chartData;

    } catch (error) {
      console.error("[Genkit Flow Internal - ChartStats] Error in getEntryStatsByStatusForChartFlow:", error);
      return [];
    }
  }
);
