
import type { TournamentData, CenterDashboardData, Matchup, Team, Round } from './types';
import { TrendingUp, TrendingDown, ShieldCheck, Target, Users } from 'lucide-react';

const createTeam = (id: string, name: string, score: number = 0): Team => ({
  id,
  name,
  score,
  logo: `https://placehold.co/40x40.png?text=${name.substring(0,1)}`
});

// Initial Teams for Round 1
const r1TeamA_initial = createTeam('alpha', 'Alpha Ops', 0);
const r1TeamB_initial = createTeam('bravo', 'Bravo Solutions', 0);
const r1TeamC_initial = createTeam('charlie', 'Charlie Squad', 0);
const r1TeamD_initial = createTeam('delta', 'Delta Force', 0);
const r1TeamE_initial = createTeam('echo', 'Echo Team', 0);
const r1TeamF_initial = createTeam('foxtrot', 'Foxtrot Group', 0);
const r1TeamG_initial = createTeam('golf', 'Golf Unit', 0);
const r1TeamH_initial = createTeam('hotel', 'Hotel Platoon', 0);

// Initial Matchups structure
const initialMatchupsStructure: Omit<Matchup, 'winner' | 'gamesPlayed' | 'team1' | 'team2'>[] = [
  { id: 'm1', round: 1, matchIndex: 0 },
  { id: 'm2', round: 1, matchIndex: 1 },
  { id: 'm3', round: 1, matchIndex: 2 },
  { id: 'm4', round: 1, matchIndex: 3 },
  { id: 'm5', round: 2, matchIndex: 0 },
  { id: 'm6', round: 2, matchIndex: 1 },
  { id: 'm7', round: 3, matchIndex: 0 },
];

export const initialTournamentRounds: Round[] = [
  {
    id: 'round1',
    name: 'Round 1: Quarter-Finals',
    matchups: [
      { ...initialMatchupsStructure[0], team1: r1TeamA_initial, team2: r1TeamB_initial, gamesPlayed: 0 },
      { ...initialMatchupsStructure[1], team1: r1TeamC_initial, team2: r1TeamD_initial, gamesPlayed: 0 },
      { ...initialMatchupsStructure[2], team1: r1TeamE_initial, team2: r1TeamF_initial, gamesPlayed: 0 },
      { ...initialMatchupsStructure[3], team1: r1TeamG_initial, team2: r1TeamH_initial, gamesPlayed: 0 },
    ],
  },
  {
    id: 'round2',
    name: 'Round 2: Semi-Finals',
    matchups: [
      { ...initialMatchupsStructure[4], team1: null, team2: null, gamesPlayed: 0 },
      { ...initialMatchupsStructure[5], team1: null, team2: null, gamesPlayed: 0 },
    ],
  },
  {
    id: 'round3',
    name: 'Round 3: Grand Finals',
    matchups: [
      { ...initialMatchupsStructure[6], team1: null, team2: null, gamesPlayed: 0 },
    ],
  },
];

export const tournamentPrize = 'Grand Prize: Company-Wide Recognition and a Team Celebration Budget!';

// The getUpdatedTournamentData logic will be moved to tournament-service.ts
// and adapted to work with data fetched from Firestore.

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
    trend: 'down', 
    icon: ShieldCheck,
    description: 'Lower is better. Target < 5%.',
  },
  flowThroughRate: {
    id: 'flowThrough',
    title: 'Flow-Through Rate',
    value: '85', 
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
    trend: 'up', 
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
