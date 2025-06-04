
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, Timestamp, writeBatch } from 'firebase/firestore';
import type { TournamentData, TournamentSettings } from '@/lib/types';
import { BRACKET_COLLECTION_PATH, mapDocToTournamentData } from '@/lib/tournament-config';

// This function's original purpose was to seed data based on mock-data.
// The Apps Script now controls data population based on Google Sheets.
// This function might be deprecated or adapted if specific initialization from Next.js is needed.
export async function initializeTournamentDataIfNeeded(): Promise<void> {
  console.log("initializeTournamentDataIfNeeded called. Note: Apps Script is primary data source for bracket structure if active. Form creation can also initialize it.");
  const round1DocRef = doc(db, BRACKET_COLLECTION_PATH, "1", "matches", "match1");
  try {
    const docSnap = await getDoc(round1DocRef);
    if (!docSnap.exists()) {
      console.log("Global bracket (e.g., bracket/1/matches/match1) does not exist. It can be initialized by creating a new tournament via the UI or by the Apps Script.");
    }
  } catch (error) {
    console.error("Error during minimal initialization check:", error);
  }
}

export async function refreshAndSaveTournamentData(): Promise<void> {
  console.log("refreshAndSaveTournamentData called, but data updates are driven by Apps Script or new tournament creation.");
  return Promise.resolve();
}

// Helper function to generate and save the global bracket structure
async function _initializeGlobalBracketStructure(teamCount: number, numberOfRounds: number, tournamentIdForReference: string): Promise<void> {
  const teams: string[] = Array.from({ length: teamCount }, (_, i) => `Team ${i + 1}`);
  const batch = writeBatch(db);
  let overallMatchIdCounter = 1;
  let teamsForCurrentRound = [...teams];
  let matchesInPreviousRoundIds: string[] = [];

  for (let roundNum = 1; roundNum <= numberOfRounds; roundNum++) {
    const matchesInThisRound = [];
    const numMatchesThisRound = (roundNum === 1) ? teamCount / 2 : matchesInPreviousRoundIds.length / 2;

    for (let i = 0; i < numMatchesThisRound; i++) {
      const matchId = `match${overallMatchIdCounter++}`;
      let team1Name: string = "TBD";
      let team2Name: string = "TBD";

      if (roundNum === 1) {
        team1Name = teamsForCurrentRound[i * 2];
        team2Name = teamsForCurrentRound[i * 2 + 1];
      }
      // For subsequent rounds, team names remain TBD as they depend on winners from previous round matches.
      // The Apps Script logic would populate these based on advancement.
      // This initialization just sets up the structure.

      const matchDocRef = doc(db, BRACKET_COLLECTION_PATH, String(roundNum), 'matches', matchId);
      const matchData = {
        fields: {
          team1: { stringValue: team1Name },
          team2: { stringValue: team2Name },
          team1Wins: { integerValue: 0 },
          team2Wins: { integerValue: 0 },
          advanced: { nullValue: null },
          // Optional: Reference which tournament settings initialized this bracket
          // initializedByTournamentId: { stringValue: tournamentIdForReference }
        }
      };
      batch.set(matchDocRef, matchData);
      matchesInThisRound.push(matchId);
    }
    matchesInPreviousRoundIds = [...matchesInThisRound];
    if (numMatchesThisRound === 1 && roundNum > 1) break; // Final match processed
  }

  try {
    await batch.commit();
    console.log(`Global bracket structure initialized for ${teamCount} teams and ${numberOfRounds} rounds. Referenced by tournament settings ID: ${tournamentIdForReference}`);
  } catch (error) {
    console.error("Error initializing global bracket structure:", error);
    throw error; // Re-throw to be caught by calling function
  }
}


export async function createTournament(settings: TournamentSettings): Promise<{success: boolean, id?: string, error?: string}> {
  try {
    const tournamentDataToSave = {
      name: settings.name,
      teamCount: settings.teamCount,
      numberOfRounds: settings.numberOfRounds,
      startDate: Timestamp.fromDate(settings.startDate),
      createdAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, "tournaments"), tournamentDataToSave);
    console.log("Tournament settings created with ID: ", docRef.id, " Data: ", tournamentDataToSave);

    // Now, initialize the global bracket structure based on these settings
    await _initializeGlobalBracketStructure(settings.teamCount, settings.numberOfRounds, docRef.id);

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error creating tournament or initializing bracket: ", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred during tournament creation or bracket initialization." };
  }
}
