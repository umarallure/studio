
import type { DocumentData } from 'firebase/firestore';
import type { Matchup, TournamentSettings, SheetRow } from '@/lib/types';
import { format as formatDate } from 'date-fns'; // Added for mapDocToSheetRow date handling

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
    const leadVenderValue = fields['Lead Vender']?.stringValue; // With space
    const statusValue = fields.Status?.stringValue;
    const dateValue = fields.Date?.stringValue;
    console.log(`[mapDocToSheetRow - ${docId}] Using 'fields' wrapper. LeadVender: '${leadVenderValue}', Status: '${statusValue}', Date: '${dateValue}'`);
    return {
      id: docId,
      Agent: fields.Agent?.stringValue,
      Date: dateValue,
      FromCallback: fields['From Callback?']?.booleanValue,
      INSURED_NAME: fields['INSURED NAME']?.stringValue,
      LeadVender: leadVenderValue,
      Notes: fields.Notes?.stringValue,
      ProductType: fields['Product Type']?.stringValue,
      Status: statusValue,
    };
  }
  // Fallback for direct SDK-like data structure (no 'fields' wrapper)
  else if (typeof data === 'object' && !data.fields) {
    // Explicitly check for "Lead Vender" (with space) as per your screenshot for direct access
    const directLeadVender = data['Lead Vender']; // With space
    const directStatus = data.Status;
    const directDate = data.Date; // Assuming it's a string "YYYY-MM-DD"

    // Check if at least one of the critical fields (LeadVender, Status, Date) is present
    if (directLeadVender !== undefined || directStatus !== undefined || directDate !== undefined) {
        console.log(`[mapDocToSheetRow - ${docId}] Attempting direct property access. Raw 'Lead Vender': '${directLeadVender}', Raw 'Status': '${directStatus}', Raw 'Date': '${directDate}'`);
        
        let finalDate = directDate;
        // If Date is a Firestore Timestamp, convert it (though screenshot shows string)
        if (directDate && typeof directDate.toDate === 'function') {
            finalDate = formatDate(directDate.toDate(), 'yyyy-MM-dd');
            console.log(`[mapDocToSheetRow - ${docId}] Converted Firestore Timestamp to Date string: '${finalDate}'`);
        }


        return {
            id: docId,
            Agent: data.Agent,
            Date: finalDate, 
            FromCallback: data['From Callback?'],
            INSURED_NAME: data['INSURED NAME'],
            LeadVender: directLeadVender, 
            Notes: data.Notes,
            ProductType: data['Product Type'],
            Status: directStatus,
        };
    } else {
        console.warn(`[mapDocToSheetRow - ${docId}] Direct candidate fields ('Lead Vender', 'Status', 'Date') not found with expected names for direct mapping. Data:`, JSON.stringify(data));
    }
  }
  
  console.warn(`[mapDocToSheetRow - ${docId}] Could not map document. Structure not recognized as 'fields' wrapper or expected direct fields. Raw Data:`, JSON.stringify(data));
  return null;
}

