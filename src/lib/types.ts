
// Represents a team as understood from Firestore structure primarily by name
export interface Team {
  name: string; // Team name is the primary identifier from Apps Script
  logo?: string; // URL to team logo placeholder
  dailyWinsInMatchup?: number; // How many daily wins this team has in the current matchup
}

// Represents a matchup as stored in Firestore under bracket/{round}/matches/{matchId}
export interface Matchup {
  id: string; // e.g., "match1"
  roundId: string; // e.g., "1", "2"
  team1Name: string | null; // Name of team 1, or "TBD"
  team2Name: string | null; // Name of team 2, or "TBD"
  team1DailyWins: number;   // From Firestore fields.team1Wins.integerValue
  team2DailyWins: number;   // From Firestore fields.team2Wins.integerValue
  seriesWinnerName: string | null; // From Firestore fields.advanced.stringValue
  // If we need to show individual day scores, we might add a sub-collection fetch here
}

// Represents a round in the tournament
export interface Round {
  id: string; // e.g., "1", "2", "3" (corresponds to roundNum in Firestore path)
  name: string; // e.g., "Round 1: Quarter-Finals"
  matchups: Matchup[];
}

// Overall tournament data structure
export interface TournamentData {
  rounds: Round[];
  prize: string; // Can remain static or be fetched if stored separately
}


// Types for Center Dashboard remain unchanged by this refactor
export interface CenterMetric {
  id: string;
  title: string;
  value: string | number;
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
  Date?: string;
  FromCallback?: boolean; // Renamed to avoid space and question mark
  INSURED_NAME?: string;  // Renamed to avoid space
  LeadVender?: string;    // Renamed to avoid space
  Notes?: string;
  ProductType?: string;
  Status?: string;
  // Add any other fields you expect from the 'Sheet1Rows' documents
}
