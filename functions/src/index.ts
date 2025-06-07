
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { format as formatDate, addDays, parseISO, isFuture, isEqual, getDay } from "date-fns";

admin.initializeApp();
const db = admin.firestore();

// Helper: Normalize Date String (from existing lib/tournament-service.ts)
function normalizeDateString(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  try {
    let dateObj;
    if (dateStr.includes("/")) { // Handles MM/DD/YYYY
      const parts = dateStr.split("/");
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      dateObj = new Date(Date.UTC(year, month, day));
    } else { // Handles YYYY-MM-DD
      dateObj = new Date(dateStr + "T00:00:00Z"); // Assume UTC
    }

    if (isNaN(dateObj.getTime())) {
      functions.logger.warn(`Could not parse date: ${dateStr} into a valid Date object.`);
      return null;
    }
    return formatDate(dateObj, "yyyy-MM-dd");
  } catch (e: any) {
    functions.logger.warn(`Exception while parsing date: ${dateStr}`, e.message);
    return null;
  }
}

// Helper: Create Daily Result Placeholders (adapted from tournament-service.ts)
async function _createDailyResultPlaceholdersForMatch(
  tournamentId: string,
  roundNumStr: string,
  matchId: string,
  team1Name: string,
  team2Name: string,
  effectiveMatchStartDate: Date,
  batch: admin.firestore.WriteBatch,
  details: string[]
) {
  if (team1Name === "TBD" || team2Name === "TBD") {
    details.push(`Not creating daily placeholders for R${roundNumStr} M${matchId} as teams are not yet fully determined.`);
    return;
  }

  let workingDaysScheduled = 0;
  let calendarDayOffset = 0;
  const scheduledDates: string[] = [];

  while (workingDaysScheduled < 5) {
    const currentDate = addDays(effectiveMatchStartDate, calendarDayOffset);
    const dayOfWeek = getDay(currentDate);

    if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
      const dateString = formatDate(currentDate, "yyyy-MM-dd");
      scheduledDates.push(dateString);
      const dailyResultDocRef = db.doc(`tournaments/${tournamentId}/rounds/${roundNumStr}/matches/${matchId}/dailyResults/${dateString}`);
      
      const dailyResultData = { // This structure is for client compatibility (mapFirestoreDocToMatchup expects .fields)
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
      workingDaysScheduled++;
    }
    calendarDayOffset++;
    if (calendarDayOffset > 20 && workingDaysScheduled < 5) {
        details.push(`Warning: Could not find 5 working days within a reasonable offset for R${roundNumStr} M${matchId} starting ${formatDate(effectiveMatchStartDate, 'yyyy-MM-dd')}. Scheduled ${workingDaysScheduled} days.`);
        break;
    }
  }
  details.push(`Ensured 5 working day result placeholders for R${roundNumStr} M${matchId} (${team1Name} vs ${team2Name}). Dates: ${scheduledDates.join(", ")}.`);
}

// Helper: Check and Advance to Next Round (adapted from tournament-service.ts)
async function _checkAndAdvanceToNextRound(
  activeTournamentId: string,
  tournamentSettings: { startDate: Date; numberOfRounds: number; name: string; teamCount: number },
  currentRoundNumInt: number,
  batch: admin.firestore.WriteBatch,
  details: string[]
) {
  const currentRoundNumStr = String(currentRoundNumInt);
  const nextRoundNumInt = currentRoundNumInt + 1;
  const nextRoundNumStr = String(nextRoundNumInt);

  details.push(`Checking if round ${currentRoundNumStr} of "${tournamentSettings.name}" is complete to advance.`);

  const currentRoundMatchesRef = db.collection(`tournaments/${activeTournamentId}/rounds/${currentRoundNumStr}/matches`);
  const currentRoundMatchesSnap = await currentRoundMatchesRef.orderBy(admin.firestore.FieldPath.documentId()).get();

  if (currentRoundMatchesSnap.empty) {
    details.push(`No matches found in current round ${currentRoundNumStr}. Cannot advance.`);
    return;
  }

  const winnersFromCurrentRound: string[] = [];
  let allCurrentRoundMatchesConcluded = true;

  currentRoundMatchesSnap.forEach(matchDoc => {
    // With Admin SDK, data is direct, but we wrote it with 'fields' for client compatibility.
    const matchDataFields = matchDoc.data().fields; 
    if (matchDataFields?.advanced?.stringValue) {
      winnersFromCurrentRound.push(matchDataFields.advanced.stringValue);
    } else {
      allCurrentRoundMatchesConcluded = false;
    }
  });

  if (currentRoundNumInt === tournamentSettings.numberOfRounds) {
    if (allCurrentRoundMatchesConcluded && winnersFromCurrentRound.length === 1) {
      const tournamentWinnerName = winnersFromCurrentRound[0];
      details.push(`Tournament "${tournamentSettings.name}" concluded! Overall Winner: ${tournamentWinnerName}.`);
      const tournamentDocRef = db.doc(`tournaments/${activeTournamentId}`);
      // When updating the main tournament doc, it doesn't need the 'fields' wrapper if client reads it directly.
      // However, to be safe, let's assume client might map it with mapDocToTournamentSettings, which can handle direct or .fields.
      // For simplicity and directness, here we update top-level fields.
      batch.update(tournamentDocRef, { 
        overallWinnerName: tournamentWinnerName, 
        status: "Completed" 
      });
    } else if (allCurrentRoundMatchesConcluded && winnersFromCurrentRound.length !== 1) {
      details.push(`Final round ${currentRoundNumStr} of "${tournamentSettings.name}" is complete, but an unexpected number of winners (${winnersFromCurrentRound.length}) found. Expected 1.`);
    } else {
      details.push(`Final round ${currentRoundNumStr} of "${tournamentSettings.name}" is not yet fully concluded.`);
    }
    return; 
  }
  
  if (!allCurrentRoundMatchesConcluded) {
    details.push(`Round ${currentRoundNumStr} is not yet complete. Not advancing to round ${nextRoundNumStr}.`);
    return;
  }
  if (winnersFromCurrentRound.length === 0) {
      details.push(`Round ${currentRoundNumStr} is marked complete, but no winners found. Cannot advance.`);
      return;
  }
  
  details.push(`All matches in round ${currentRoundNumStr} are complete. Winners: ${winnersFromCurrentRound.join(", ")}. Proceeding to set up round ${nextRoundNumStr}.`);

  const nextRoundMatchesRef = db.collection(`tournaments/${activeTournamentId}/rounds/${nextRoundNumStr}/matches`);
  const nextRoundMatchesSnap = await nextRoundMatchesRef.orderBy(admin.firestore.FieldPath.documentId()).get();
  
  if (nextRoundMatchesSnap.empty && winnersFromCurrentRound.length > 0) {
    details.push(`Error: Placeholder matches for next round ${nextRoundNumStr} not found. Bracket might not have been initialized correctly.`);
    return;
  }

  const nextRoundMatchDocs = nextRoundMatchesSnap.docs;
  const expectedNextRoundMatches = winnersFromCurrentRound.length / 2;

  if (expectedNextRoundMatches !== nextRoundMatchDocs.length) {
      details.push(`Error: Mismatch in expected next round matches (${expectedNextRoundMatches}) and actual found (${nextRoundMatchDocs.length}). Cannot set up round ${nextRoundNumStr}.`);
      return;
  }

  const nextRoundEffectiveStartDate = addDays(tournamentSettings.startDate, (nextRoundNumInt - 1) * 7);
  details.push(`Next round (${nextRoundNumStr}) matches will be scheduled starting week of: ${formatDate(nextRoundEffectiveStartDate, "yyyy-MM-dd")}`);

  for (let i = 0; i < nextRoundMatchDocs.length; i++) {
    const matchToUpdateDoc = nextRoundMatchDocs[i];
    const team1Name = winnersFromCurrentRound[i * 2];
    const team2Name = winnersFromCurrentRound[i * 2 + 1];

    if (!team1Name || !team2Name) {
      details.push(`Error: Could not determine both team names for match ${matchToUpdateDoc.id} in round ${nextRoundNumStr}. Skipping.`);
      continue;
    }

    const existingNextRoundMatchDataFields = matchToUpdateDoc.data().fields;
    if (existingNextRoundMatchDataFields.team1?.stringValue !== team1Name || existingNextRoundMatchDataFields.team2?.stringValue !== team2Name || existingNextRoundMatchDataFields.team1?.stringValue === "TBD") {
        batch.update(matchToUpdateDoc.ref, { // Update match doc fields
            "fields.team1": { stringValue: team1Name }, 
            "fields.team2": { stringValue: team2Name },
            "fields.team1Wins": { integerValue: 0 }, 
            "fields.team2Wins": { integerValue: 0 },
            "fields.advanced": { nullValue: null }, 
        });
        details.push(`Updated R${nextRoundNumStr} M${matchToUpdateDoc.id} with teams: ${team1Name} vs ${team2Name}.`);
        await _createDailyResultPlaceholdersForMatch(activeTournamentId, nextRoundNumStr, matchToUpdateDoc.id, team1Name, team2Name, nextRoundEffectiveStartDate, batch, details);
    } else {
        details.push(`R${nextRoundNumStr} M${matchToUpdateDoc.id} already has correct teams. Ensuring daily placeholders with correct dates.`);
        await _createDailyResultPlaceholdersForMatch(activeTournamentId, nextRoundNumStr, matchToUpdateDoc.id, team1Name, team2Name, nextRoundEffectiveStartDate, batch, details);
    }
  }
  details.push(`Successfully set up matches and daily placeholders for round ${nextRoundNumStr}.`);
}


// Main Sync Logic (adapted from tournament-service.ts)
async function performTournamentSync(activeTournamentId: string): Promise<{ success: boolean, message: string, details?: string[] }> {
  const details: string[] = [];
  try {
    details.push(`[Cloud Function] Starting sync for tournament ID: ${activeTournamentId}`);

    const tournamentDocRef = db.doc(`tournaments/${activeTournamentId}`);
    const tournamentDocSnap = await tournamentDocRef.get();
    if (!tournamentDocSnap.exists) {
      details.push(`[Cloud Function] Error: Tournament with ID ${activeTournamentId} not found.`);
      return { success: false, message: `Tournament with ID ${activeTournamentId} not found.`, details };
    }
    const tournamentDataFromDb = tournamentDocSnap.data();
    if (!tournamentDataFromDb) {
        details.push(`[Cloud Function] Error: Tournament data for ID ${activeTournamentId} is empty.`);
        return { success: false, message: `Tournament data for ID ${activeTournamentId} is empty.`, details };
    }
    
    const tournamentSettings = {
        startDate: tournamentDataFromDb.startDate.toDate(), // Firestore Timestamps need .toDate()
        numberOfRounds: tournamentDataFromDb.numberOfRounds || 0,
        name: tournamentDataFromDb.name || "Unnamed Tournament",
        teamCount: tournamentDataFromDb.teamCount || 0,
    };
    details.push(`[Cloud Function] Tournament "${tournamentSettings.name}" (ID: ${activeTournamentId}) found. Rounds: ${tournamentSettings.numberOfRounds}.`);

    if (tournamentSettings.numberOfRounds === 0) {
        details.push("[Cloud Function] Tournament has 0 rounds. No sync needed.");
        return { success: true, message: "Sync complete. Tournament has 0 rounds.", details };
    }
    if (tournamentDataFromDb.status === "Completed") {
        details.push(`[Cloud Function] Tournament "${tournamentSettings.name}" is already Completed. No sync needed.`);
        return { success: true, message: `Tournament "${tournamentSettings.name}" is Completed. No sync performed.`, details };
    }


    const sheetRowsCollectionRef = db.collection("Sheet1Rows");
    const sheetRowsSnapshot = await sheetRowsCollectionRef.get(); // Get all rows
    
    const teamDailyScores = new Map<string, Map<string, number>>();
    sheetRowsSnapshot.forEach(docSnap => {
      const row = docSnap.data(); // Direct data access with Admin SDK
      if (row.LeadVender && row.Date && row.Status === "Submitted") {
        const teamName = row.LeadVender;
        const normalizedDate = normalizeDateString(row.Date);
        if (!normalizedDate) {
            details.push(`[Cloud Function] Skipping row ID ${docSnap.id} (Agent: ${row.Agent}, Date: ${row.Date}) due to unparseable date.`);
            return;
        }
        if (!teamDailyScores.has(teamName)) {
          teamDailyScores.set(teamName, new Map<string, number>());
        }
        const scoresForTeam = teamDailyScores.get(teamName)!;
        scoresForTeam.set(normalizedDate, (scoresForTeam.get(normalizedDate) || 0) + 1);
      }
    });
    details.push(`[Cloud Function] Aggregated scores from ${sheetRowsSnapshot.size} Sheet1Rows for ${teamDailyScores.size} teams.`);

    const batch = db.batch();
    let updatesMadeCount = 0;
    const roundsPotentiallyCompletedThisSync: Set<number> = new Set();

    for (let roundNumInt = 1; roundNumInt <= tournamentSettings.numberOfRounds; roundNumInt++) {
      const roundNumStr = String(roundNumInt);
      const matchesCollectionRef = db.collection(`tournaments/${activeTournamentId}/rounds/${roundNumStr}/matches`);
      const matchesSnapshot = await matchesCollectionRef.orderBy(admin.firestore.FieldPath.documentId()).get();

      if (matchesSnapshot.empty && roundNumInt === 1 && tournamentSettings.teamCount > 0) { /* ... */ }
      if (matchesSnapshot.empty && roundNumInt > 1) { /* ... */ continue; }

      const currentRoundEffectiveStartDate = addDays(tournamentSettings.startDate, (roundNumInt - 1) * 7);
      details.push(`[Cloud Function] Processing R${roundNumStr}. Effective start week: ${formatDate(currentRoundEffectiveStartDate, "yyyy-MM-dd")}`);

      for (const matchDoc of matchesSnapshot.docs) {
        const matchId = matchDoc.id;
        const matchData = matchDoc.data(); // Direct data
        const existingMatchFields = matchData.fields; // Assuming data was written with .fields wrapper by client/previous sync
        const originalAdvancedTeam = existingMatchFields?.advanced?.stringValue || null;

        const team1Name = existingMatchFields?.team1?.stringValue;
        const team2Name = existingMatchFields?.team2?.stringValue;

        if (!team1Name || team1Name === "TBD" || !team2Name || team2Name === "TBD") {
          details.push(`[Cloud Function] Skipping R${roundNumStr} M${matchId} as teams are TBD.`);
          continue;
        }
        
        let calculatedTeam1DailyWins = 0;
        let calculatedTeam2DailyWins = 0;
        let seriesWinnerForThisMatch: string | null = null;
        let workingDaysProcessed = 0;
        let calendarDayOffset = 0;

        while (workingDaysProcessed < 5) {
          const currentDateForDailyResult = addDays(currentRoundEffectiveStartDate, calendarDayOffset);
          const dayOfWeek = getDay(currentDateForDailyResult);

          if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            const dateString = formatDate(currentDateForDailyResult, "yyyy-MM-dd");
            const team1ScoreForDay = teamDailyScores.get(team1Name)?.get(dateString) || 0;
            const team2ScoreForDay = teamDailyScores.get(team2Name)?.get(dateString) || 0;
            let dailyWinnerTeamName: string | null = null;
            let dailyLoserTeamName: string | null = null;
            let dailyStatus = "Scheduled";

            if (!seriesWinnerForThisMatch) {
              if (team1ScoreForDay > team2ScoreForDay) { dailyWinnerTeamName = team1Name; dailyLoserTeamName = team2Name; calculatedTeam1DailyWins++; dailyStatus = "Completed"; }
              else if (team2ScoreForDay > team1ScoreForDay) { dailyWinnerTeamName = team2Name; dailyLoserTeamName = team1Name; calculatedTeam2DailyWins++; dailyStatus = "Completed"; }
              else {
                const today = new Date(); today.setHours(0,0,0,0);
                const currentMatchDateForComparison = parseISO(dateString); currentMatchDateForComparison.setHours(0,0,0,0);
                if (team1ScoreForDay === 0 && team2ScoreForDay === 0 && (isFuture(currentMatchDateForComparison) || isEqual(currentMatchDateForComparison,today)) ) dailyStatus = "Scheduled";
                else dailyStatus = "Completed - Tie";
              }
            } else {
              if (team1ScoreForDay > team2ScoreForDay) { dailyWinnerTeamName = team1Name; dailyLoserTeamName = team2Name; dailyStatus = "Completed"; }
              else if (team2ScoreForDay > team1ScoreForDay) { dailyWinnerTeamName = team2Name; dailyLoserTeamName = team1Name; dailyStatus = "Completed"; }
              else dailyStatus = "Completed - Tie";
            }
            
            const dailyResultDocRef = db.doc(`tournaments/${activeTournamentId}/rounds/${roundNumStr}/matches/${matchId}/dailyResults/${dateString}`);
            const dailyResultPayload = { // Maintain .fields structure for client mapping compatibility
              fields: {
                team1: { stringValue: team1Name }, team2: { stringValue: team2Name },
                team1Score: { integerValue: team1ScoreForDay }, team2Score: { integerValue: team2ScoreForDay },
                winner: dailyWinnerTeamName ? { stringValue: dailyWinnerTeamName } : { nullValue: null },
                loser: dailyLoserTeamName ? { stringValue: dailyLoserTeamName } : { nullValue: null },
                status: { stringValue: dailyStatus },
              }
            };
            batch.set(dailyResultDocRef, dailyResultPayload); // Use set to create or overwrite
            updatesMadeCount++;
            details.push(`[Cloud Function] DailyResult (R${roundNumStr}M${matchId} D:${dateString}): ${team1Name}(${team1ScoreForDay}) vs ${team2Name}(${team2ScoreForDay}). Winner: ${dailyWinnerTeamName || "None"}. Status: ${dailyStatus}.`);
            
            if (!seriesWinnerForThisMatch && (calculatedTeam1DailyWins >= 3 || calculatedTeam2DailyWins >= 3)) {
              seriesWinnerForThisMatch = calculatedTeam1DailyWins >= 3 ? team1Name : team2Name;
              details.push(`[Cloud Function] Series for R${roundNumStr}M${matchId} concluded on ${dateString}. Winner: ${seriesWinnerForThisMatch}`);
            }
            workingDaysProcessed++;
          }
          calendarDayOffset++;
          if (calendarDayOffset > 20 && workingDaysProcessed < 5) { details.push(`[CF] Warning: R${roundNumStr}M${matchId} working days safety break.`); break; }
        } 

        const parentMatchDocRef = db.doc(`tournaments/${activeTournamentId}/rounds/${roundNumStr}/matches/${matchId}`);
        const matchUpdatePayload: any = {
            "fields.team1Wins": { integerValue: calculatedTeam1DailyWins },
            "fields.team2Wins": { integerValue: calculatedTeam2DailyWins },
        };
        if (seriesWinnerForThisMatch) matchUpdatePayload["fields.advanced"] = { stringValue: seriesWinnerForThisMatch };
        else matchUpdatePayload["fields.advanced"] = { nullValue: null };
        
        batch.update(parentMatchDocRef, matchUpdatePayload);
        updatesMadeCount++;
        details.push(`[Cloud Function] ParentMatch (R${roundNumStr} M${matchId}): AggWins T1:${calculatedTeam1DailyWins}, T2:${calculatedTeam2DailyWins}, Series Winner: ${seriesWinnerForThisMatch || "None"}`);

        if ((seriesWinnerForThisMatch && seriesWinnerForThisMatch !== originalAdvancedTeam) || (!seriesWinnerForThisMatch && originalAdvancedTeam) || seriesWinnerForThisMatch) {
            roundsPotentiallyCompletedThisSync.add(roundNumInt);
        }
      } 
    } 

    const sortedRoundsToCheckForAdvancement = Array.from(roundsPotentiallyCompletedThisSync).sort((a, b) => a - b);
    for (const roundNumToAdvance of sortedRoundsToCheckForAdvancement) {
        details.push(`[Cloud Function] Checking round ${roundNumToAdvance} for advancement for tournament "${tournamentSettings.name}".`);
        await _checkAndAdvanceToNextRound(activeTournamentId, tournamentSettings, roundNumToAdvance, batch, details);
    }
    
    if (updatesMadeCount > 0) {
      await batch.commit();
      details.push(`[Cloud Function] Batch commit successful. ${updatesMadeCount} operations performed.`);
      return { success: true, message: `Sync complete via Cloud Function. ${updatesMadeCount} ops.`, details };
    } else {
      details.push(`[Cloud Function] No score updates or match outcome changes were necessary.`);
      return { success: true, message: `Sync complete via Cloud Function. No data changes needed.`, details };
    }

  } catch (error: any) {
    functions.logger.error(`[Cloud Function] Critical error in performTournamentSync for ${activeTournamentId}:`, error);
    details.push(`[Cloud Function] Critical error: ${error.message} \nStack: ${error.stack}`);
    return { success: false, message: `Failed to sync scores via Cloud Function: ${error.message}`, details };
  }
}


export const autoSyncTournamentOnSheetChange = functions.firestore
  .document("Sheet1Rows/{docId}")
  .onCreate(async (snap, context) => {
    const newSheetRow = snap.data();
    const docId = context.params.docId;

    functions.logger.info(`New Sheet1Row created (ID: ${docId}):`, newSheetRow);

    if (newSheetRow && newSheetRow.Status === "Submitted") {
      functions.logger.info(`Sheet1Row ${docId} has status "Submitted". Attempting to find active tournament for sync.`);
      
      let activeTournamentId: string | null = null;
      try {
        const tournamentsRef = db.collection("tournaments");
        // Find the latest tournament that is not "Completed"
        const q = tournamentsRef.where("status", "!=", "Completed").orderBy("status").orderBy("createdAt", "desc").limit(1);
        const querySnapshot = await q.get();

        if (!querySnapshot.empty) {
          activeTournamentId = querySnapshot.docs[0].id;
          const tournamentData = querySnapshot.docs[0].data();
          functions.logger.info(`Found active tournament: "${tournamentData.name}" (ID: ${activeTournamentId}) for sync.`);
        } else {
          // Fallback: try finding latest created if no "Ongoing" or "Scheduled" found by status
          const latestQ = tournamentsRef.orderBy("createdAt", "desc").limit(1);
          const latestSnapshot = await latestQ.get();
          if(!latestSnapshot.empty && latestSnapshot.docs[0].data().status !== "Completed") {
            activeTournamentId = latestSnapshot.docs[0].id;
            const tournamentData = latestSnapshot.docs[0].data();
            functions.logger.info(`Fallback: Found latest tournament: "${tournamentData.name}" (ID: ${activeTournamentId}) for sync.`);
          } else {
            functions.logger.warn("No active (non-completed) tournament found to sync with.");
            return null; // No active tournament to sync
          }
        }
        
        if (activeTournamentId) {
          const syncResult = await performTournamentSync(activeTournamentId);
          if (syncResult.success) {
            functions.logger.info(`Automatic sync for tournament ${activeTournamentId} triggered by Sheet1Row ${docId} completed successfully. Message: ${syncResult.message}. Details:`, syncResult.details?.join("; "));
          } else {
            functions.logger.error(`Automatic sync for tournament ${activeTournamentId} triggered by Sheet1Row ${docId} failed. Message: ${syncResult.message}. Details:`, syncResult.details?.join("; "));
          }
        }
        return null;

      } catch (error) {
        functions.logger.error(`Error during autoSyncTournamentOnSheetChange for Sheet1Row ${docId}:`, error);
        return null;
      }
    } else {
      functions.logger.info(`New Sheet1Row ${docId} does not have status "Submitted" (Status: ${newSheetRow?.Status}). No sync triggered.`);
      return null;
    }
  });

