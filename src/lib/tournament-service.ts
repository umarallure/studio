
'use server'; 

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import type { TournamentData, TournamentSettings } from '@/lib/types'; // Using updated types
// Removed initialTournamentRounds, tournamentPrize imports from mock-data as structure differs
// Importing config details that are safe for server-side
import { BRACKET_COLLECTION_PATH, mapDocToTournamentData } from '@/lib/tournament-config'; 

// This function's original purpose was to seed data based on mock-data.
// The Apps Script now controls data population based on Google Sheets.
// This function might be deprecated or adapted if specific initialization from Next.js is needed.
export async function initializeTournamentDataIfNeeded(): Promise<void> {
  console.log("initializeTournamentDataIfNeeded called. Note: Apps Script is primary data source for bracket structure.");
  // Example: Check if a basic 'bracket' document or a specific round structure exists.
  // For now, this function will be minimal as Apps Script drives creation.
  const round1DocRef = doc(db, BRACKET_COLLECTION_PATH, "1"); // Check for existence of round 1 path segment
  try {
    const docSnap = await getDoc(round1DocRef);
    if (!docSnap.exists()) {
      // The Apps Script creates '/bracket/{roundNum}/matches/{matchId}'.
      // We might not need to seed anything here if Apps Script handles it.
      // If we wanted to create a placeholder 'prize' doc for example:
      // const prizeDocRef = doc(db, "tournamentGlobals", "main");
      // await setDoc(prizeDocRef, { prize: "Official Tournament Prize!" });
      console.log("Initial tournament metadata (if any) could be seeded here.");
    }
  } catch (error) {
    console.error("Error during minimal initialization check:", error);
  }
}


// The 'refreshAndSaveTournamentData' function with score simulation logic
// is no longer applicable as scores are updated by the Apps Script via Google Sheets.
// This function will be a no-op or removed.
export async function refreshAndSaveTournamentData(): Promise<void> {
  console.log("refreshAndSaveTournamentData called, but data updates are driven by Apps Script.");
  // No operation needed here as onSnapshot in BracketPage handles real-time updates.
  // If this function were to trigger a re-sync or check with Apps Script,
  // it would require a different mechanism (e.g., calling an Apps Script web app).
  return Promise.resolve();
}

// The calculateUpdatedTournament function is removed as it's based on the old data model
// and conflicts with Apps Script's data management.

export async function createTournament(settings: TournamentSettings): Promise<{success: boolean, id?: string, error?: string}> {
  try {
    const tournamentDataToSave = {
      name: settings.name,
      teamCount: settings.teamCount,
      numberOfRounds: settings.numberOfRounds,
      startDate: Timestamp.fromDate(settings.startDate), // Convert JS Date to Firestore Timestamp
      createdAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, "tournaments"), tournamentDataToSave);
    console.log("Tournament created with ID: ", docRef.id, " Data: ", tournamentDataToSave);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error creating tournament: ", error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unknown error occurred." };
  }
}

