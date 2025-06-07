
import type { DateRange } from "react-day-picker";

// Represents a team as understood from Firestore structure primarily by name
export interface Team {
  name: string; // Team name is the primary identifier from Apps Script
  logo?: string; // URL to team logo placeholder
  dailyWinsInMatchup?: number; // How many daily wins this team has in the current matchup
}

// Represents a matchup as stored in Firestore under tournaments/{tournamentId}/rounds/{roundNum}/matches/{matchId}
export interface Matchup {
  id: string; // e.g., "match1"
  roundId: string; // e.g., "1", "2"
  team1Name: string | null; // Name of team 1, or "TBD"
  team2Name: string | null; // Name of team 2, or "TBD"
  team1DailyWins: number;   // From Firestore fields.team1Wins.integerValue
  team2DailyWins: number;   // From Firestore fields.team2Wins.integerValue
  seriesWinnerName: string | null; // From Firestore fields.advanced.stringValue
}

// Represents a round in the tournament
export interface Round {
  id: string; // e.g., "1", "2", "3" (corresponds to roundNum in Firestore path)
  name: string; // e.g., "Round 1: Quarter-Finals"
  matchups: Matchup[];
}

// Overall tournament data structure
export interface TournamentData {
  id: string; // Firestore document ID of the tournament
  name: string;
  teamCount: 4 | 8 | 16;
  numberOfRounds: number;
  startDate: Date; // Keep as Date object for UI, convert to Timestamp for Firestore
  rounds: Round[]; // The actual bracket rounds and matches
  prize: string; // Can remain static or be fetched if stored separately
  overallWinnerName?: string; // For displaying the final winner
  status?: string; // e.g., "Scheduled", "Ongoing", "Completed"
}


// Types for Center Dashboard
export interface CenterMetric {
  id: string;
  title: string;
  value: string | number; // This will be updated dynamically for daily submissions
  previousValue?: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ElementType;
  description?: string;
}

export interface TopAgentMetric {
  id: string;
  title: string;
  agentName: string | null;
  submissionCount: number;
  icon?: React.ElementType;
  description?: string; // e.g. "Submissions last month"
}

export interface ChartSegment {
  name: string; // e.g., Status name or ProductType name
  value: number; // Count for this segment
  fill: string; // CSS variable for color e.g., 'var(--chart-1)'
}

export interface CenterDashboardData {
  centerName: string;
  dailySales: CenterMetric; // This will now reflect the last day of the selected range
  chargebackPercentage: CenterMetric; // Stays as "Prev. Month"
  flowThroughRate: CenterMetric; // This might need re-evaluation or stay as an overall metric
  topAgentLastMonth?: TopAgentMetric; // Stays as "Last Month"
  // entryStatusChartData?: ChartSegment[]; // This was for a pie chart, removed
}

// New type for data from Sheet1Rows collection
export interface SheetRow {
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

// Type for creating/fetching a tournament's settings
export interface TournamentSettings {
  id?: string; // Firestore document ID, optional for creation
  name: string;
  teamCount: 4 | 8 | 16;
  startDate: Date; // Keep as Date for form, convert to/from Timestamp for Firestore
  numberOfRounds: number;
  createdAt?: Date; // Firestore Timestamp, converted to Date
  overallWinnerName?: string;
  status?: string; // e.g., "Scheduled", "Ongoing", "Completed"
}

// Export DateRange for use in components
export type { DateRange };

// Genkit flow input/output types
// --- Existing ---
export type DailySubmissionsInput = {
  targetDate: string; // YYYY-MM-DD
  leadVenderFilter?: string | null;
};
export type DailySubmissionsOutput = {
  submissionCount: number;
  processedDate: string;
  filterApplied: string | null | undefined;
};

export type TopAgentLastMonthInput = {
  leadVenderFilter: string | null;
};
export type TopAgentLastMonthOutput = {
  agentName: string | null;
  submissionCount: number;
};

export type EntryStatsByStatusForChartInput = {
  leadVenderFilter: string | null;
  daysToCover: number;
};
export type EntryStatsByStatusForChartOutput = ChartSegment[];

// --- New Genkit Flow Types ---
export interface DateRangeFilterInput {
  leadVenderFilter: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface TotalPointsInRangeOutput {
  totalPoints: number;
  startDate: string;
  endDate: string;
  filterApplied: string | null;
}

export interface DailyChartDataPoint {
  date: string; // YYYY-MM-DD
  count: number;
}
export interface DailySubmissionsInRangeOutput {
  dailySubmissions: DailyChartDataPoint[];
  startDate: string;
  endDate: string;
  filterApplied: string | null;
}

export interface RateChartDataPoint {
  date: string; // YYYY-MM-DD
  rate: number; // Percentage
}
export interface DailyNegativeStatusRateInRangeOutput {
  dailyRates: RateChartDataPoint[];
  startDate: string;
  endDate: string;
  filterApplied: string | null;
}


// User type for AuthContext
export interface AppUser {
  uid: string;
  email: string | null;
  username: string; // Original username entered at login
  role: 'admin' | 'teamMember' | null;
  teamNameForFilter: string | null; // e.g., "Team 1", "Team 2", or null for admin
}


// Match Daily Result (from get-match-daily-result-flow)
export interface GetMatchDailyResultInput {
  tournamentId: string;
  roundNum: string;
  matchId: string;
  targetDate: string; // YYYY-MM-DD
}

export interface GetMatchDailyResultOutput {
  team1Name: string | null;
  team2Name: string | null;
  team1Score: number;
  team2Score: number;
  winner: string | null;
  status: string | null;
  exists: boolean;
}

// Match Scheduled Dates (from get-match-scheduled-dates-flow)
export interface GetMatchScheduledDatesInput {
  tournamentId: string;
  roundNum: string;
  matchId: string;
}
export type GetMatchScheduledDatesOutput = string[]; // Array of YYYY-MM-DD date strings
