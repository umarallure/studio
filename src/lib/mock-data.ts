
// types import is adjusted, but most mock data here for bracket is now obsolete
// as data comes from Firestore via Apps Script.
import type { CenterDashboardData } from './types'; 
import { TrendingUp, TrendingDown, ShieldCheck, Target, Users } from 'lucide-react';

// The initialTournamentRounds, createTeam, and initialMatchupsStructure are no longer
// directly used by the bracket display as data is fetched from Firestore.
// They are kept here for reference or if needed for other parts of the app,
// but their structure does not match the new Firestore-driven bracket.

export const tournamentPrize = 'Grand Prize: Company-Wide Recognition and a Team Celebration Budget!';

// Center Dashboard Mock Data can remain as is, as it's separate from the bracket logic.
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
