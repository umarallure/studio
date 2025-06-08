import * as z from 'genkit';
import { defineFlow, getFirestore } from 'genkit';
 
// Define the input and output schemas
export const GetTeamSubmissionsLast30DaysInput = z.object({
  leadVenderFilter: z.string().optional(),
});

export const GetTeamSubmissionsLast30DaysOutput = z.object({
  submissionCount: z.number(),
  filterApplied: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string(),
});

export const getTeamSubmissionsLast30Days = defineFlow(
  {
    name: 'getTeamSubmissionsLast30Days',
    inputSchema: GetTeamSubmissionsLast30DaysInput,
    outputSchema: GetTeamSubmissionsLast30DaysOutput,
  },
  async (input) => {
    const { leadVenderFilter } = input;
    const firestore = getFirestore();

    // Calculate the date 30 days ago
    const endDate = new Date(); // Today's date
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30); // 30 days ago

    // Convert dates to string format for output
    const startIsoString = startDate.toISOString().split('T')[0];
    const endIsoString = endDate.toISOString().split('T')[0];

    // Query Firestore
    let query: FirebaseFirestore.Query = firestore.collection('sheet1rows');

    // Filter by date
    // Assuming the 'Date' field in Firestore is stored as a string in 'YYYY-MM-DD' format
    query = query.where('Date', '>=', startIsoString);

    // Fetch documents from the last 30 days
    const snapshot = await query.get();


    // Iterate through the documents and apply additional filters in memory
    snapshot.docs.forEach(doc => {
        const data = doc.data() as any; // Use 'any' for now based on the sheet1rows structure provided
        const status = data.Status;
        const leadVendor = data['Lead Vender']; // Access with bracket notation due to space

        // Check if status is 'Submitted'
        if (status === 'Submitted') {
            // Apply lead vendor filter if provided
            if (leadVenderFilter === undefined || leadVenderFilter === null || leadVendor === leadVenderFilter) {
                submissionCount++;
            }
        }
    });

    return {
      submissionCount: submissionCount,
      filterApplied: leadVenderFilter || null,
      startDate: startIsoString,
      endDate: endIsoString,
    };
  }
);