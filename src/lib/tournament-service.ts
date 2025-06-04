
'use server'; 

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, DocumentData, updateDoc } from 'firebase/firestore';
import type { TournamentData, Round, Team } from '@/lib/types';
import { initialTournamentRounds, tournamentPrize } from '@/lib/mock-data';

export const TOURNAMENT_DOC_PATH = 'tournaments/mainTournament';

// Helper to ensure data from Firestore matches TournamentData type
export function mapDocToTournamentData(docData: DocumentData | undefined): TournamentData | null {
  if (!docData) return null;
  return {
    rounds: docData.rounds as Round[],
    prize: docData.prize as string,
  };
}


export async function initializeTournamentDataIfNeeded(): Promise<void> {
  const tournamentDocRef = doc(db, TOURNAMENT_DOC_PATH);
  try {
    const docSnap = await getDoc(tournamentDocRef);
    if (!docSnap.exists()) {
      const initialData: TournamentData = {
        rounds: initialTournamentRounds,
        prize: tournamentPrize,
      };
      await setDoc(tournamentDocRef, initialData);
      console.log("Initial tournament data seeded in Firestore.");
    }
  } catch (error) {
    console.error("Error initializing tournament data:", error);
  }
}

// This function replicates and adapts the logic from the old mock-data's getUpdatedTournamentData
// It should operate on a TournamentData object and return the updated version.
function calculateUpdatedTournament(currentData: TournamentData): TournamentData {
  const updatedData = JSON.parse(JSON.stringify(currentData)) as TournamentData; // Deep copy

  const findTeamById = (teamId: string): Team | undefined => {
    for (const round of updatedData.rounds) {
      for (const matchup of round.matchups) {
        if (matchup.team1?.id === teamId) return matchup.team1;
        if (matchup.team2?.id === teamId) return matchup.team2;
      }
    }
    const allInitialTeams: Team[] = [];
    initialTournamentRounds.forEach(r => r.matchups.forEach(m => {
        if(m.team1) allInitialTeams.push(m.team1);
        if(m.team2) allInitialTeams.push(m.team2);
    }));
    return allInitialTeams.find(t => t.id === teamId);
  };

  updatedData.rounds[0].matchups.forEach(match => {
    if (!match.winner) { 
      if (match.team1 && match.team1.score === 3) match.winner = match.team1.id;
      else if (match.team2 && match.team2.score === 3) match.winner = match.team2.id;
      
      if (!match.winner && match.team1 && match.team2 && match.gamesPlayed < 3) {
        if (Math.random() < 0.3) { 
            if (Math.random() < 0.5 && match.team1.score < 3) {
                match.team1.score++;
            } else if (match.team2.score < 3) {
                match.team2.score++;
            }
            match.gamesPlayed++;
            if (match.team1.score === 3) match.winner = match.team1.id;
            else if (match.team2.score === 3) match.winner = match.team2.id;
        }
      }
    }
  });

  const m1 = updatedData.rounds[0].matchups.find(m => m.id === 'm1');
  const m2 = updatedData.rounds[0].matchups.find(m => m.id === 'm2');
  const m3 = updatedData.rounds[0].matchups.find(m => m.id === 'm3');
  const m4 = updatedData.rounds[0].matchups.find(m => m.id === 'm4');

  const m5 = updatedData.rounds[1].matchups.find(m => m.id === 'm5');
  if (m5) {
    if (m1?.winner && !m5.team1) {
      const winnerTeam = findTeamById(m1.winner);
      m5.team1 = winnerTeam ? { ...winnerTeam, score: 0 } : null;
    }
    if (m2?.winner && !m5.team2) {
      const winnerTeam = findTeamById(m2.winner);
      m5.team2 = winnerTeam ? { ...winnerTeam, score: 0 } : null;
    }
     if (!m5.winner && m5.team1 && m5.team2 && m5.gamesPlayed < 3) { 
        if (Math.random() < 0.4) { 
            if (Math.random() < 0.5 && m5.team1.score < 3) {
                m5.team1.score++;
            } else if (m5.team2.score < 3) {
                m5.team2.score++;
            }
            m5.gamesPlayed++;
            if (m5.team1.score === 3) m5.winner = m5.team1.id;
            else if (m5.team2.score === 3) m5.winner = m5.team2.id;
        }
    }
  }

  const m6 = updatedData.rounds[1].matchups.find(m => m.id === 'm6');
  if (m6) {
    if (m3?.winner && !m6.team1) {
      const winnerTeam = findTeamById(m3.winner);
      m6.team1 = winnerTeam ? { ...winnerTeam, score: 0 } : null;
    }
    if (m4?.winner && !m6.team2) {
      const winnerTeam = findTeamById(m4.winner);
      m6.team2 = winnerTeam ? { ...winnerTeam, score: 0 } : null;
    }
    if (!m6.winner && m6.team1 && m6.team2 && m6.gamesPlayed < 3) { 
         if (Math.random() < 0.4) { 
            if (Math.random() < 0.5 && m6.team1.score < 3) {
                m6.team1.score++;
            } else if (m6.team2.score < 3) {
                m6.team2.score++;
            }
            m6.gamesPlayed++;
            if (m6.team1.score === 3) m6.winner = m6.team1.id;
            else if (m6.team2.score === 3) m6.winner = m6.team2.id;
        }
    }
  }
  
  const m7 = updatedData.rounds[2].matchups.find(m => m.id === 'm7');
  if (m7) {
    if (m5?.winner && !m7.team1) {
      const winnerTeam = findTeamById(m5.winner);
      m7.team1 = winnerTeam ? { ...winnerTeam, score: 0 } : null;
    }
    if (m6?.winner && !m7.team2) {
      const winnerTeam = findTeamById(m6.winner);
      m7.team2 = winnerTeam ? { ...winnerTeam, score: 0 } : null;
    }
    if (!m7.winner && m7.team1 && m7.team2 && m7.gamesPlayed < 3) { 
        if (Math.random() < 0.5) {
            if (Math.random() < 0.5 && m7.team1.score < 3) {
                m7.team1.score++;
            } else if (m7.team2.score < 3) {
                m7.team2.score++;
            }
            m7.gamesPlayed++;
            if (m7.team1.score === 3) m7.winner = m7.team1.id;
            else if (m7.team2.score === 3) m7.winner = m7.team2.id;
        }
    }
  }

  return updatedData;
}


export async function refreshAndSaveTournamentData(): Promise<void> {
  const tournamentDocRef = doc(db, TOURNAMENT_DOC_PATH);
  try {
    const docSnap = await getDoc(tournamentDocRef);
    if (docSnap.exists()) {
      const currentData = mapDocToTournamentData(docSnap.data());
      if (currentData) {
        const updatedData = calculateUpdatedTournament(currentData);
        await updateDoc(tournamentDocRef, updatedData); 
        console.log("Tournament data refreshed and saved to Firestore.");
      } else {
        console.error("Failed to map current tournament data.");
      }
    } else {
      console.warn("Tournament document not found for refresh, attempting to initialize.");
      await initializeTournamentDataIfNeeded();
    }
  } catch (error) {
    console.error("Error refreshing and saving tournament data:", error);
  }
}
