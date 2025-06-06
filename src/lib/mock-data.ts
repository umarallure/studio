
import type { CenterDashboardData, TopAgentMetric } from './types';
import { TrendingUp, TrendingDown, ShieldCheck, Target, Users, Award } from 'lucide-react';

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
  topAgentLastMonth: { ...defaultTopAgentMetric, agentName: "Agent T1" },
  entryStatusChartData: [ // Example Data
    { name: 'Submitted', value: 70, fill: 'var(--chart-1)' },
    { name: 'Approved', value: 20, fill: 'var(--chart-2)' },
    { name: 'Pending', value: 10, fill: 'var(--chart-3)' },
  ],
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
  topAgentLastMonth: { ...defaultTopAgentMetric, agentName: "Agent T2" },
  entryStatusChartData: [
    { name: 'Submitted', value: 60, fill: 'var(--chart-1)' },
    { name: 'Approved', value: 15, fill: 'var(--chart-2)' },
    { name: 'Rejected', value: 5, fill: 'var(--chart-4)' },
    { name: 'Pending', value: 20, fill: 'var(--chart-3)' },
  ],
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
  topAgentLastMonth: defaultTopAgentMetric,
  entryStatusChartData: [],
};
