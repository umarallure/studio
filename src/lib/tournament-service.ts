
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, Timestamp, writeBatch, query, orderBy, limit, getDocs } from 'firebase/firestore';
import type { TournamentSettings } from '@/lib/types';
import { format as formatDate, addDays } from 'date-fns';

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
    // Check if the new nested structure exists
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
async function _initializeTournamentBracketStructure(tournamentId: string, settings: TournamentSettings): Promise<void> {
  const { teamCount, numberOfRounds, startDate } = settings;
  const teams: string[] = Array.from({ length: teamCount }, (_, i) => `Team ${i + 1}`);
  const batch = writeBatch(db);
  let overallMatchIdCounter = 1;
  let teamsForCurrentRound = [...teams]; // For round 1 team assignments
  let matchesInPreviousRoundIds: string[] = []; // For linking rounds

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
      // For subsequent rounds, team names remain TBD initially.
      // They will be filled in as teams advance (logic for this could be in Apps Script or a future enhancement here).

      const matchDocRef = doc(db, "tournaments", tournamentId, "rounds", String(roundNum), 'matches', matchId);
      const matchData = {
        fields: {
          team1: { stringValue: team1Name },
          team2: { stringValue: team2Name },
          team1Wins: { integerValue: 0 },
          team2Wins: { integerValue: 0 },
          advanced: { nullValue: null },
        }
      };
      batch.set(matchDocRef, matchData);
      matchesInThisRound.push(matchId);

      // Create 5 daily placeholder entries for this match
      if (team1Name !== "TBD" && team2Name !== "TBD") { // Only create daily entries if teams are known (primarily for Round 1)
        for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
          const matchDate = addDays(startDate, dayIndex);
          const dateString = formatDate(matchDate, 'yyyy-MM-dd');
          const dailyResultDocRef = doc(db, "tournaments", tournamentId, "rounds", String(roundNum), 'matches', matchId, 'dailyResults', dateString);
          const dailyResultData = {
            fields: {
              team1: { stringValue: team1Name }, // Actual team names for this match
              team2: { stringValue: team2Name },
              team1Score: { integerValue: 0 },
              team2Score: { integerValue: 0 },
              winner: { nullValue: null },
              loser: { nullValue: null },
              status: { stringValue: "Scheduled" } // Optional status
            }
          };
          batch.set(dailyResultDocRef, dailyResultData);
        }
      }
    }
    matchesInPreviousRoundIds = [...matchesInThisRound];
    if (numMatchesThisRound === 1 && roundNum > 1 && matchesInThisRound.length === 1) break; // Final match processed
  }

  try {
    await batch.commit();
    console.log(`Bracket structure for tournament ${tournamentId} initialized with ${teamCount} teams and ${numberOfRounds} rounds, including 5 daily placeholders for round 1 matches.`);
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
      startDate: Timestamp.fromDate(settings.startDate), // Store as Firestore Timestamp
      createdAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, "tournaments"), tournamentDataToSave);
    console.log("Tournament settings created with ID: ", docRef.id, " Data: ", tournamentDataToSave);

    // Now, initialize the bracket structure for this specific tournament
    // Pass the full settings object (which includes startDate)
    await _initializeTournamentBracketStructure(docRef.id, settings);

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error creating tournament or initializing bracket: ", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred during tournament creation or bracket initialization." };
  }
}

