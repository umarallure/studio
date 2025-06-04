
import type { DocumentData } from 'firebase/firestore';
import type { Matchup, TournamentData, Round } from '@/lib/types'; // Adjusted types

export const TOURNAMENT_DOC_PATH_UNUSED = 'tournaments/mainTournament'; // This specific path seems unused by Apps Script for bracket structure
export const BRACKET_COLLECTION_PATH = 'bracket'; // Base collection for bracket rounds

// Helper to map Firestore document data (from bracket/{roundNum}/matches/{matchId}) to our Matchup type
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

// This function is a placeholder if we were to fetch a single "Tournament" document.
// Given the Apps Script structure, we'll build TournamentData by aggregating rounds and matches.
export function mapDocToTournamentData(docData: DocumentData | undefined): TournamentData | null {
  // This function's original purpose (mapping a single doc to TournamentData)
  // doesn't align well with the Apps Script's per-match document structure.
  // TournamentData will be constructed by aggregating multiple match documents.
  // For now, returning null or a basic structure if this function were to be called.
  if (!docData) return null;
  // If there was a single document for the tournament prize, it could be mapped here.
  // For rounds, they are now built by querying subcollections.
  return {
    rounds: (docData.roundsFromAppScript || []) as Round[], // This is hypothetical
    prize: docData.prizeString || "Tournament Prize!", // Placeholder
  };
}
