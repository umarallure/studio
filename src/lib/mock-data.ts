
import type { CenterDashboardData, TopAgentMetric } from './types';
import { TrendingUp, TrendingDown, Users, ClipboardList, Award } from 'lucide-react'; // Replaced ShieldCheck with Users, Target with ClipboardList

export const tournamentPrize = 'Grand Prize: Company-Wide Recognition and a Team Celebration Budget!';

const defaultTopAgentMetric: TopAgentMetric = {
  id: 'topAgent',
  title: 'Top Agent (Last Month)',
  agentName: 'Loading...',
  submissionCount: 0,
  icon: Award,
  description: 'Based on submitted entries last month.',
};

export const mockCenterData1: CenterDashboardData = {
  centerName: 'Team 1 View',
  dailySales: {
    id: 'sales',
    title: 'Daily Submissions',
    value: 102,
    previousValue: 95,
    unit: 'units',
    trend: 'up',
    icon: TrendingUp,
    description: 'Total submissions today for Team 1.',
  },
  chargebackPercentage: { // This is a mock, less critical now
    id: 'chargeback',
    title: 'Placeholder Metric 1',
    value: 'N/A',
    unit: '',
    trend: 'neutral',
    icon: Users, // Changed icon
    description: 'Example placeholder metric.',
  },
  totalSubmittedLast30Days: {
    id: 'totalSubmitted30d',
    title: 'Total Submitted (Last 30 Days)',
    value: 0, // Will be dynamically calculated
    unit: '',
    trend: 'neutral',
    icon: ClipboardList,
    description: 'Total "Submitted" entries in the last 30 days for Team 1.',
  },
  topAgentLastMonth: { ...defaultTopAgentMetric, agentName: "Agent T1" },
};

export const mockCenterData2: CenterDashboardData = {
  centerName: 'Team 2 View',
  dailySales: {
    id: 'sales',
    title: 'Daily Submissions',
    value: 78,
    previousValue: 85,
    unit: 'units',
    trend: 'down',
    icon: TrendingDown,
    description: 'Total submissions today for Team 2.',
  },
  chargebackPercentage: { // Mock
    id: 'chargeback',
    title: 'Placeholder Metric 1',
    value: 'N/A',
    unit: '',
    trend: 'neutral',
    icon: Users,
    description: 'Example placeholder metric.',
  },
  totalSubmittedLast30Days: {
    id: 'totalSubmitted30d',
    title: 'Total Submitted (Last 30 Days)',
    value: 0, // Will be dynamically calculated
    unit: '',
    trend: 'neutral',
    icon: ClipboardList,
    description: 'Total "Submitted" entries in the last 30 days for Team 2.',
  },
  topAgentLastMonth: { ...defaultTopAgentMetric, agentName: "Agent T2" },
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
    icon: Users, // Consistent icon
    description: 'Total submissions today.',
  },
  chargebackPercentage: { // Mock
    id: 'chargeback',
    title: 'Placeholder Metric 1',
    value: '0',
    unit: '',
    trend: 'neutral',
    icon: Users,
    description: 'Example placeholder metric.',
  },
  totalSubmittedLast30Days: {
    id: 'totalSubmitted30d',
    title: 'Total Submitted (Last 30 Days)',
    value: 0,
    unit: '',
    trend: 'neutral',
    icon: ClipboardList,
    description: 'Total "Submitted" entries in the last 30 days.',
  },
  topAgentLastMonth: defaultTopAgentMetric,
};
