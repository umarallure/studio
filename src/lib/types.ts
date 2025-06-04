
export interface Team {
  id: string;
  name: string;
  score: number; // Points in the current series (0-3)
  logo?: string; // URL to team logo placeholder
}

export interface Matchup {
  id: string;
  team1: Team | null; // Null if team hasn't advanced yet
  team2: Team | null; // Null if team hasn't advanced yet
  winner?: string; // ID of the winning team if match is complete
  gamesPlayed: number; // How many games in the best of 5 series have been played
  round: number;
  matchIndex: number; // Index within the round
}

export interface Round {
  id: string;
  name: string;
  matchups: Matchup[];
}

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

export interface TournamentData {
  rounds: Round[];
  prize: string;
}

export interface CenterDashboardData {
  centerName: string;
  dailySales: CenterMetric;
  chargebackPercentage: CenterMetric;
  flowThroughRate: CenterMetric;
}
