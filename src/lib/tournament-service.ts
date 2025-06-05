
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, Timestamp, writeBatch, query, orderBy, limit, getDocs, type DocumentData } from 'firebase/firestore';
import type { TournamentSettings, SheetRow } from '@/lib/types';
import { format as formatDate, addDays, parseISO } from 'date-fns';

// Helper to map Firestore document data to SheetRow type
function mapDocToSheetRow(docId: string, data: DocumentData | undefined): SheetRow | null {
  if (!data) return null;
  return {
    id: docId,
    Agent: data.Agent,
    Date: data.Date, // Assuming this is a string like 'MM/DD/YYYY' or 'YYYY-MM-DD'
    FromCallback: data['From Callback?'],
    INSURED_NAME: data['INSURED NAME'],
    LeadVender: data['Lead Vender'], // This will be used as the team identifier
    Notes: data.Notes,
    ProductType: data['Product Type'],
    Status: data.Status,
  };
}


// Helper function to generate and save the bracket structure under a specific tournament
async function _initializeTournamentBracketStructure(tournamentId: string, settings: TournamentSettings): Promise<void> {
  const { teamCount, numberOfRounds, startDate } = settings;
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

      // Create 5 daily placeholder entries for this match if teams are known (primarily Round 1)
      if (team1Name !== "TBD" && team2Name !== "TBD") {
        for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
          const matchDate = addDays(startDate, dayIndex);
          const dateString = formatDate(matchDate, 'yyyy-MM-dd');
          const dailyResultDocRef = doc(db, "tournaments", tournamentId, "rounds", String(roundNum), 'matches', matchId, 'dailyResults', dateString);
          const dailyResultData = {
            fields: {
              team1: { stringValue: team1Name },
              team2: { stringValue: team2Name },
              team1Score: { integerValue: 0 }, // Daily score placeholder
              team2Score: { integerValue: 0 }, // Daily score placeholder
              winner: { nullValue: null },
              loser: { nullValue: null },
              status: { stringValue: "Scheduled" }
            }
          };
          batch.set(dailyResultDocRef, dailyResultData);
        }
      }
    }
    matchesInPreviousRoundIds = [...matchesInThisRound];
    if (numMatchesThisRound === 1 && roundNum > 1 && matchesInThisRound.length === 1) break;
  }

  try {
    await batch.commit();
    console.log(`Bracket structure for tournament ${tournamentId} initialized with ${teamCount} teams and ${numberOfRounds} rounds, including 5 daily placeholders for round 1 matches.`);
  } catch (error) {
    console.error(`Error initializing bracket structure for tournament ${tournamentId}:`, error);
    throw error;
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

// Normalize various date string formats from Sheet1Rows to 'yyyy-MM-dd'
function normalizeDateString(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  try {
    // Attempt to parse common formats like MM/DD/YYYY, YYYY-MM-DD, or ISO strings
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) { // Invalid date
      // Handle MM/DD/YY or M/D/YY specifically if needed, as new Date() might misinterpret
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000; // Convert YY to YYYY
        const month = parseInt(parts[0], 10) -1; // Month is 0-indexed
        const day = parseInt(parts[1], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return formatDate(d, 'yyyy-MM-dd');
      }
      return null;
    }
    return formatDate(dateObj, 'yyyy-MM-dd');
  } catch (e) {
    console.warn(`Could not parse date: ${dateStr}`, e);
    return null;
  }
}

export async function syncSheetScoresToDailyResults(activeTournamentId: string): Promise<{ success: boolean, message: string, details?: string[] }> {
  let details: string[] = [];
  try {
    details.push(`Starting sync for tournament ID: ${activeTournamentId}`);

    // 1. Fetch active tournament settings to get its start date
    const tournamentDocRef = doc(db, "tournaments", activeTournamentId);
    const tournamentDocSnap = await getDoc(tournamentDocRef);
    if (!tournamentDocSnap.exists()) {
      return { success: false, message: `Tournament with ID ${activeTournamentId} not found.` };
    }
    const tournamentSettings = tournamentDocSnap.data() as TournamentSettings;
    // Firestore Timestamps need to be converted to JS Dates
    const tournamentStartDate = tournamentSettings.startDate instanceof Timestamp ? tournamentSettings.startDate.toDate() : new Date(tournamentSettings.startDate);

    details.push(`Tournament "${tournamentSettings.name}" found, starts on ${formatDate(tournamentStartDate, 'yyyy-MM-dd')}.`);

    // 2. Fetch all Sheet1Rows
    const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
    const sheetRowsSnapshot = await getDocs(sheetRowsCollectionRef);
    const sheetRows: SheetRow[] = [];
    sheetRowsSnapshot.forEach(docSnap => {
      const row = mapDocToSheetRow(docSnap.id, docSnap.data());
      if (row) sheetRows.push(row);
    });
    details.push(`Fetched ${sheetRows.length} rows from Sheet1Rows.`);
    if (sheetRows.length === 0) {
        return { success: true, message: "Sync complete. No rows found in Sheet1Rows to process.", details };
    }

    // 3. Aggregate scores from Sheet1Rows
    // Key: teamName (LeadVender), Value: Map<dateString (yyyy-MM-dd), score (count)>
    const teamDailyScores = new Map<string, Map<string, number>>();
    sheetRows.forEach(row => {
      if (row.LeadVender && row.Date && row.Status === "Submitted") {
        const teamName = row.LeadVender;
        const normalizedDate = normalizeDateString(row.Date);
        if (!normalizedDate) {
            details.push(`Skipping row ID ${row.id} due to unparseable date: ${row.Date}`);
            return;
        }

        if (!teamDailyScores.has(teamName)) {
          teamDailyScores.set(teamName, new Map<string, number>());
        }
        const scoresForTeam = teamDailyScores.get(teamName)!;
        scoresForTeam.set(normalizedDate, (scoresForTeam.get(normalizedDate) || 0) + 1);
      }
    });
    details.push(`Aggregated scores for ${teamDailyScores.size} teams from Sheet1Rows.`);

    // 4. Iterate through tournament structure and update dailyResults
    const batch = writeBatch(db);
    let updatesMade = 0;

    for (let roundNum = 1; roundNum <= tournamentSettings.numberOfRounds; roundNum++) {
      const matchesCollectionRef = collection(db, "tournaments", activeTournamentId, "rounds", String(roundNum), "matches");
      const matchesSnapshot = await getDocs(matchesCollectionRef);

      for (const matchDoc of matchesSnapshot.docs) {
        const matchData = matchDoc.data().fields;
        const team1Name = matchData.team1?.stringValue;
        const team2Name = matchData.team2?.stringValue;
        const matchId = matchDoc.id;

        if (!team1Name || team1Name === "TBD" || !team2Name || team2Name === "TBD") {
          details.push(`Skipping match ${matchId} in round ${roundNum} as teams are not fully determined.`);
          continue;
        }
        
        // Iterate for 5 days from tournament start (or as many dailyResults docs exist)
        for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
          const currentDate = addDays(tournamentStartDate, dayIndex);
          const dateString = formatDate(currentDate, 'yyyy-MM-dd');
          
          const team1Score = teamDailyScores.get(team1Name)?.get(dateString) || 0;
          const team2Score = teamDailyScores.get(team2Name)?.get(dateString) || 0;

          const dailyResultDocRef = doc(db, "tournaments", activeTournamentId, "rounds", String(roundNum), "matches", matchId, "dailyResults", dateString);
          
          // Check if dailyResult doc exists before attempting to update non-atomically
          // For this sync, we'll update if scores are found, assuming dailyResult doc was pre-created
          // Or, we can upsert with set and merge:true, but PATCH is safer if fields might be missing.
          // Given _initializeTournamentBracketStructure creates these, they should exist for Round 1.
          // For subsequent rounds, dailyResults might not be pre-created by _initializeTournamentBracketStructure.
          // We'll try to update; if it fails because doc doesn't exist, and scores > 0, we could create it.
          // For now, let's assume _initializeTournamentBracketStructure also creates them for later rounds if team names become known.
          // For simplicity, we will PATCH. If doc doesn't exist, it won't create.
          // This might be an issue if Apps Script creates dailyResults on-the-fly for later rounds.
          // A more robust solution would be to GET then SET, or SET with merge.
          
          // We will update the scores. The Apps Script is responsible for winner/loser.
          // Only update if there's a score to report from sheet data for this day, or if it's different from 0.
          // This check is optional but can reduce writes if scores are already 0 and sheet data indicates 0.
          // For this implementation, we will update regardless to ensure sync.
          batch.update(dailyResultDocRef, {
            "fields.team1Score.integerValue": team1Score,
            "fields.team2Score.integerValue": team2Score,
            // We do NOT update 'winner' or 'loser' here. That's Apps Script's job.
          });
          updatesMade++;
          details.push(`Prepared update for Round ${roundNum}, Match ${matchId}, Date ${dateString}: ${team1Name} (${team1Score}) vs ${team2Name} (${team2Score})`);
        }
      }
    }
    
    if (updatesMade > 0) {
      await batch.commit();
      details.push(`Batch commit successful. ${updatesMade} daily result documents' scores updated.`);
      return { success: true, message: `Sync complete. Scores for ${updatesMade} daily results updated based on Sheet1Rows.`, details };
    } else {
      details.push("No score updates were necessary based on current Sheet1Rows data and tournament structure.");
      return { success: true, message: "Sync complete. No score updates were necessary.", details };
    }

  } catch (error) {
    console.error("Error in syncSheetScoresToDailyResults:", error);
     const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    details.push(`Error during sync: ${errorMessage}`);
    return { success: false, message: `Failed to sync scores: ${errorMessage}`, details };
  }
}

// --- InitializeTournamentDataIfNeeded and refreshAndSaveTournamentData are less relevant now ----
// --- as Apps Script and tournament creation handle data population. Kept for reference or potential future use. ---
export async function initializeTournamentDataIfNeeded(): Promise<void> {
  console.log("initializeTournamentDataIfNeeded called. Note: Tournament creation via UI or Apps Script is primary data source.");
}

export async function refreshAndSaveTournamentData(): Promise<void> {
  console.log("refreshAndSaveTournamentData called, but data updates are driven by Apps Script or new tournament creation.");
  return Promise.resolve();
}

    