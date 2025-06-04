
import type { TournamentData, CenterDashboardData, Matchup, Team } from './types';
import { DollarSign, TrendingDown, Zap, TrendingUp, Users, ShieldCheck, Target } from 'lucide-react';

const createTeam = (id: string, name: string, score: number = 0): Team => ({
  id,
  name,
  score,
  logo: `https://placehold.co/40x40.png?text=${name.substring(0,1)}`
});

// Round 1 Teams
const r1TeamA = createTeam('alpha', 'Alpha Ops');
const r1TeamB = createTeam('bravo', 'Bravo Solutions');
const r1TeamC = createTeam('charlie', 'Charlie Squad');
const r1TeamD = createTeam('delta', 'Delta Force');
const r1TeamE = createTeam('echo', 'Echo Team');
const r1TeamF = createTeam('foxtrot', 'Foxtrot Group');
const r1TeamG = createTeam('golf', 'Golf Unit');
const r1TeamH = createTeam('hotel', 'Hotel Platoon');

// Simulating some game progress
r1TeamA.score = 2;
r1TeamB.score = 1;

r1TeamC.score = 3; // Charlie wins against Delta
r1TeamD.score = 0;

r1TeamE.score = 1;
r1TeamF.score = 1;

// Golf advances by default (Hotel didn't show up - example)
r1TeamG.score = 3;
r1TeamH.score = 0;


// Initial Matchups
const initialMatchups: Matchup[] = [
  // Round 1
  { id: 'm1', team1: r1TeamA, team2: r1TeamB, gamesPlayed: 3, round: 1, matchIndex: 0 },
  { id: 'm2', team1: r1TeamC, team2: r1TeamD, winner: 'charlie', gamesPlayed: 3, round: 1, matchIndex: 1 },
  { id: 'm3', team1: r1TeamE, team2: r1TeamF, gamesPlayed: 2, round: 1, matchIndex: 2 },
  { id: 'm4', team1: r1TeamG, team2: r1TeamH, winner: 'golf', gamesPlayed: 3, round: 1, matchIndex: 3 },
  
  // Round 2 (Semi-Finals) - winners from round 1
  // Team1 of m5 is winner of m1, Team2 of m5 is winner of m2 (Charlie)
  // Team1 of m6 is winner of m3, Team2 of m6 is winner of m4 (Golf)
  { id: 'm5', team1: null, team2: r1TeamC, gamesPlayed: 0, round: 2, matchIndex: 0 }, // Winner of M1 vs Winner of M2 (Charlie)
  { id: 'm6', team1: null, team2: r1TeamG, gamesPlayed: 0, round: 2, matchIndex: 1 }, // Winner of M3 vs Winner of M4 (Golf)

  // Round 3 (Finals)
  { id: 'm7', team1: null, team2: null, gamesPlayed: 0, round: 3, matchIndex: 0 }, // Winner of M5 vs Winner of M6
];


export const mockTournamentData: TournamentData = {
  rounds: [
    {
      id: 'round1',
      name: 'Round 1: Quarter-Finals',
      matchups: initialMatchups.filter(m => m.round === 1),
    },
    {
      id: 'round2',
      name: 'Round 2: Semi-Finals',
      matchups: initialMatchups.filter(m => m.round === 2),
    },
    {
      id: 'round3',
      name: 'Round 3: Grand Finals',
      matchups: initialMatchups.filter(m => m.round === 3),
    },
  ],
  prize: 'Grand Prize: Company-Wide Recognition and a Team Celebration Budget!',
};

// Function to update matchups based on winners
export const getUpdatedTournamentData = (): TournamentData => {
  const rounds = JSON.parse(JSON.stringify(mockTournamentData.rounds)); // Deep copy

  // Logic for M1 winner (Alpha Ops if they win next game)
  // For now, let's assume if a team has 3 points they are the winner of the matchup
  const m1 = rounds[0].matchups.find((m: Matchup) => m.id === 'm1');
  if (m1 && m1.team1 && m1.team1.score === 3) m1.winner = m1.team1.id;
  if (m1 && m1.team2 && m1.team2.score === 3) m1.winner = m1.team2.id;
  
  const m3 = rounds[0].matchups.find((m: Matchup) => m.id === 'm3');
  if (m3 && m3.team1 && m3.team1.score === 3) m3.winner = m3.team1.id;
  if (m3 && m3.team2 && m3.team2.score === 3) m3.winner = m3.team2.id;

  // Populate Round 2 based on Round 1 winners
  const m5 = rounds[1].matchups.find((m: Matchup) => m.id === 'm5');
  if (m5) {
    const m1WinnerId = rounds[0].matchups.find((match: Matchup) => match.id === 'm1')?.winner;
    if (m1WinnerId) {
      const winnerTeam = [r1TeamA, r1TeamB].find(t => t.id === m1WinnerId);
      m5.team1 = winnerTeam ? { ...winnerTeam, score: 0 } : null; // Reset score for new round
    }
    // m5.team2 is already set as r1TeamC (winner of m2)
    if (m5.team2) m5.team2.score = 0; // Reset score
  }

  const m6 = rounds[1].matchups.find((m: Matchup) => m.id === 'm6');
  if (m6) {
    const m3WinnerId = rounds[0].matchups.find((match: Matchup) => match.id === 'm3')?.winner;
     if (m3WinnerId) {
      const winnerTeam = [r1TeamE, r1TeamF].find(t => t.id === m3WinnerId);
      m6.team1 = winnerTeam ? { ...winnerTeam, score: 0 } : null;
    }
    // m6.team2 is already set as r1TeamG (winner of m4)
    if (m6.team2) m6.team2.score = 0; // Reset score
  }
  
  // Simulate M5 winner for demo
  if (m5 && m5.team2 && !m5.team1) { // If team1 slot is empty (M1 not decided) but M2 winner (Charlie) exists
    m5.winner = m5.team2.id; // Charlie advances if M1 winner doesn't make it
    if(m5.team2) m5.team2.score = 3;
  } else if (m5 && m5.team1 && m5.team2 && Math.random() > 0.5) { // Randomly pick a winner for M5 if both teams exist
    m5.winner = Math.random() > 0.5 ? m5.team1.id : m5.team2.id;
    if (m5.winner === m5.team1.id && m5.team1) m5.team1.score = 3;
    if (m5.winner === m5.team2.id && m5.team2) m5.team2.score = 3;
  }


  // Populate Round 3 based on Round 2 winners
  const m7 = rounds[2].matchups.find((m: Matchup) => m.id === 'm7');
  if (m7) {
    const m5WinnerId = rounds[1].matchups.find((match: Matchup) => match.id === 'm5')?.winner;
    if (m5WinnerId) {
        const teamPoolR2M1 = [m5?.team1, m5?.team2].filter(Boolean) as Team[];
        const winnerTeam = teamPoolR2M1.find(t => t.id === m5WinnerId);
        m7.team1 = winnerTeam ? { ...winnerTeam, score: 0 } : null;
    }

    const m6WinnerId = rounds[1].matchups.find((match: Matchup) => match.id === 'm6')?.winner;
    if (m6WinnerId) {
        const teamPoolR2M2 = [m6?.team1, m6?.team2].filter(Boolean) as Team[];
        const winnerTeam = teamPoolR2M2.find(t => t.id === m6WinnerId);
        m7.team2 = winnerTeam ? { ...winnerTeam, score: 0 } : null;
    }
  }
  
  return { ...mockTournamentData, rounds };
};


export const mockCenterData1: CenterDashboardData = {
  centerName: 'Alpha Ops HQ',
  dailySales: {
    id: 'sales',
    title: 'Daily Submissions',
    value: 102,
    previousValue: 95,
    unit: 'units',
    trend: 'up',
    icon: TrendingUp,
    description: 'Total submissions today.',
  },
  chargebackPercentage: {
    id: 'chargeback',
    title: 'Chargeback % (Prev. Month)',
    value: '3.5',
    previousValue: '4.1',
    unit: '%',
    trend: 'down', // Lower is better
    icon: ShieldCheck,
    description: 'Lower is better. Target < 5%.',
  },
  flowThroughRate: {
    id: 'flowThrough',
    title: 'Flow-Through Rate',
    value: '85', // (e.g. 85 approved / 100 total)
    previousValue: '82',
    unit: '%',
    trend: 'up',
    icon: Target,
    description: 'Approved submissions / Total submissions. Higher is better.',
  },
};

export const mockCenterData2: CenterDashboardData = {
  centerName: 'Bravo Solutions Hub',
  dailySales: {
    id: 'sales',
    title: 'Daily Submissions',
    value: 78,
    previousValue: 85,
    unit: 'units',
    trend: 'down',
    icon: TrendingDown,
    description: 'Total submissions today.',
  },
  chargebackPercentage: {
    id: 'chargeback',
    title: 'Chargeback % (Prev. Month)',
    value: '6.2',
    previousValue: '5.8',
    unit: '%',
    trend: 'up', // Higher is worse
    icon: ShieldCheck,
    description: 'Lower is better. Target < 5%.',
  },
  flowThroughRate: {
    id: 'flowThrough',
    title: 'Flow-Through Rate',
    value: '70',
    previousValue: '75',
    unit: '%',
    trend: 'down',
    icon: Target,
    description: 'Approved submissions / Total submissions. Higher is better.',
  },
};

export const defaultCenterData: CenterDashboardData = {
  centerName: 'Your Center Dashboard',
   dailySales: {
    id: 'sales',
    title: 'Daily Submissions',
    value: 0,
    previousValue: 0,
    unit: 'units',
    trend: 'neutral',
    icon: Users,
    description: 'Total submissions today.',
  },
  chargebackPercentage: {
    id: 'chargeback',
    title: 'Chargeback % (Prev. Month)',
    value: '0',
    previousValue: '0',
    unit: '%',
    trend: 'neutral',
    icon: ShieldCheck,
    description: 'Lower is better. Target < 5%.',
  },
  flowThroughRate: {
    id: 'flowThrough',
    title: 'Flow-Through Rate',
    value: '0',
    previousValue: '0',
    unit: '%',
    trend: 'neutral',
    icon: Target,
    description: 'Approved submissions / Total submissions. Higher is better.',
  },
}
