
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { onDocumentCreated, FirestoreEvent } from "firebase-functions/v2/firestore";
import type { QueryDocumentSnapshot, DocumentData } from "firebase-admin/firestore";
import { format as formatDate, addDays, parseISO, isFuture, isEqual, getDay } from "date-fns";

admin.initializeApp();
const db = admin.firestore();

// --- Copied Type Definition ---
// From src/lib/types.ts for SheetRow
interface SheetRow {
  id: string; // Firestore document ID
  Agent?: string;
  Date?: string; // Expected as YYYY-MM-DD or similar after normalization
  FromCallback?: boolean;
  INSURED_NAME?: string;
  LeadVender?: string;
  Notes?: string;
  ProductType?: string;
  Status?: string;
}
// --- End Copied Type Definition ---

// --- Copied Helper Function ---
// From src/lib/tournament-config.ts for mapDocToSheetRow
// Helper to map Firestore document data (from Sheet1Rows) to our SheetRow type
// This handles the structure written by the Google Apps Script (REST API format) or SDK
function mapDocToSheetRow(docId: string, data: DocumentData | undefined): SheetRow | null {
  // Check for REST API structure (data under 'fields')
  if (data && data.fields && typeof data.fields === 'object') {
    const fields = data.fields;
    return {
      id: docId,
      Agent: fields.Agent?.stringValue,
      Date: fields.Date?.stringValue,
      FromCallback: fields['From Callback?']?.booleanValue, // Handles space in field name
      INSURED_NAME: fields['INSURED NAME']?.stringValue, // Handles space
      LeadVender: fields['Lead Vender']?.stringValue,   // Handles space
      Notes: fields.Notes?.stringValue,
      ProductType: fields['Product Type']?.stringValue, // Handles space
      Status: fields.Status?.stringValue,
    };
  }
  // Fallback for direct SDK-like data structure (no 'fields' wrapper)
  else if (data && typeof data === 'object' && !data.fields) {
    // Check for a known property to ensure it's likely a SheetRow-like object
    // This handles cases where field names might have spaces directly at the root
    const agent = data.Agent || data.agent; // Example of trying common casings
    const leadVender = data['Lead Vender'] || data.LeadVender || data.leadVender;
    const status = data.Status || data.status;
    const dateVal = data.Date || data.date;

    // Only proceed if essential fields might exist (even if some are undefined)
    // This check is a bit loose but aims to catch SDK-written data without 'fields'.
    if (agent !== undefined || leadVender !== undefined || status !== undefined || dateVal !== undefined) {
        return {
            id: docId,
            Agent: data.Agent,
            Date: data.Date,
            FromCallback: data['From Callback?'],
            INSURED_NAME: data['INSURED NAME'],
            LeadVender: data['Lead Vender'],
            Notes: data.Notes,
            ProductType: data['Product Type'],
            Status: data.Status,
        };
    }
  }
  functions.logger.warn(`[mapDocToSheetRow] Could not map document ${docId}. Data structure not recognized:`, JSON.stringify(data));
  return null; // If data is undefined or not in a known format
}
// --- End Copied Helper Function ---


// Helper: Normalize Date String (already present and seems okay)
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

// Helper: Create Daily Result Placeholders
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

// Helper: Check and Advance to Next Round
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
        batch.update(matchToUpdateDoc.ref, { 
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
        startDate: tournamentDataFromDb.startDate.toDate(), 
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

    // MODIFIED SECTION: Fetch and map Sheet1Rows robustly
    const sheetRowsCollectionRef = db.collection("Sheet1Rows");
    const sheetRowsSnapshot = await sheetRowsCollectionRef.get(); // Firestore Admin SDK returns QuerySnapshot
    
    const mappedSheetRows: SheetRow[] = []; 
    sheetRowsSnapshot.forEach(docSnap => {
      const row = mapDocToSheetRow(docSnap.id, docSnap.data()); // Use the copied mapDocToSheetRow
      if (row) {
        mappedSheetRows.push(row);
      } else {
        // mapDocToSheetRow logs its own warning if mapping fails for a specific doc
      }
    });
    details.push(`[Cloud Function] Fetched and mapped ${mappedSheetRows.length} rows from Sheet1Rows.`);

    const teamDailyScores = new Map<string, Map<string, number>>();
    mappedSheetRows.forEach(row => { // Iterate over the MAPPED rows
      if (row.LeadVender && row.Date && row.Status === "Submitted") {
        const teamName = row.LeadVender;
        const normalizedDate = normalizeDateString(row.Date);
        if (!normalizedDate) {
            details.push(`[Cloud Function] Skipping mapped row ID ${row.id} (Agent: ${row.Agent || 'N/A'}, Original Date: ${row.Date || 'N/A'}) due to unparseable date.`);
            return; 
        }
        if (!teamDailyScores.has(teamName)) {
          teamDailyScores.set(teamName, new Map<string, number>());
        }
        const scoresForTeam = teamDailyScores.get(teamName)!;
        scoresForTeam.set(normalizedDate, (scoresForTeam.get(normalizedDate) || 0) + 1);
      }
    });
    details.push(`[Cloud Function] Aggregated scores from "Submitted" entries for ${teamDailyScores.size} teams.`);
    if (teamDailyScores.size === 0 && mappedSheetRows.filter(r => r.Status === "Submitted").length > 0) {
        details.push(`[Cloud Function] WARNING: There were submitted entries, but teamDailyScores map is empty. This indicates a potential issue in LeadVender mapping or date normalization for submitted entries.`);
    } else if (teamDailyScores.size === 0) {
        details.push(`[Cloud Function] No "Submitted" entries found to aggregate scores from.`);
    }
    // END MODIFIED SECTION

    const batch = db.batch();
    let updatesMadeCount = 0;
    const roundsPotentiallyCompletedThisSync: Set<number> = new Set();

    for (let roundNumInt = 1; roundNumInt <= tournamentSettings.numberOfRounds; roundNumInt++) {
      const roundNumStr = String(roundNumInt);
      const matchesCollectionRef = db.collection(`tournaments/${activeTournamentId}/rounds/${roundNumStr}/matches`);
      const matchesSnapshot = await matchesCollectionRef.orderBy(admin.firestore.FieldPath.documentId()).get();

      if (matchesSnapshot.empty && roundNumInt === 1 && tournamentSettings.teamCount > 0) { 
        details.push(`[Cloud Function] Warning: No matches found for Round 1 of "${tournamentSettings.name}". Initialization might be incomplete or teams not yet assigned.`);
        continue;
       }
      if (matchesSnapshot.empty && roundNumInt > 1) { 
        details.push(`[Cloud Function] No matches found for Round ${roundNumStr} of "${tournamentSettings.name}". This round may not be set up yet.`);
        continue; 
      }

      const currentRoundEffectiveStartDate = addDays(tournamentSettings.startDate, (roundNumInt - 1) * 7);
      details.push(`[Cloud Function] Processing R${roundNumStr}. Effective start week: ${formatDate(currentRoundEffectiveStartDate, "yyyy-MM-dd")}`);

      for (const matchDoc of matchesSnapshot.docs) {
        const matchId = matchDoc.id;
        const matchData = matchDoc.data(); 
        const existingMatchFields = matchData.fields; 
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
            const dailyResultPayloadFields = { 
                team1: { stringValue: team1Name }, team2: { stringValue: team2Name },
                team1Score: { integerValue: team1ScoreForDay }, team2Score: { integerValue: team2ScoreForDay },
                winner: dailyWinnerTeamName ? { stringValue: dailyWinnerTeamName } : { nullValue: null },
                loser: dailyLoserTeamName ? { stringValue: dailyLoserTeamName } : { nullValue: null },
                status: { stringValue: dailyStatus },
            };
            const dailyDocSnap = await dailyResultDocRef.get();
            if (!dailyDocSnap.exists) {
                batch.set(dailyResultDocRef, { fields: dailyResultPayloadFields });
            } else {
                batch.update(dailyResultDocRef, { fields: dailyResultPayloadFields });
            }
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


export const autoSyncTournamentOnSheetChange = onDocumentCreated(
  "/Sheet1Rows/{docId}", 
  async (event: FirestoreEvent<QueryDocumentSnapshot | undefined, { docId: string }>) => {
    
    const eventDocId = event.params.docId; // Renamed to avoid conflict with local docId variables
    const newSheetRowSnapshot = event.data;

    if (!newSheetRowSnapshot || !newSheetRowSnapshot.exists) {
        functions.logger.info(`New Sheet1Row created (ID: ${eventDocId}), but snapshot data is missing. No sync triggered.`);
        return null;
    }
    
    const newSheetRowData = newSheetRowSnapshot.data();
    functions.logger.info(`New Sheet1Row created (ID: ${eventDocId}):`, newSheetRowData);
    
    let statusValue: string | undefined;
    // Handle potential 'fields' wrapper for status check
    if (newSheetRowData && newSheetRowData.fields && typeof newSheetRowData.fields === 'object') {
        statusValue = (newSheetRowData.fields as DocumentData).Status?.stringValue;
    } else if (newSheetRowData && newSheetRowData.Status) { // Direct field access
        statusValue = newSheetRowData.Status;
    } else if (newSheetRowData && newSheetRowData.status) { // common lowercase alternative
        statusValue = newSheetRowData.status;
    }


    if (statusValue === "Submitted") {
      functions.logger.info(`Sheet1Row ${eventDocId} has status "Submitted". Attempting to find active tournament for sync.`);
      
      let activeTournamentId: string | null = null;
      try {
        const tournamentsRef = db.collection("tournaments");
        const q = tournamentsRef.where("status", "!=", "Completed").orderBy("status").orderBy("createdAt", "desc").limit(1);
        const querySnapshot = await q.get();

        if (!querySnapshot.empty) {
          activeTournamentId = querySnapshot.docs[0].id;
          const tournamentData = querySnapshot.docs[0].data();
          functions.logger.info(`Found active tournament: "${tournamentData.name}" (ID: ${activeTournamentId}) for sync.`);
        } else {
          const latestQ = tournamentsRef.orderBy("createdAt", "desc").limit(1);
          const latestSnapshot = await latestQ.get();
          if(!latestSnapshot.empty && latestSnapshot.docs[0].data().status !== "Completed") {
            activeTournamentId = latestSnapshot.docs[0].id;
            const tournamentData = latestSnapshot.docs[0].data();
            functions.logger.info(`Fallback: Found latest tournament: "${tournamentData.name}" (ID: ${activeTournamentId}) for sync.`);
          } else {
            functions.logger.warn("No active (non-completed) tournament found to sync with.");
            return null; 
          }
        }
        
        if (activeTournamentId) {
          const syncResult = await performTournamentSync(activeTournamentId);
          if (syncResult.success) {
            functions.logger.info(`Automatic sync for tournament ${activeTournamentId} triggered by Sheet1Row ${eventDocId} completed successfully. Message: ${syncResult.message}. Details:`, syncResult.details?.join("; "));
          } else {
            functions.logger.error(`Automatic sync for tournament ${activeTournamentId} triggered by Sheet1Row ${eventDocId} failed. Message: ${syncResult.message}. Details:`, syncResult.details?.join("; "));
          }
        }
        return null;

      } catch (error: any) {
        functions.logger.error(`Error during autoSyncTournamentOnSheetChange for Sheet1Row ${eventDocId}:`, error.message, error.stack);
        return null;
      }
    } else {
      functions.logger.info(`New Sheet1Row ${eventDocId} does not have status "Submitted" (Status: ${statusValue || 'Not Found'}). No sync triggered.`);
      return null;
    }
  });


    