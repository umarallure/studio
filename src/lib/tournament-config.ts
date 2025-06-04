
import type { DocumentData } from 'firebase/firestore';
import type { TournamentData } from '@/lib/types';

export const TOURNAMENT_DOC_PATH = 'tournaments/mainTournament';

// Helper to ensure data from Firestore matches TournamentData type
export function mapDocToTournamentData(docData: DocumentData | undefined): TournamentData | null {
  if (!docData) return null;
  return {
    rounds: docData.rounds as TournamentData['rounds'], // More specific typing
    prize: docData.prize as string,
  };
}
