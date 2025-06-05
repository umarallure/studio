
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, Timestamp, writeBatch, query, orderBy, limit, type DocumentData, getDocs, type WhereFilterOp } from 'firebase/firestore';
import type { TournamentSettings, SheetRow } from '@/lib/types';
import { format as formatDate, addDays, parseISO, isFuture, isEqual } from 'date-fns';
import { mapDocToSheetRow } from '@/lib/tournament-config';


// Helper function to create daily result placeholders for a match for a specific week
async function _createDailyResultPlaceholdersForMatch(
  tournamentId: string,
  roundNumStr: string,
  matchId: string,
  team1Name: string,
  team2Name: string,
  effectiveMatchStartDate: Date, // The specific start date for this match's 5-day series
  batch: FirebaseFirestore.WriteBatch,
  details: string[]
) {
  if (team1Name === "TBD" || team2Name === "TBD") {
    details.push(`Not creating daily placeholders for R${roundNumStr} M${matchId} as teams are not yet fully determined.`);
    return;
  }

  for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
    const matchDate = addDays(effectiveMatchStartDate, dayIndex);
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
    batch.set(dailyResultDocRef, dailyResultData);
  }
  details.push(`Ensured 5 daily result placeholders for R${roundNumStr} M${matchId} (${team1Name} vs ${team2Name}) starting ${formatDate(effectiveMatchStartDate, 'yyyy-MM-dd')}.`);
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

  details.push(`Checking if round ${currentRoundNumStr} of "${tournamentSettings.name}" is complete to advance.`);

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

  if (currentRoundNumInt === tournamentSettings.numberOfRounds) { // This IS the final round
    if (allCurrentRoundMatchesConcluded && winnersFromCurrentRound.length === 1) {
      const tournamentWinnerName = winnersFromCurrentRound[0];
      details.push(`Tournament "${tournamentSettings.name}" concluded! Overall Winner: ${tournamentWinnerName}.`);
      const tournamentDocRef = doc(db, "tournaments", activeTournamentId);
      // Update the main tournament document with the winner and status
      batch.update(tournamentDocRef, { 
        "overallWinnerName": tournamentWinnerName, // Assuming top-level field
        "status": "Completed" // Assuming top-level field
      });
    } else if (allCurrentRoundMatchesConcluded && winnersFromCurrentRound.length !== 1) {
      details.push(`Final round ${currentRoundNumStr} of "${tournamentSettings.name}" is complete, but an unexpected number of winners (${winnersFromCurrentRound.length}) found. Expected 1.`);
    } else {
      details.push(`Final round ${currentRoundNumStr} of "${tournamentSettings.name}" is not yet fully concluded.`);
    }
    return; // No "next" round to set up
  }
  
  // If not the final round, proceed with advancement logic
  if (!allCurrentRoundMatchesConcluded) {
    details.push(`Round ${currentRoundNumStr} is not yet complete. Not advancing to round ${nextRoundNumStr}.`);
    return;
  }

  if (winnersFromCurrentRound.length === 0) {
      details.push(`Round ${currentRoundNumStr} is marked complete, but no winners found. Cannot advance.`);
      return;
  }
  
  details.push(`All matches in round ${currentRoundNumStr} are complete. Winners: ${winnersFromCurrentRound.join(', ')}. Proceeding to set up round ${nextRoundNumStr}.`);

  const nextRoundMatchesRef = collection(db, "tournaments", activeTournamentId, "rounds", nextRoundNumStr, "matches");
  const nextRoundMatchesSnap = await getDocs(query(nextRoundMatchesRef, orderBy('__name__')));

  if (nextRoundMatchesSnap.empty && winnersFromCurrentRound.length > 0) {
    details.push(`Error: Placeholder matches for next round ${nextRoundNumStr} not found, but winners exist from current round. Bracket might not have been initialized correctly for all rounds.`);
    return;
  }
  
  const nextRoundMatchDocs = nextRoundMatchesSnap.docs;
  const expectedNextRoundMatches = winnersFromCurrentRound.length / 2;

  if (expectedNextRoundMatches !== nextRoundMatchDocs.length) {
      details.push(`Error: Mismatch in expected next round matches (${expectedNextRoundMatches} from ${winnersFromCurrentRound.length} winners) and actual next round matches found (${nextRoundMatchDocs.length}). Cannot reliably set up round ${nextRoundNumStr}.`);
      return;
  }

  // Calculate the start date for the next round's matches (1 week after the previous round's start)
  // The start date for Round R is: tournamentStartDate + (R - 1) * 7 days
  const nextRoundEffectiveStartDate = addDays(tournamentSettings.startDate, (nextRoundNumInt - 1) * 7);
  details.push(`Next round (${nextRoundNumStr}) matches will be scheduled starting: ${formatDate(nextRoundEffectiveStartDate, 'yyyy-MM-dd')}`);


  for (let i = 0; i < nextRoundMatchDocs.length; i++) {
    const matchToUpdateDoc = nextRoundMatchDocs[i];
    const team1Name = winnersFromCurrentRound[i * 2];
    const team2Name = winnersFromCurrentRound[i * 2 + 1];

    if (!team1Name || !team2Name) {
      details.push(`Error: Could not determine both team names for match ${matchToUpdateDoc.id} in round ${nextRoundNumStr} (Index ${i}). Winners array: ${winnersFromCurrentRound.join('/')}. Skipping this match setup.`);
      continue;
    }

    const existingNextRoundMatchData = matchToUpdateDoc.data().fields;
    if (existingNextRoundMatchData.team1?.stringValue !== team1Name || existingNextRoundMatchData.team2?.stringValue !== team2Name || existingNextRoundMatchData.team1?.stringValue === "TBD") {
        batch.update(matchToUpdateDoc.ref, {
            "fields.team1": { stringValue: team1Name }, // Correctly update the map field
            "fields.team2": { stringValue: team2Name },
            "fields.team1Wins": { integerValue: 0 }, 
            "fields.team2Wins": { integerValue: 0 },
            "fields.advanced": { nullValue: null }, 
        });
        details.push(`Updated R${nextRoundNumStr} M${matchToUpdateDoc.id} with teams: ${team1Name} vs ${team2Name}.`);

        await _createDailyResultPlaceholdersForMatch(
            activeTournamentId,
            nextRoundNumStr,
            matchToUpdateDoc.id,
            team1Name,
            team2Name,
            nextRoundEffectiveStartDate, // Pass the calculated start date for this round's matches
            batch,
            details
        );
    } else {
        details.push(`R${nextRoundNumStr} M${matchToUpdateDoc.id} already has correct teams: ${team1Name} vs ${team2Name}. Ensuring daily placeholders with correct dates.`);
         await _createDailyResultPlaceholdersForMatch(
            activeTournamentId, nextRoundNumStr, matchToUpdateDoc.id, team1Name, team2Name,
            nextRoundEffectiveStartDate, batch, details // Ensure correct dates for existing placeholders
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
      const previousRoundMatches = teamCount / Math.pow(2, roundNum - 1);
      numMatchesThisRound = previousRoundMatches / 2;
      if (numMatchesThisRound < 1 && numberOfRounds > 0 && previousRoundMatches === 1) numMatchesThisRound = 1; // Final match if previous round had 1 match (2 teams)
      else if (numMatchesThisRound < 1) numMatchesThisRound = 0;
    }

    if (numMatchesThisRound === 0 && roundNum <= numberOfRounds) { 
        initDetails.push(`Calculated 0 matches for round ${roundNumStr}, but numberOfRounds is ${numberOfRounds}. This might be an empty round setup if not final.`);
        continue;
    }

    const currentRoundEffectiveStartDate = addDays(settings.startDate, (roundNum - 1) * 7);
    initDetails.push(`Round ${roundNumStr} matches will be scheduled starting: ${formatDate(currentRoundEffectiveStartDate, 'yyyy-MM-dd')}`);

    for (let i = 0; i < numMatchesThisRound; i++) {
      const matchId = `match${i + 1}`; 
      let team1Name: string = "TBD";
      let team2Name: string = "TBD";

      if (roundNum === 1) { // Only auto-populate teams for the first round
        if ((i*2 + 1) < teams.length) { 
            team1Name = teams[i * 2];
            team2Name = teams[i * 2 + 1];
        } else {
            initDetails.push(`Could not assign both teams for R1 M${matchId}, not enough teams for pair. Teams: ${teams.length}, Index: ${i*2}`);
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

      // For Round 1, create daily placeholders immediately with its effective start date
      if (roundNum === 1 && team1Name !== "TBD" && team2Name !== "TBD") {
        await _createDailyResultPlaceholdersForMatch(
          tournamentId, roundNumStr, matchId, team1Name, team2Name,
          currentRoundEffectiveStartDate, // Use the calculated start date for this round
          batch, initDetails
        );
      } else if (roundNum > 1) {
        // For subsequent rounds, placeholders are created when teams are advanced into them by _checkAndAdvanceToNextRound
        // However, we should still create empty dailyResults if match has TBD teams to ensure structure.
        // No, this is not ideal. Placeholders for future rounds (TBD vs TBD) should only be created when teams are known.
        // The _checkAndAdvanceToNextRound will handle placeholder creation for R2+
         initDetails.push(`Placeholder match R${roundNumStr} M${matchId} created (TBD vs TBD). Daily results will be added when teams are set.`);
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
      status: "Scheduled", // Initial status
      // overallWinnerName will be added later
    };
    const docRef = await addDoc(collection(db, "tournaments"), tournamentDataToSave);
    console.log("Tournament settings created with ID: ", docRef.id);
    
    // Pass the full settings object including the original startDate
    await _initializeTournamentBracketStructure(docRef.id, { ...settings, id: docRef.id, createdAt: new Date() });


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
    let dateObj;
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000; 
        const month = parseInt(parts[0], 10) - 1; 
        const day = parseInt(parts[1], 10);
        dateObj = new Date(Date.UTC(year, month, day)); 
    } else {
        dateObj = new Date(dateStr + "T00:00:00Z"); 
    }

    if (isNaN(dateObj.getTime())) { 
      console.warn(`Could not parse date: ${dateStr} into a valid Date object.`);
      return null;
    }
    return formatDate(dateObj, 'yyyy-MM-dd'); 
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
            : new Date(tournamentDataFromDb.startDate), 
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

      // Calculate the effective start date for matches in THIS specific round
      const currentRoundEffectiveStartDate = addDays(tournamentSettings.startDate, (roundNumInt - 1) * 7);
      details.push(`Processing R${roundNumStr} matches. Effective start date for this round's daily results: ${formatDate(currentRoundEffectiveStartDate, 'yyyy-MM-dd')}`);


      for (const matchDoc of matchesSnapshot.docs) {
        const matchId = matchDoc.id;
        const existingMatchFields = matchDoc.data().fields; // This is the map of typed values
        const originalAdvancedTeam = existingMatchFields.advanced?.stringValue || null;

        const team1Name = existingMatchFields.team1?.stringValue;
        const team2Name = existingMatchFields.team2?.stringValue;

        if (!team1Name || team1Name === "TBD" || !team2Name || team2Name === "TBD") {
          details.push(`Skipping score processing for R${roundNumStr} M${matchId} in "${tournamentSettings.name}" as teams are not fully determined.`);
          continue; 
        }
        
        let calculatedTeam1DailyWins = 0;
        let calculatedTeam2DailyWins = 0;

        for (let dayIndex = 0; dayIndex < 5; dayIndex++) { // Max 5 days for a match series
          const currentDateForDailyResult = addDays(currentRoundEffectiveStartDate, dayIndex); // Use round-specific start date
          const dateString = formatDate(currentDateForDailyResult, 'yyyy-MM-dd');
          
          const team1ScoreForDay = teamDailyScores.get(team1Name)?.get(dateString) || 0;
          const team2ScoreForDay = teamDailyScores.get(team2Name)?.get(dateString) || 0;

          let dailyWinnerTeamName: string | null = null;
          let dailyLoserTeamName: string | null = null;
          let dailyStatus = "Scheduled";

          const dailyResultDocRef = doc(db, "tournaments", activeTournamentId, "rounds", roundNumStr, "matches", matchId, "dailyResults", dateString);
          
          const dailyDocSnap = await getDoc(dailyResultDocRef);
          let dailyResultFieldsUpdate: any = {};

          if (team1ScoreForDay > team2ScoreForDay) {
              dailyWinnerTeamName = team1Name;
              dailyLoserTeamName = team2Name;
              if (calculatedTeam1DailyWins < 3 && calculatedTeam2DailyWins < 3) calculatedTeam1DailyWins++; // only count if series not over
              dailyStatus = "Completed";
          } else if (team2ScoreForDay > team1ScoreForDay) {
              dailyWinnerTeamName = team2Name;
              dailyLoserTeamName = team1Name;
              if (calculatedTeam1DailyWins < 3 && calculatedTeam2DailyWins < 3) calculatedTeam2DailyWins++; // only count if series not over
              dailyStatus = "Completed";
          } else {
              const today = new Date(); today.setHours(0,0,0,0);
              const currentMatchDateForComparison = parseISO(dateString); 
              currentMatchDateForComparison.setHours(0,0,0,0); // Ensure comparison is date-only
              if (team1ScoreForDay === 0 && team2ScoreForDay === 0 && isFuture(currentMatchDateForComparison) && !isEqual(currentMatchDateForComparison,today)) {
                  dailyStatus = "Scheduled";
              } else { 
                  dailyStatus = "Completed - Tie";
              }
          }
          
          dailyResultFieldsUpdate['team1Score'] = { integerValue: team1ScoreForDay };
          dailyResultFieldsUpdate['team2Score'] = { integerValue: team2ScoreForDay };
          dailyResultFieldsUpdate['winner'] = dailyWinnerTeamName ? { stringValue: dailyWinnerTeamName } : { nullValue: null };
          dailyResultFieldsUpdate['loser'] = dailyLoserTeamName ? { stringValue: dailyLoserTeamName } : { nullValue: null };
          dailyResultFieldsUpdate['status'] = { stringValue: dailyStatus };

          if (!dailyDocSnap.exists()) {
             details.push(`Daily result doc for R${roundNumStr} M${matchId} on ${dateString} does not exist. Creating it with scores.`);
             // Also ensure team names are present if creating fresh
             dailyResultFieldsUpdate['team1'] = { stringValue: team1Name };
             dailyResultFieldsUpdate['team2'] = { stringValue: team2Name };
             batch.set(dailyResultDocRef, { fields: dailyResultFieldsUpdate });
          } else {
             batch.update(dailyResultDocRef, { fields: dailyResultFieldsUpdate });
          }
          updatesMadeCount++;
          details.push(`DailyResult (R${roundNumStr}M${matchId} D:${dateString}): ${team1Name}(${team1ScoreForDay}) vs ${team2Name}(${team2ScoreForDay}). Winner: ${dailyWinnerTeamName || 'None'}. Status: ${dailyStatus}.`);
        } 

        let newSeriesWinner: string | null = null;
        if (calculatedTeam1DailyWins >= 3) newSeriesWinner = team1Name;
        else if (calculatedTeam2DailyWins >= 3) newSeriesWinner = team2Name;

        const parentMatchDocRef = doc(db, "tournaments", activeTournamentId, "rounds", roundNumStr, "matches", matchId);
        const matchUpdatePayload: any = {
            "fields.team1Wins": { integerValue: calculatedTeam1DailyWins },
            "fields.team2Wins": { integerValue: calculatedTeam2DailyWins },
        };
        if (newSeriesWinner) {
            matchUpdatePayload["fields.advanced"] = { stringValue: newSeriesWinner };
        } else {
            // If no winner yet, ensure 'advanced' is null, especially if it might have been set before and scores changed
            matchUpdatePayload["fields.advanced"] = { nullValue: null };
        }
        batch.update(parentMatchDocRef, matchUpdatePayload);
        updatesMadeCount++;
        details.push(`ParentMatch (R${roundNumStr} M${matchId}): ${team1Name} CalcDailyWins: ${calculatedTeam1DailyWins}, ${team2Name} CalcDailyWins: ${calculatedTeam2DailyWins}, New Series Winner: ${newSeriesWinner || 'None'}`);

        if (newSeriesWinner && newSeriesWinner !== originalAdvancedTeam) {
            details.push(`Series winner for R${roundNumStr} M${matchId} changed/set to ${newSeriesWinner}. Marking round for advancement check.`);
            roundsPotentiallyCompletedThisSync.add(roundNumInt);
        } else if (!newSeriesWinner && originalAdvancedTeam) {
            details.push(`Series winner for R${roundNumStr} M${matchId} removed (was ${originalAdvancedTeam}). Marking round for advancement check.`);
            roundsPotentiallyCompletedThisSync.add(roundNumInt);
        } else if (newSeriesWinner && newSeriesWinner === originalAdvancedTeam) {
             roundsPotentiallyCompletedThisSync.add(roundNumInt);
        } else if (!newSeriesWinner && !originalAdvancedTeam) {
            // No winner before, no winner now, but if all other matches in round completed, this round might still need check
            roundsPotentiallyCompletedThisSync.add(roundNumInt);
        }
      } 
    } 

    const sortedRoundsToCheckForAdvancement = Array.from(roundsPotentiallyCompletedThisSync).sort((a, b) => a - b);
    for (const roundNumToAdvance of sortedRoundsToCheckForAdvancement) {
        details.push(`Checking round ${roundNumToAdvance} for advancement for tournament "${tournamentSettings.name}" based on this sync's updates.`);
        await _checkAndAdvanceToNextRound(activeTournamentId, tournamentSettings, roundNumToAdvance, batch, details);
    }
    
    if (updatesMadeCount > 0) {
      await batch.commit();
      details.push(`Batch commit successful. ${updatesMadeCount} Firestore operations performed for tournament "${tournamentSettings.name}".`);
      return { success: true, message: `Sync complete for "${tournamentSettings.name}". Daily scores, winners/losers, match wins, series winners, and round advancements (if any) processed. ${updatesMadeCount} operations.`, details };
    } else {
      details.push(`No score updates or match outcome changes were necessary for "${tournamentSettings.name}" based on current Sheet1Rows data.`);
      return { success: true, message: `Sync complete for "${tournamentSettings.name}". No data changes needed.`, details };
    }

  } catch (error) {
    console.error(`Critical error in syncSheetScoresToDailyResults for tournament ${activeTournamentId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    details.push(`Critical error during sync: ${errorMessage} \nStack: ${error instanceof Error ? error.stack : 'N/A'}`);
    return { success: false, message: `Failed to sync scores for tournament "${activeTournamentId}": ${errorMessage}`, details };
  }
}

    