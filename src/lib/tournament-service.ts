
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, Timestamp, writeBatch, query, orderBy, limit, getDocs } from 'firebase/firestore';
import type { TournamentData, TournamentSettings } from '@/lib/types';
// mapDocToTournamentData is less relevant now as TournamentData will be built differently on client.
// BRACKET_COLLECTION_PATH is removed as paths are now dynamic under tournaments.

// This function's original purpose was to seed data based on mock-data.
// The Apps Script now controls data population based on Google Sheets.
// This function might be deprecated or adapted if specific initialization from Next.js is needed.
export async function initializeTournamentDataIfNeeded(): Promise<void> {
  console.log("initializeTournamentDataIfNeeded called. Note: Apps Script is primary data source for bracket structure if active. Form creation can also initialize it.");
  // Check if any tournament exists
  const tournamentsQuery = query(collection(db, "tournaments"), limit(1));
  const querySnapshot = await getDocs(tournamentsQuery);
  if (querySnapshot.empty) {
    console.log("No tournaments found. A new tournament can be created via the UI, which will also initialize its bracket structure.");
  } else {
    const tournamentDoc = querySnapshot.docs[0];
    const firstMatchDocRef = doc(db, "tournaments", tournamentDoc.id, "rounds", "1", "matches", "match1");
     try {
        const docSnap = await getDoc(firstMatchDocRef);
        if (!docSnap.exists()) {
        console.log(`Bracket for tournament ${tournamentDoc.id} (e.g., tournaments/${tournamentDoc.id}/rounds/1/matches/match1) might not be fully initialized. It can be initialized by creating a new tournament via the UI.`);
        }
    } catch (error) {
        console.error("Error during minimal initialization check:", error);
    }
  }
}

export async function refreshAndSaveTournamentData(): Promise<void> {
  console.log("refreshAndSaveTournamentData called, but data updates are driven by Apps Script or new tournament creation.");
  return Promise.resolve();
}

// Helper function to generate and save the bracket structure under a specific tournament
async function _initializeTournamentBracketStructure(tournamentId: string, teamCount: number, numberOfRounds: number): Promise<void> {
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
      // This initialization just sets up the structure.

      const matchDocRef = doc(db, "tournaments", tournamentId, "rounds", String(roundNum), 'matches', matchId);
      const matchData = {
        fields: {
          team1: { stringValue: team1Name },
          team2: { stringValue: team2Name },
          team1Wins: { integerValue: 0 },
          team2Wins: { integerValue: 0 },
          advanced: { nullValue: null },
          // tournamentSettingsId is removed as nesting implies the link
        }
      };
      batch.set(matchDocRef, matchData);
      matchesInThisRound.push(matchId);
    }
    matchesInPreviousRoundIds = [...matchesInThisRound];
    if (numMatchesThisRound === 1 && roundNum > 1 && matchesInThisRound.length === 1) break; // Final match processed
  }

  try {
    await batch.commit();
    console.log(`Bracket structure for tournament ${tournamentId} initialized with ${teamCount} teams and ${numberOfRounds} rounds.`);
  } catch (error) {
    console.error(`Error initializing bracket structure for tournament ${tournamentId}:`, error);
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

    // Now, initialize the bracket structure for this specific tournament
    await _initializeTournamentBracketStructure(docRef.id, settings.teamCount, settings.numberOfRounds);

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error creating tournament or initializing bracket: ", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred during tournament creation or bracket initialization." };
  }
}
