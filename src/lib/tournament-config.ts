
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
  
  // Helper to safely convert to Date
  const safeConvertToDate = (dateInput: any): Date => {
    if (!dateInput) return new Date(); // Default if undefined/null
    if (dateInput && typeof dateInput.toDate === 'function') { // Firestore Timestamp
      return dateInput.toDate();
    }
    if (typeof dateInput === 'string' || typeof dateInput === 'number') {
        const d = new Date(dateInput);
        if (!isNaN(d.getTime())) {
          return d;
        }
    }
    return new Date(); // Fallback for unparseable dates
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
// This handles the structure written by the Google Apps Script (REST API format) or SDK
export function mapDocToSheetRow(docId: string, data: DocumentData | undefined): SheetRow | null {
  if (!data) return null;

  // Check for REST API structure (data under 'fields')
  if (data.fields && typeof data.fields === 'object') {
    const fields = data.fields;
    // console.log(`[mapDocToSheetRow - ${docId}] Using 'fields' wrapper path for LeadVender: ${fields['Lead Vender']?.stringValue}, Status: ${fields.Status?.stringValue}`);
    return {
      id: docId,
      Agent: fields.Agent?.stringValue,
      Date: fields.Date?.stringValue,
      FromCallback: fields['From Callback?']?.booleanValue,
      INSURED_NAME: fields['INSURED NAME']?.stringValue,
      LeadVender: fields['Lead Vender']?.stringValue,
      Notes: fields.Notes?.stringValue,
      ProductType: fields['Product Type']?.stringValue,
      Status: fields.Status?.stringValue,
    };
  }
  // Fallback for direct SDK-like data structure (no 'fields' wrapper)
  // Check for presence of key fields that would indicate it's a SheetRow-like object
  else if (typeof data === 'object' && !data.fields && 
           (data.Agent !== undefined || data.LeadVender !== undefined || data.Status !== undefined || data.Date !== undefined || data['Lead Vender'] !== undefined)
          ) {
    // console.log(`[mapDocToSheetRow - ${docId}] Using direct property access path for LeadVender: ${data['Lead Vender'] || data.LeadVender}, Status: ${data.Status}`);
    return {
        id: docId,
        Agent: data.Agent,
        Date: data.Date,
        FromCallback: data['From Callback?'],
        INSURED_NAME: data['INSURED NAME'],
        LeadVender: data['Lead Vender'] || data.LeadVender, // Handle both casings
        Notes: data.Notes,
        ProductType: data['Product Type'],
        Status: data.Status,
    };
  }
  // console.warn(`[mapDocToSheetRow - ${docId}] Could not map document. Data structure not recognized:`, JSON.stringify(data));
  return null; // If data is undefined or not in a known format
}

