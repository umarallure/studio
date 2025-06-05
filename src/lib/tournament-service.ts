
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, Timestamp, writeBatch, query, orderBy, limit, type DocumentData, getDocs, type WhereFilterOp } from 'firebase/firestore';
import type { TournamentSettings, SheetRow } from '@/lib/types';
import { format as formatDate, addDays, parseISO, isFuture, isEqual } from 'date-fns';
import { mapDocToSheetRow } from '@/lib/tournament-config';


// Helper function to create daily result placeholders for a match
async function _createDailyResultPlaceholdersForMatch(
  tournamentId: string,
  roundNumStr: string,
  matchId: string,
  team1Name: string,
  team2Name: string,
  tournamentStartDate: Date,
  batch: FirebaseFirestore.WriteBatch,
  details: string[]
) {
  if (team1Name === "TBD" || team2Name === "TBD") {
    details.push(`Not creating daily placeholders for R${roundNumStr} M${matchId} as teams are not yet fully determined.`);
    return;
  }

  for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
    const matchDate = addDays(tournamentStartDate, dayIndex);
    const dateString = formatDate(matchDate, 'yyyy-MM-dd');
    const dailyResultDocRef = doc(db, "tournaments", tournamentId, "rounds", roundNumStr, 'matches', matchId, 'dailyResults', dateString);
    
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
    // Using batch.set ensures the document is created or overwritten if it exists.
    // This is generally fine for placeholders.
    batch.set(dailyResultDocRef, dailyResultData);
  }
  details.push(`Ensured 5 daily result placeholders for R${roundNumStr} M${matchId} (${team1Name} vs ${team2Name}).`);
}

// Helper function to check if a round is complete and set up the next round
async function _checkAndAdvanceToNextRound(
  activeTournamentId: string,
  tournamentSettings: { startDate: Date; numberOfRounds: number; name: string; teamCount: number },
  currentRoundNumInt: number,
  batch: FirebaseFirestore.WriteBatch,
  details: string[]
) {
  const currentRoundNumStr = String(currentRoundNumInt);
  const nextRoundNumInt = currentRoundNumInt + 1;
  const nextRoundNumStr = String(nextRoundNumInt);

  if (currentRoundNumInt >= tournamentSettings.numberOfRounds) {
    details.push(`Round ${currentRoundNumStr} is the final round for tournament "${tournamentSettings.name}". No further advancement needed.`);
    return; 
  }

  details.push(`Checking if round ${currentRoundNumStr} of "${tournamentSettings.name}" is complete to advance to round ${nextRoundNumStr}.`);

  const currentRoundMatchesRef = collection(db, "tournaments", activeTournamentId, "rounds", currentRoundNumStr, "matches");
  const currentRoundMatchesSnap = await getDocs(query(currentRoundMatchesRef, orderBy('__name__'))); 

  if (currentRoundMatchesSnap.empty) {
    details.push(`No matches found in current round ${currentRoundNumStr}. Cannot advance.`);
    return;
  }

  const winnersFromCurrentRound: string[] = [];
  let allCurrentRoundMatchesConcluded = true;

  currentRoundMatchesSnap.forEach(matchDoc => {
    const matchData = matchDoc.data().fields;
    if (matchData?.advanced?.stringValue) {
      winnersFromCurrentRound.push(matchData.advanced.stringValue);
    } else {
      allCurrentRoundMatchesConcluded = false;
    }
  });

  if (!allCurrentRoundMatchesConcluded) {
    details.push(`Round ${currentRoundNumStr} is not yet complete. Not advancing to round ${nextRoundNumStr}.`);
    return;
  }

  if (winnersFromCurrentRound.length === 0 && tournamentSettings.numberOfRounds > 0 && currentRoundNumInt < tournamentSettings.numberOfRounds) {
      details.push(`Round ${currentRoundNumStr} is marked complete, but no winners found. This might indicate an issue or an empty round. Not advancing.`);
      return;
  }
  
  details.push(`All matches in round ${currentRoundNumStr} are complete. Winners: ${winnersFromCurrentRound.join(', ')}. Proceeding to set up round ${nextRoundNumStr}.`);

  const nextRoundMatchesRef = collection(db, "tournaments", activeTournamentId, "rounds", nextRoundNumStr, "matches");
  const nextRoundMatchesSnap = await getDocs(query(nextRoundMatchesRef, orderBy('__name__')));

  if (nextRoundMatchesSnap.empty && winnersFromCurrentRound.length > 0) {
    details.push(`Error: Matches for next round ${nextRoundNumStr} not found, but winners exist from current round. Bracket might not have been initialized correctly or completely for all rounds.`);
    return;
  }
  if (nextRoundMatchesSnap.empty && winnersFromCurrentRound.length === 0) {
      details.push(`Next round ${nextRoundNumStr} is empty and no winners from current round ${currentRoundNumStr}. This might be expected if it's beyond a single-winner final round.`);
      return; // Normal if current round was final match leading to overall winner but no "next" bracket round
  }


  const nextRoundMatchDocs = nextRoundMatchesSnap.docs;
  const expectedNextRoundMatches = winnersFromCurrentRound.length / 2;

  if (expectedNextRoundMatches === 0 && winnersFromCurrentRound.length === 1 && currentRoundNumInt === tournamentSettings.numberOfRounds -1) {
      details.push(`Tournament winner for "${tournamentSettings.name}" is ${winnersFromCurrentRound[0]}. This was the final match series.`);
      // Potentially update tournament document with overall winner here if desired
      // const tournamentDocRef = doc(db, "tournaments", activeTournamentId);
      // batch.update(tournamentDocRef, { overallWinner: winnersFromCurrentRound[0], status: "Completed" });
      return;
  }


  if (expectedNextRoundMatches !== nextRoundMatchDocs.length) {
      details.push(`Error: Mismatch in expected next round matches (${expectedNextRoundMatches} from ${winnersFromCurrentRound.length} winners) and actual next round matches found (${nextRoundMatchDocs.length}). Cannot reliably set up round ${nextRoundNumStr}.`);
      return;
  }

  for (let i = 0; i < nextRoundMatchDocs.length; i++) {
    const matchToUpdateDoc = nextRoundMatchDocs[i];
    const team1Name = winnersFromCurrentRound[i * 2];
    const team2Name = winnersFromCurrentRound[i * 2 + 1];

    if (!team1Name || !team2Name) {
      details.push(`Error: Could not determine both team names for match ${matchToUpdateDoc.id} in round ${nextRoundNumStr} (Index ${i}). Winners array: ${winnersFromCurrentRound.join('/')}. Skipping this match setup.`);
      continue;
    }

    const existingNextRoundMatchData = matchToUpdateDoc.data().fields;
    // Only update if teams are currently TBD or different (idempotency)
    if (existingNextRoundMatchData.team1?.stringValue !== team1Name || existingNextRoundMatchData.team2?.stringValue !== team2Name || existingNextRoundMatchData.team1?.stringValue === "TBD") {
        batch.update(matchToUpdateDoc.ref, {
            "fields.team1.stringValue": team1Name,
            "fields.team2.stringValue": team2Name,
            "fields.team1Wins.integerValue": 0, 
            "fields.team2Wins.integerValue": 0,
            "fields.advanced.nullValue": null, 
        });
        details.push(`Updated R${nextRoundNumStr} M${matchToUpdateDoc.id} with teams: ${team1Name} vs ${team2Name}.`);

        await _createDailyResultPlaceholdersForMatch(
            activeTournamentId,
            nextRoundNumStr,
            matchToUpdateDoc.id,
            team1Name,
            team2Name,
            tournamentSettings.startDate, 
            batch,
            details
        );
    } else {
        details.push(`R${nextRoundNumStr} M${matchToUpdateDoc.id} already has correct teams: ${team1Name} vs ${team2Name}. Ensuring daily placeholders.`);
         await _createDailyResultPlaceholdersForMatch( // Still ensure placeholders
            activeTournamentId, nextRoundNumStr, matchToUpdateDoc.id, team1Name, team2Name,
            tournamentSettings.startDate, batch, details
        );
    }
  }
  details.push(`Successfully set up matches and daily placeholders for round ${nextRoundNumStr}.`);
}

// Initialize the bracket structure for a tournament
async function _initializeTournamentBracketStructure(tournamentId: string, settings: TournamentSettings): Promise<void> {
  const { teamCount, numberOfRounds, startDate } = settings;
  const teams: string[] = Array.from({ length: teamCount }, (_, i) => `Team ${i + 1}`);
  const batch = writeBatch(db);
  const initDetails: string[] = [];

  for (let roundNum = 1; roundNum <= numberOfRounds; roundNum++) {
    const roundNumStr = String(roundNum);
    const matchesInThisRoundIds: string[] = [];
    
    let numMatchesThisRound;
    if (roundNum === 1) {
      numMatchesThisRound = teamCount / 2;
    } else {
      numMatchesThisRound = teamCount / Math.pow(2, roundNum);
      if (numMatchesThisRound < 1 && numberOfRounds > 0) numMatchesThisRound = 1; // Ensure final round has at least 1 match if teamCount implies fractional
      else if (numMatchesThisRound < 1) numMatchesThisRound = 0;
    }
    if (numMatchesThisRound === 0 && roundNum <= numberOfRounds) { // Avoid creating 0 matches if calculation is off
        initDetails.push(`Calculated 0 matches for round ${roundNumStr}, but numberOfRounds is ${numberOfRounds}. Skipping round generation.`);
        continue;
    }


    for (let i = 0; i < numMatchesThisRound; i++) {
      const matchId = `match${i + 1}`; 
      let team1Name: string = "TBD";
      let team2Name: string = "TBD";

      if (roundNum === 1) {
        if ((i*2 + 1) < teams.length) { // Ensure we don't go out of bounds for teams array
            team1Name = teams[i * 2];
            team2Name = teams[i * 2 + 1];
        } else {
            initDetails.push(`Could not assign both teams for R1 M${matchId}, not enough teams for pair. Teams: ${teams.length}, Index: ${i*2}`);
            // This case should ideally not happen with 2^n team counts.
            continue;
        }
      }
      
      const matchDocRef = doc(db, "tournaments", tournamentId, "rounds", roundNumStr, 'matches', matchId);
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
      matchesInThisRoundIds.push(matchId);

      if (team1Name !== "TBD" && team2Name !== "TBD") {
        await _createDailyResultPlaceholdersForMatch(
          tournamentId, roundNumStr, matchId, team1Name, team2Name,
          settings.startDate, batch, initDetails
        );
      }
    }
    if (numMatchesThisRound === 1 && roundNum >= numberOfRounds && numberOfRounds > 0) break; 
  }

  try {
    await batch.commit();
    console.log(`Bracket structure for tournament ${tournamentId} initialized. Details: ${initDetails.join('; ')}`);
  } catch (error) {
    console.error(`Error initializing bracket structure for tournament ${tournamentId}:`, error);
    console.error(`Initialization attempt details: ${initDetails.join('; ')}`);
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
    console.log("Tournament settings created with ID: ", docRef.id);
    
    await _initializeTournamentBracketStructure(docRef.id, settings);

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error creating tournament or initializing bracket: ", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred." };
  }
}

function normalizeDateString(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  try {
    // Handles 'MM/DD/YYYY' or 'M/D/YY' and ISO-like strings more robustly
    let dateObj;
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000; // Assuming 2-digit years are 20xx
        const month = parseInt(parts[0], 10) - 1; // Month is 0-indexed
        const day = parseInt(parts[1], 10);
        dateObj = new Date(Date.UTC(year, month, day)); // Use UTC to avoid timezone shifts from sheet
    } else {
        dateObj = new Date(dateStr + "T00:00:00Z"); // Assume ISO-like, interpret as UTC
    }

    if (isNaN(dateObj.getTime())) { 
      console.warn(`Could not parse date: ${dateStr} into a valid Date object.`);
      return null;
    }
    return formatDate(dateObj, 'yyyy-MM-dd'); // Format as yyyy-MM-dd
  } catch (e) {
    console.warn(`Exception while parsing date: ${dateStr}`, e);
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
      details.push(`Error: Tournament with ID ${activeTournamentId} not found.`);
      return { success: false, message: `Tournament with ID ${activeTournamentId} not found.`, details };
    }
    const tournamentDataFromDb = tournamentDocSnap.data();
    if (!tournamentDataFromDb) {
        details.push(`Error: Tournament data for ID ${activeTournamentId} is empty or undefined.`);
        return { success: false, message: `Tournament data for ID ${activeTournamentId} is empty.`, details };
    }

    const tournamentSettings = {
        startDate: tournamentDataFromDb.startDate instanceof Timestamp
            ? tournamentDataFromDb.startDate.toDate()
            : new Date(tournamentDataFromDb.startDate), // Fallback if not a Timestamp
        numberOfRounds: tournamentDataFromDb.numberOfRounds || 0,
        name: tournamentDataFromDb.name || "Unnamed Tournament",
        teamCount: tournamentDataFromDb.teamCount || 0,
    };
    
    details.push(`Tournament "${tournamentSettings.name}" (ID: ${activeTournamentId}) found, starts on ${formatDate(tournamentSettings.startDate, 'yyyy-MM-dd')}. Rounds: ${tournamentSettings.numberOfRounds}. Teams: ${tournamentSettings.teamCount}`);

    if (tournamentSettings.numberOfRounds === 0) {
        details.push("Tournament has 0 rounds. No scores to sync or matches to process.");
        return { success: true, message: "Sync complete. Tournament has 0 rounds.", details };
    }

    const sheetRowsCollectionRef = collection(db, "Sheet1Rows");
    const sheetRowsQuery = query(sheetRowsCollectionRef);
    const sheetRowsSnapshot = await getDocs(sheetRowsQuery);
    const sheetRows: SheetRow[] = [];
    sheetRowsSnapshot.forEach(docSnap => {
      const row = mapDocToSheetRow(docSnap.id, docSnap.data());
      if (row) sheetRows.push(row);
    });
    details.push(`Fetched ${sheetRows.length} rows from Sheet1Rows.`);

    const teamDailyScores = new Map<string, Map<string, number>>();
    sheetRows.forEach(row => {
      if (row.LeadVender && row.Date && row.Status === "Submitted") {
        const teamName = row.LeadVender;
        const normalizedDate = normalizeDateString(row.Date);
        if (!normalizedDate) {
            details.push(`Skipping row ID ${row.id} (Agent: ${row.Agent}, Date: ${row.Date}) due to unparseable/invalid date.`);
            return;
        }
        if (!teamDailyScores.has(teamName)) {
          teamDailyScores.set(teamName, new Map<string, number>());
        }
        const scoresForTeam = teamDailyScores.get(teamName)!;
        scoresForTeam.set(normalizedDate, (scoresForTeam.get(normalizedDate) || 0) + 1);
      }
    });
    details.push(`Aggregated scores for ${teamDailyScores.size} teams from ${sheetRows.filter(r => r.Status === "Submitted").length} submitted entries.`);

    const batch = writeBatch(db);
    let updatesMadeCount = 0;
    let roundsPotentiallyCompletedThisSync: Set<number> = new Set();


    for (let roundNumInt = 1; roundNumInt <= tournamentSettings.numberOfRounds; roundNumInt++) {
      const roundNumStr = String(roundNumInt);
      const matchesCollectionRef = collection(db, "tournaments", activeTournamentId, "rounds", roundNumStr, "matches");
      const matchesQuery = query(matchesCollectionRef, orderBy('__name__'));
      const matchesSnapshot = await getDocs(matchesQuery);

      if (matchesSnapshot.empty && roundNumInt === 1 && tournamentSettings.teamCount > 0) {
          details.push(`Warning: No matches found for Round 1 of "${tournamentSettings.name}". Initialization might be incomplete.`);
          continue;
      }
       if (matchesSnapshot.empty && roundNumInt > 1) {
          details.push(`No matches found for Round ${roundNumStr} of "${tournamentSettings.name}". This round may not be set up yet or is empty.`);
          continue; 
      }

      for (const matchDoc of matchesSnapshot.docs) {
        const matchId = matchDoc.id;
        const existingMatchData = matchDoc.data().fields;
        const originalAdvancedTeam = existingMatchData.advanced?.stringValue || null;

        const team1Name = existingMatchData.team1?.stringValue;
        const team2Name = existingMatchData.team2?.stringValue;

        if (!team1Name || team1Name === "TBD" || !team2Name || team2Name === "TBD") {
          details.push(`Skipping score processing for R${roundNumStr} M${matchId} in "${tournamentSettings.name}" as teams are not fully determined.`);
          continue; 
        }
        
        let currentMatchTeam1AggDailyWins = 0;
        let currentMatchTeam2AggDailyWins = 0;
        let seriesWinnerForThisMatch: string | null = originalAdvancedTeam;
        let seriesConcludedByStoredState = !!seriesWinnerForThisMatch;

        if (seriesConcludedByStoredState) {
            currentMatchTeam1AggDailyWins = parseInt(existingMatchData.team1Wins?.integerValue || '0', 10);
            currentMatchTeam2AggDailyWins = parseInt(existingMatchData.team2Wins?.integerValue || '0', 10);
            details.push(`R${roundNumStr} M${matchId} (${team1Name} vs ${team2Name}) series previously concluded. Winner: ${seriesWinnerForThisMatch}. Daily scores updated, series win counts preserved unless recalc changes outcome.`);
        }

        // Recalculate daily wins from scores, even if series was "concluded", to ensure data integrity if scores change
        let calculatedTeam1DailyWins = 0;
        let calculatedTeam2DailyWins = 0;

        for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
          const currentDate = addDays(tournamentSettings.startDate, dayIndex);
          const dateString = formatDate(currentDate, 'yyyy-MM-dd');
          
          const team1ScoreForDay = teamDailyScores.get(team1Name)?.get(dateString) || 0;
          const team2ScoreForDay = teamDailyScores.get(team2Name)?.get(dateString) || 0;

          let dailyWinnerTeamName: string | null = null;
          let dailyLoserTeamName: string | null = null;
          let dailyStatus = "Scheduled";

          const dailyResultDocRef = doc(db, "tournaments", activeTournamentId, "rounds", roundNumStr, "matches", matchId, "dailyResults", dateString);
          
          const dailyDocSnap = await getDoc(dailyResultDocRef);
          if (!dailyDocSnap.exists() ) {
             details.push(`Daily result doc for R${roundNumStr} M${matchId} on ${dateString} does not exist. Creating it (needed for scores).`);
             await _createDailyResultPlaceholdersForMatch(activeTournamentId,roundNumStr, matchId, team1Name, team2Name, tournamentSettings.startDate, batch,details);
             // This placeholder creation is for THIS specific day only if missing, not all 5.
             // The _createDailyResultPlaceholdersForMatch called earlier would handle all 5 for new matches.
             // For robustness, we ensure at least this one exists.
             const placeholderData = { fields: { team1: { stringValue: team1Name }, team2: { stringValue: team2Name }, team1Score: { integerValue: 0 }, team2Score: { integerValue: 0 }, winner: { nullValue: null }, loser: { nullValue: null }, status: { stringValue: "Scheduled" } } };
             batch.set(dailyResultDocRef, placeholderData); // Ensure it exists
             updatesMadeCount++;
          }

          if (team1ScoreForDay > team2ScoreForDay) {
              dailyWinnerTeamName = team1Name;
              dailyLoserTeamName = team2Name;
              calculatedTeam1DailyWins++;
              dailyStatus = "Completed";
          } else if (team2ScoreForDay > team1ScoreForDay) {
              dailyWinnerTeamName = team2Name;
              dailyLoserTeamName = team1Name;
              calculatedTeam2DailyWins++;
              dailyStatus = "Completed";
          } else {
              const today = new Date(); today.setHours(0,0,0,0);
              const currentMatchDate = parseISO(dateString); 
              currentMatchDate.setHours(0,0,0,0);
              if (team1ScoreForDay === 0 && team2ScoreForDay === 0 && isFuture(currentMatchDate) && !isEqual(currentMatchDate,today)) {
                  dailyStatus = "Scheduled";
              } else { 
                  dailyStatus = "Completed - Tie";
              }
          }
          
          batch.update(dailyResultDocRef, {
            "fields.team1Score.integerValue": team1ScoreForDay,
            "fields.team2Score.integerValue": team2ScoreForDay,
            "fields.winner": dailyWinnerTeamName ? { stringValue: dailyWinnerTeamName } : { nullValue: null },
            "fields.loser": dailyLoserTeamName ? { stringValue: dailyLoserTeamName } : { nullValue: null },
            "fields.status.stringValue": dailyStatus,
          });
          updatesMadeCount++;
          details.push(`Daily Result (R${roundNumStr} M${matchId} Date:${dateString}): ${team1Name}(${team1ScoreForDay}) vs ${team2Name}(${team2ScoreForDay}). Winner: ${dailyWinnerTeamName || 'None'}. Status: ${dailyStatus}.`);
        } 

        // Determine series winner based on *calculated* daily wins
        let newSeriesWinner: string | null = null;
        if (calculatedTeam1DailyWins >= 3) newSeriesWinner = team1Name;
        else if (calculatedTeam2DailyWins >= 3) newSeriesWinner = team2Name;

        // Update parent match with new calculated daily wins and new series winner
        const parentMatchDocRef = doc(db, "tournaments", activeTournamentId, "rounds", roundNumStr, "matches", matchId);
        const updatePayload: any = {
            "fields.team1Wins.integerValue": calculatedTeam1DailyWins,
            "fields.team2Wins.integerValue": calculatedTeam2DailyWins,
        };
        if (newSeriesWinner) {
            updatePayload["fields.advanced.stringValue"] = newSeriesWinner;
        } else {
            updatePayload["fields.advanced.nullValue"] = null;
        }
        batch.update(parentMatchDocRef, updatePayload);
        updatesMadeCount++;
        details.push(`Parent Match (R${roundNumStr} M${matchId}): ${team1Name} CalcDailyWins: ${calculatedTeam1DailyWins}, ${team2Name} CalcDailyWins: ${calculatedTeam2DailyWins}, New Series Winner: ${newSeriesWinner || 'None'}`);

        // If the series winner changed or was newly set, mark round for advancement check
        if (newSeriesWinner && newSeriesWinner !== originalAdvancedTeam) {
            details.push(`Series winner for R${roundNumStr} M${matchId} changed/set to ${newSeriesWinner}. Marking round for advancement check.`);
            roundsPotentiallyCompletedThisSync.add(roundNumInt);
        } else if (!newSeriesWinner && originalAdvancedTeam) {
            details.push(`Series winner for R${roundNumStr} M${matchId} removed (was ${originalAdvancedTeam}). Marking round for advancement check.`);
            roundsPotentiallyCompletedThisSync.add(roundNumInt);
        } else if (newSeriesWinner && newSeriesWinner === originalAdvancedTeam) {
             // Winner is the same, but if all matches in the round are now done, it still needs check.
             roundsPotentiallyCompletedThisSync.add(roundNumInt);
        }

      } 
    } 

    const sortedRoundsToCheckForAdvancement = Array.from(roundsPotentiallyCompletedThisSync).sort((a, b) => a - b);
    for (const roundNumToAdvance of sortedRoundsToCheckForAdvancement) {
        details.push(`Checking round ${roundNumToAdvance} for advancement based on this sync's updates to "${tournamentSettings.name}".`);
        await _checkAndAdvanceToNextRound(activeTournamentId, tournamentSettings, roundNumToAdvance, batch, details);
    }
    
    if (updatesMadeCount > 0) {
      await batch.commit();
      details.push(`Batch commit successful. ${updatesMadeCount} Firestore field groups updated/set for tournament "${tournamentSettings.name}".`);
      return { success: true, message: `Sync complete for "${tournamentSettings.name}". Daily scores, winners/losers, match wins, series winners, and round advancements processed. ${updatesMadeCount} groups modified.`, details };
    } else {
      details.push(`No score updates or match outcome changes were necessary for "${tournamentSettings.name}" based on current Sheet1Rows data.`);
      return { success: true, message: `Sync complete for "${tournamentSettings.name}". No updates needed.`, details };
    }

  } catch (error) {
    console.error(`Critical error in syncSheetScoresToDailyResults for tournament ${activeTournamentId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    details.push(`Critical error during sync: ${errorMessage} \nStack: ${error instanceof Error ? error.stack : 'N/A'}`);
    return { success: false, message: `Failed to sync scores for "${activeTournamentId}": ${errorMessage}`, details };
  }
}
