
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

export interface CenterDashboardData {
  centerName: string;
  dailySales: CenterMetric;
  chargebackPercentage: CenterMetric;
  flowThroughRate: CenterMetric;
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

// Type for Genkit flow to get daily submissions
export interface DailySubmissionsInput {
  targetDate: string; // YYYY-MM-DD
  leadVenderFilter?: string | null; // Optional: filter by specific LeadVender
}

export interface DailySubmissionsOutput {
  submissionCount: number;
  // Potentially other metrics in the future
}
