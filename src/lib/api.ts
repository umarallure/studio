import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export const fetchTournamentTeams = async () => {
  // Real team names with random win/loss data
  return [
    { name: "Rawlpindi Tiger", wins: 7, losses: 2 },
    { name: "Lahore qalanders", wins: 5, losses: 4 },
    { name: "Islamabad United", wins: 6, losses: 3 },
    { name: "Timberwolfs", wins: 4, losses: 5 },
    { name: "Rawlpindi Express", wins: 3, losses: 6 },
    { name: "Rawlpindi Gladiators", wins: 2, losses: 7 },
    { name: "Peshawar Zalmi", wins: 6, losses: 3 },
    { name: "Multan Sultans", wins: 5, losses: 4 },
    { name: "Avengers", wins: 4, losses: 5 },
    { name: "Hustlers", wins: 3, losses: 6 },
    { name: "A-Team", wins: 7, losses: 2 },
    { name: "Rawlpindi Bears", wins: 2, losses: 7 },
    { name: "Alpha's", wins: 5, losses: 4 },
    { name: "Vipers", wins: 6, losses: 3 },
    { name: "Karachi Kings", wins: 4, losses: 5 },
    { name: "Islamabad Sneak", wins: 3, losses: 6 },
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

export const fetchPerformanceData = async (teamName: string) => {
  // Use the already initialized db from firebase.ts
  const sheet1RowsRef = collection(db, "Sheet1Rows");

  // Get last 30 days including today
  const today = new Date();
  const dates: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10); // "YYYY-MM-DD"
    dates.push(dateStr);
  }

  // Fetch all rows for the last 30 days for the given team
  const q = query(
    sheet1RowsRef,
    where("Date", ">=", dates[0]),
    where("Date", "<=", dates[dates.length - 1]),
    where("Lead Vender", "==", teamName)
  );
  const snapshot = await getDocs(q);

  // Group by date
  const dataByDate: Record<string, { total: number; submitted: number }> = {};
  for (const date of dates) {
    dataByDate[date] = { total: 0, submitted: 0 };
  }

  snapshot.forEach(doc => {
    const data = doc.data();
    const date = data["Date"];
    if (!dataByDate[date]) return;
    dataByDate[date].total += 1;
    if (data["Status"] === "Submitted") {
      dataByDate[date].submitted += 1;
    }
  });

  // Prepare result
  return dates.map(date => ({
    date,
    submissions: dataByDate[date].submitted,
    chargebacks: dataByDate[date].total - dataByDate[date].submitted
  }));
};

export const fetchTopPerformers = async (teamName?: string) => {
  console.log("fetchTopPerformers CALLED", teamName);
  try {
    if (!teamName || teamName === "all") return [];
    const sheet1RowsRef = collection(db, "Sheet1Rows");
    
    const q = query(sheet1RowsRef, where("Lead Vender", "==", teamName));
    const snapshot = await getDocs(q);

    console.log("fetchTopPerformers: teamName", teamName);
    console.log("fetchTopPerformers: docs fetched", snapshot.size);

    // Aggregate agent stats
    const agentStats: Record<string, { submissions: number; wins: number; total: number }> = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      const agent = data["Agent"];
      if (!agent) return;
      if (!agentStats[agent]) agentStats[agent] = { submissions: 0, wins: 0, total: 0 };
      agentStats[agent].submissions++;
      agentStats[agent].total++;
      if (data["Status"] === "Submitted") {
        agentStats[agent].wins++;
      }
    });

    console.log("fetchTopPerformers: agentStats", agentStats);

    // Prepare result: sort by submissions desc, return top 3
    const result = Object.entries(agentStats)
      .map(([name, stats]) => ({
        name,
        team: teamName,
        submissions: stats.submissions,
        winRate: stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.submissions - a.submissions)
      .slice(0, 3);

    console.log("fetchTopPerformers: result", result);

    return result;
  } catch (err) {
    console.error("fetchTopPerformers ERROR", err);
    throw err;
  }
}

export const fetchStatusDistribution = async (teamName?: string) => {
  // Query Firestore for status counts, optionally filtered by team
  const sheet1RowsRef = collection(db, "Sheet1Rows");
  let q;
  if (teamName) {
    q = query(sheet1RowsRef, where("Lead Vender", "==", teamName));
  } else {
    q = query(sheet1RowsRef);
  }
  const snapshot = await getDocs(q);

  // Count statuses
  const statusCounts: Record<string, number> = {};
  let total = 0;
  snapshot.forEach(doc => {
    const status = doc.data()["Status"] || "Unknown";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    total++;
  });

  // Define which statuses to show and their colors
  const statusMeta = [
    { name: "Submitted", color: "#16a34a" },
    { name: "DQ", color: "#b91c1c" },
    { name: "Needs Call Back", color: "#fde68a" },
    { name: "Call Back Fix", color: "#047857" },
    { name: "Not Interested", color: "#fbbf24" },
    { name: "Disconnected - Never Retransferred", color: "#818cf8" },
    { name: "Pending Submission", color: "#38bdf8" },
    { name: "Already Sold Other Center", color: "#7c3aed" },
    { name: "Denied (needs new app)", color: "#78350f" },
    { name: "Future Submission Date", color: "#bae6fd" },
    { name: "Denied After UW", color: "#fca5a5" },
  ];

  // Prepare result as percentage of total
  return statusMeta.map(({ name, color }) => ({
    name,
    value: total > 0 ? Math.round(((statusCounts[name] || 0) / total) * 100) : 0,
    color,
  }));
}

export const fetchTournamentMetrics = async (teamName?: string) => {
  const sheet1RowsRef = collection(db, "Sheet1Rows");
  let q;
  if (teamName) {
    q = query(sheet1RowsRef, where("Lead Vender", "==", teamName));
  } else {
    q = query(sheet1RowsRef);
  }
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 29);
  const startDateStr = startDate.toISOString().slice(0, 10);
  const endDateStr = today.toISOString().slice(0, 10);

  // Filter for last 30 days
  const snapshot = await getDocs(q);
  let totalEntries = 0;
  let submittedEntries = 0;
  let sumSubmissions = 0;
  let dateCounts: Record<string, number> = {};

  snapshot.forEach(doc => {
    const data = doc.data();
    const date = data["Date"];
    if (!date || date < startDateStr || date > endDateStr) return;
    totalEntries++;
    if (data["Status"] === "Submitted") {
      submittedEntries++;
      dateCounts[date] = (dateCounts[date] || 0) + 1;
    }
  });

  // Calculate average submissions per day (for days with at least one submission)
  const daysWithSubmissions = Object.keys(dateCounts).length;
  sumSubmissions = Object.values(dateCounts).reduce((a, b) => a + b, 0);
  const averageSubmissions = daysWithSubmissions > 0 ? Math.round(sumSubmissions / daysWithSubmissions) : 0;

  // Chargeback rate: submitted / total (as percent)
  const chargebackRate = totalEntries > 0 ? Math.round((submittedEntries / totalEntries) * 100) : 0;

  // Flow through rate: total entries in last 30 days
  const flowThroughRate = totalEntries;

  // Dummy values for other metrics (can be made dynamic as needed)
  return {
    totalTeams: 16, // Not calculated here
    totalMatches: 15, // Not calculated here
    completedMatches: 0, // Not calculated here
    upcomingMatches: 0, // Not calculated here
    averageSubmissions,
    chargebackRate,
    flowThroughRate,
    targetAchievement: 0, // Not calculated here
  };
};
