
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
    if (dateInput.toDate && typeof dateInput.toDate === 'function') { // Firestore Timestamp
      return dateInput.toDate();
    }
    // Attempt to parse if it's a string or number
    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) {
      return d;
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
  };
}

// Helper to map Firestore document data (from Sheet1Rows) to our SheetRow type
// This handles the structure written by the Google Apps Script (REST API format)
export function mapDocToSheetRow(docId: string, data: DocumentData | undefined): SheetRow | null {
  // Check for REST API structure (data under 'fields')
  if (data && data.fields && typeof data.fields === 'object') {
    const fields = data.fields;
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
  else if (data && typeof data === 'object' && 'Agent' in data) { // check for a known property
    return {
        id: docId,
        Agent: data.Agent,
        Date: data.Date,
        FromCallback: data['From Callback?'],
        INSURED_NAME: data['INSURED NAME'],
        LeadVender: data['Lead Vender'],
        Notes: data.Notes,
        ProductType: data['Product Type'],
        Status: data.Status,
    };
  }
  return null; // If data is undefined or not in a known format
}
