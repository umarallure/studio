
import type { DocumentData } from 'firebase/firestore';
import type { Matchup, TournamentSettings, SheetRow } from '@/lib/types';

// Helper to map Firestore document data (from tournaments/{tournamentId}/rounds/{roundNum}/matches/{matchId}) to our Matchup type
export function mapFirestoreDocToMatchup(docId: string, roundId: string, data: DocumentData | undefined): Matchup | null {
  if (!data || !data.fields) return null;

  const fields = data.fields;

  return {
    id: docId,
    roundId: roundId,
    team1Name: fields.team1?.stringValue || "TBD",
    team2Name: fields.team2?.stringValue || "TBD",
    team1DailyWins: parseInt(fields.team1Wins?.integerValue || '0', 10),
    team2DailyWins: parseInt(fields.team2Wins?.integerValue || '0', 10),
    seriesWinnerName: fields.advanced?.stringValue || null,
  };
}

// This function maps a Firestore document to TournamentSettings.
export function mapDocToTournamentSettings(docData: DocumentData | undefined, id: string): TournamentSettings | null {
  if (!docData) return null;
  
  const safeConvertToDate = (dateInput: any): Date => {
    if (!dateInput) return new Date(); 
    if (dateInput && typeof dateInput.toDate === 'function') { 
      return dateInput.toDate();
    }
    if (typeof dateInput === 'string' || typeof dateInput === 'number') {
        const d = new Date(dateInput);
        if (!isNaN(d.getTime())) {
          return d;
        }
    }
    return new Date(); 
  };
  
  return {
    id: id,
    name: docData.name || "Unnamed Tournament",
    teamCount: docData.teamCount || 8,
    numberOfRounds: docData.numberOfRounds || 3,
    startDate: safeConvertToDate(docData.startDate),
    createdAt: safeConvertToDate(docData.createdAt),
    overallWinnerName: docData.overallWinnerName || undefined,
    status: docData.status || "Scheduled",
  };
}

// Helper to map Firestore document data (from Sheet1Rows) to our SheetRow type
export function mapDocToSheetRow(docId: string, data: DocumentData | undefined): SheetRow | null {
  if (!data) {
    console.warn(`[mapDocToSheetRow - ${docId}] No data provided for mapping.`);
    return null;
  }

  // Check for REST API structure (data under 'fields')
  if (data.fields && typeof data.fields === 'object') {
    const fields = data.fields;
    console.log(`[mapDocToSheetRow - ${docId}] Using 'fields' wrapper. LeadVender: '${fields['Lead Vender']?.stringValue}', Status: '${fields.Status?.stringValue}', Date: '${fields.Date?.stringValue}'`);
    return {
      id: docId,
      Agent: fields.Agent?.stringValue,
      Date: fields.Date?.stringValue,
      FromCallback: fields['From Callback?']?.booleanValue,
      INSURED_NAME: fields['INSURED NAME']?.stringValue,
      LeadVender: fields['Lead Vender']?.stringValue,   // Field name with space
      Notes: fields.Notes?.stringValue,
      ProductType: fields['Product Type']?.stringValue, // Field name with space
      Status: fields.Status?.stringValue,
    };
  }
  // Fallback for direct SDK-like data structure (no 'fields' wrapper)
  else if (typeof data === 'object' && !data.fields) {
    // Check for presence of specific fields expected from screenshot for direct mapping
    // This helps confirm we're trying to map the right kind of object
    const hasDirectCandidateFields = data.Agent !== undefined ||
                                     data.Date !== undefined ||
                                     data['From Callback?'] !== undefined ||
                                     data['INSURED NAME'] !== undefined ||
                                     data['Lead Vender'] !== undefined || // Exact key from screenshot
                                     data.Status !== undefined ||
                                     data['Product Type'] !== undefined;

    if (hasDirectCandidateFields) {
        console.log(`[mapDocToSheetRow - ${docId}] Attempting direct property access. LeadVender: '${data['Lead Vender']}', Status: '${data.Status}', Date: '${data.Date}'`);
        return {
            id: docId,
            Agent: data.Agent,
            Date: data.Date, // Assuming this is YYYY-MM-DD string
            FromCallback: data['From Callback?'],
            INSURED_NAME: data['INSURED NAME'],
            LeadVender: data['Lead Vender'], // Exact key from screenshot
            Notes: data.Notes,
            ProductType: data['Product Type'],
            Status: data.Status,
        };
    } else {
        // This block will be hit if none of the specific direct fields are found
        console.warn(`[mapDocToSheetRow - ${docId}] Direct candidate fields (Agent, Date, 'Lead Vender', Status, etc.) not found for direct mapping. Data:`, JSON.stringify(data));
    }
  }
  // This final warning will be hit if mapping failed by any path
  console.warn(`[mapDocToSheetRow - ${docId}] Could not map document. Structure not recognized as 'fields' wrapper or expected direct fields. Data:`, JSON.stringify(data));
  return null;
}
