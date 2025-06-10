export const fetchTournamentTeams = async () => {
  // Replace with actual data fetching logic from your data source
  return [
    { name: "Team Alpha", wins: 5, losses: 2 },
    { name: "Team Beta", wins: 4, losses: 3 },
    { name: "Team Gamma", wins: 3, losses: 4 },
    { name: "Team Zeta", wins: 2, losses: 5 },
    { name: "Team Epsilon", wins: 6, losses: 1 },
    { name: "Team Delta", wins: 1, losses: 6 },
    { name: "Team Eta", wins: 4, losses: 3 },
    { name: "Team Theta", wins: 3, losses: 4 },
  ]
}

export const fetchTournamentMatches = async () => {
  // Replace with actual data fetching logic from your data source
  return [
    { date: "2025-06-16", team1: "Team Alpha", team2: "Team Beta", winner: "Team Alpha", score: "3-1" },
    { date: "2025-06-16", team1: "Team Gamma", team2: "Team Zeta", winner: "Team Zeta", score: "1-3" },
    { date: "2025-06-23", team1: "Team Alpha", team2: "Team Zeta", winner: "Team Alpha", score: "3-0" },
    { date: "2025-06-23", team1: "Team Beta", team2: "Team Gamma", winner: "Team Beta", score: "3-2" },
    { date: "2025-07-01", team1: "Team Alpha", team2: "Team Epsilon", winner: "Team Epsilon", score: "1-3" },
    { date: "2025-07-01", team1: "Team Beta", team2: "Team Delta", winner: "Team Beta", score: "3-0" },
    { date: "2025-07-01", team1: "Team Eta", team2: "Team Theta", winner: "Team Eta", score: "3-1" },
  ]
}

export const fetchPerformanceData = async () => {
  // Replace with actual data fetching logic from your data source
  return [
    { date: "2025-06-16", submissions: 150, chargebacks: 5 },
    { date: "2025-06-17", submissions: 160, chargebacks: 6 },
    { date: "2025-06-18", submissions: 170, chargebacks: 7 },
    { date: "2025-06-19", submissions: 180, chargebacks: 8 },
    { date: "2025-06-20", submissions: 190, chargebacks: 9 },
    { date: "2025-06-21", submissions: 200, chargebacks: 10 },
    { date: "2025-06-22", submissions: 210, chargebacks: 11 },
    { date: "2025-06-23", submissions: 220, chargebacks: 12 },
    { date: "2025-06-24", submissions: 230, chargebacks: 13 },
    { date: "2025-06-25", submissions: 240, chargebacks: 14 },
    { date: "2025-06-26", submissions: 250, chargebacks: 15 },
    { date: "2025-06-27", submissions: 260, chargebacks: 16 },
    { date: "2025-06-28", submissions: 270, chargebacks: 17 },
    { date: "2025-06-29", submissions: 280, chargebacks: 18 },
    { date: "2025-06-30", submissions: 290, chargebacks: 19 },
  ]
}

export const fetchTopPerformers = async () => {
  // Replace with actual data fetching logic from your data source
  return [
    { name: "Agent A", team: "Team Alpha", submissions: 120, winRate: 90 },
    { name: "Agent B", team: "Team Beta", submissions: 110, winRate: 85 },
    { name: "Agent C", team: "Team Gamma", submissions: 100, winRate: 80 },
  ]
}

export const fetchStatusDistribution = async () => {
  // Replace with actual data fetching logic from your data source
  return [
    { name: "Submitted", value: 60, color: "#16a34a" },
    { name: "In Progress", value: 20, color: "#0ea5e9" },
    { name: "Completed", value: 15, color: "#a855f7" },
    { name: "Rejected", value: 5, color: "#dc2626" },
  ]
}

export const fetchTournamentMetrics = async () => {
  // Replace with actual data fetching logic from your data source
  return {
    totalTeams: 8,
    totalMatches: 28,
    completedMatches: 12,
    upcomingMatches: 16,
    averageSubmissions: 200,
    chargebackRate: 4.5,
    flowThroughRate: 95,
    targetAchievement: 110,
  }
}
