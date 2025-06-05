
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, Timestamp, writeBatch, query, orderBy, limit, getDocs, type DocumentData } from 'firebase/firestore';
import type { TournamentSettings, SheetRow } from '@/lib/types';
import { format as formatDate, addDays, parseISO, isFuture, isEqual } from 'date-fns';
import { mapDocToSheetRow } from '@/lib/tournament-config';


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
          const matchDate = addDays(settings.startDate, dayIndex); // Use settings.startDate for consistency
          const dateString = formatDate(matchDate, 'yyyy-MM-dd');
          const dailyResultDocRef = doc(db, "tournaments", tournamentId, "rounds", String(roundNum), 'matches', matchId, 'dailyResults', dateString);
          const dailyResultData = {
            fields: {
              team1: { stringValue: team1Name },
              team2: { stringValue: team2Name },
              team1Score: { integerValue: 0 }, 
              team2Score: { integerValue: 0 }, 
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
    // Ensure loop termination for tournaments that might not perfectly halve (e.g. 3 teams if allowed by logic)
    // For standard 2^n team counts, this condition is fine.
    if (numMatchesThisRound === 1 && roundNum >= numberOfRounds ) break; 
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
    
    // Pass the full settings object, which includes the JS Date version of startDate
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
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) { 
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000; 
        const month = parseInt(parts[0], 10) -1; 
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

    const tournamentDocRef = doc(db, "tournaments", activeTournamentId);
    const tournamentDocSnap = await getDoc(tournamentDocRef);
    if (!tournamentDocSnap.exists()) {
      return { success: false, message: `Tournament with ID ${activeTournamentId} not found.`, details };
    }
    const tournamentSettingsFromDb = tournamentDocSnap.data();
    const tournamentStartDate = tournamentSettingsFromDb.startDate instanceof Timestamp 
        ? tournamentSettingsFromDb.startDate.toDate() 
        : new Date(tournamentSettingsFromDb.startDate);
    const tournamentName = tournamentSettingsFromDb.name || "Unnamed Tournament";
    const numberOfRounds = tournamentSettingsFromDb.numberOfRounds || 0;

    details.push(`Tournament "${tournamentName}" found, starts on ${formatDate(tournamentStartDate, 'yyyy-MM-dd')}. Number of rounds: ${numberOfRounds}`);

    const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
    const sheetRowsSnapshot = await getDocs(sheetRowsCollectionRef);
    const sheetRows: SheetRow[] = [];
    sheetRowsSnapshot.forEach(docSnap => {
      const row = mapDocToSheetRow(docSnap.id, docSnap.data());
      if (row) sheetRows.push(row);
    });
    details.push(`Fetched ${sheetRows.length} rows from Sheet1Rows.`);
    if (sheetRows.length === 0 && numberOfRounds > 0) { // Only return if rounds exist, otherwise sync means nothing
        return { success: true, message: "Sync complete. No rows found in Sheet1Rows to process.", details };
    }


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

    const batch = writeBatch(db);
    let updatesMadeCount = 0; // To track if any actual Firestore writes are prepared

    for (let roundNum = 1; roundNum <= numberOfRounds; roundNum++) {
      const matchesCollectionRef = collection(db, "tournaments", activeTournamentId, "rounds", String(roundNum), "matches");
      const matchesSnapshot = await getDocs(matchesCollectionRef);

      for (const matchDoc of matchesSnapshot.docs) {
        const existingMatchData = matchDoc.data().fields;
        const team1Name = existingMatchData.team1?.stringValue;
        const team2Name = existingMatchData.team2?.stringValue;
        const matchId = matchDoc.id;

        if (!team1Name || team1Name === "TBD" || !team2Name || team2Name === "TBD") {
          details.push(`Skipping match ${matchId} in round ${roundNum} as teams are not fully determined.`);
          continue;
        }
        
        let matchTeam1AggregateDailyWins = 0;
        let matchTeam2AggregateDailyWins = 0;
        let seriesWinnerForThisMatch: string | null = existingMatchData.advanced?.stringValue || null;
        let seriesConcludedForThisMatch = !!seriesWinnerForThisMatch;

        // If series already concluded, we still update daily scores but don't re-calculate daily wins count for series
        if (seriesConcludedForThisMatch) {
            matchTeam1AggregateDailyWins = existingMatchData.team1Wins?.integerValue || 0;
            matchTeam2AggregateDailyWins = existingMatchData.team2Wins?.integerValue || 0;
            details.push(`Match ${matchId} (Round ${roundNum}) series already concluded. Winner: ${seriesWinnerForThisMatch}. Daily scores will be updated, but series win counts will not change unless logic dictates a full recalculation based on new scores.`);
        }


        for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
          const currentDate = addDays(tournamentStartDate, dayIndex);
          const dateString = formatDate(currentDate, 'yyyy-MM-dd');
          
          const team1ScoreForDay = teamDailyScores.get(team1Name)?.get(dateString) || 0;
          const team2ScoreForDay = teamDailyScores.get(team2Name)?.get(dateString) || 0;

          let dailyWinnerTeamName: string | null = null;
          let dailyLoserTeamName: string | null = null;
          let dailyStatus = "Scheduled"; // Default

          if (team1ScoreForDay > team2ScoreForDay) {
              dailyWinnerTeamName = team1Name;
              dailyLoserTeamName = team2Name;
              if (!seriesConcludedForThisMatch) matchTeam1AggregateDailyWins++;
              dailyStatus = "Completed";
          } else if (team2ScoreForDay > team1ScoreForDay) {
              dailyWinnerTeamName = team2Name;
              dailyLoserTeamName = team1Name;
              if (!seriesConcludedForThisMatch) matchTeam2AggregateDailyWins++;
              dailyStatus = "Completed";
          } else { // Tie or no scores yet
              // If scores exist (not both zero) or it's a past/current date, it's a completed tie
              // If scores are both zero AND it's a future date, it's still "Scheduled"
              const today = new Date();
              today.setHours(0,0,0,0); // Normalize today for date comparison
              const currentMatchDate = new Date(dateString + "T00:00:00"); // Ensure it's parsed as local midnight

              if (team1ScoreForDay === 0 && team2ScoreForDay === 0 && isFuture(currentMatchDate)) {
                  dailyStatus = "Scheduled";
              } else if (team1ScoreForDay !== 0 || team2ScoreForDay !== 0 || isEqual(currentMatchDate, today) || currentMatchDate < today) {
                  dailyStatus = "Completed - Tie";
              }
          }
          
          const dailyResultDocRef = doc(db, "tournaments", activeTournamentId, "rounds", String(roundNum), "matches", matchId, "dailyResults", dateString);
          // Prepare update for daily result
          batch.update(dailyResultDocRef, {
            "fields.team1Score.integerValue": team1ScoreForDay,
            "fields.team2Score.integerValue": team2ScoreForDay,
            "fields.winner": dailyWinnerTeamName ? { stringValue: dailyWinnerTeamName } : { nullValue: null },
            "fields.loser": dailyLoserTeamName ? { stringValue: dailyLoserTeamName } : { nullValue: null },
            "fields.status.stringValue": dailyStatus,
          });
          updatesMadeCount++; 
          details.push(`Daily Result Update (R${roundNum} M${matchId} D${dateString}): ${team1Name}(${team1ScoreForDay}) vs ${team2Name}(${team2ScoreForDay}). Daily Winner: ${dailyWinnerTeamName || 'None'}. Status: ${dailyStatus}.`);

          if (!seriesConcludedForThisMatch && (matchTeam1AggregateDailyWins >= 3 || matchTeam2AggregateDailyWins >= 3)) {
            seriesWinnerForThisMatch = matchTeam1AggregateDailyWins >= 3 ? team1Name : team2Name;
            seriesConcludedForThisMatch = true; // Mark series as concluded for this sync operation
            details.push(`Series for Match ${matchId} (Round ${roundNum}) now determined. Winner: ${seriesWinnerForThisMatch}. Further daily wins in this match won't change series outcome for this sync.`);
          }
        } // End of 5-day loop for a match

        // Update the parent match document with aggregated daily wins and series winner
        const parentMatchDocRef = doc(db, "tournaments", activeTournamentId, "rounds", String(roundNum), "matches", matchId);
        batch.update(parentMatchDocRef, {
            "fields.team1Wins.integerValue": matchTeam1AggregateDailyWins,
            "fields.team2Wins.integerValue": matchTeam2AggregateDailyWins,
            "fields.advanced": seriesWinnerForThisMatch ? { stringValue: seriesWinnerForThisMatch } : { nullValue: null }
        });
        updatesMadeCount++; // Count this as one update group (daily + parent match)
        details.push(`Parent Match Update (R${roundNum} M${matchId}): Team1 Wins: ${matchTeam1AggregateDailyWins}, Team2 Wins: ${matchTeam2AggregateDailyWins}, Series Winner: ${seriesWinnerForThisMatch || 'None'}`);
      } // End of matches loop for a round
    } // End of rounds loop
    
    if (updatesMadeCount > 0) {
      await batch.commit();
      details.push(`Batch commit successful. ${updatesMadeCount} Firestore field groups updated.`);
      return { success: true, message: `Sync complete. Daily scores, daily winners/losers, overall match wins, and series winners updated based on Sheet1Rows. ${updatesMadeCount} field groups modified.`, details };
    } else {
      details.push("No score updates or match outcome changes were necessary based on current Sheet1Rows data and tournament structure.");
      return { success: true, message: "Sync complete. No updates to scores or match outcomes were needed.", details };
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
