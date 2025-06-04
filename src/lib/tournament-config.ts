
import type { DocumentData } from 'firebase/firestore';
import type { Matchup, TournamentData, Round } from '@/lib/types'; // Adjusted types

// BRACKET_COLLECTION_PATH is removed as bracket data is now nested under /tournaments/{tournamentId}/rounds/...

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

// This function's original purpose (mapping a single doc to TournamentData)
// is less relevant now as TournamentData (including rounds and matches) will be built
// on the client-side by fetching nested collections.
// This could be adapted to map just the top-level tournament settings if needed elsewhere.
export function mapDocToTournamentSettings(docData: DocumentData | undefined, id: string): TournamentSettings | null {
  if (!docData) return null;
  return {
    id: id,
    name: docData.name || "Unnamed Tournament",
    teamCount: docData.teamCount || 8, // Default if not present
    numberOfRounds: docData.numberOfRounds || 3, // Default if not present
    startDate: docData.startDate?.toDate() || new Date(), // Convert Timestamp to Date
    createdAt: docData.createdAt?.toDate() || new Date(),
  };
}
