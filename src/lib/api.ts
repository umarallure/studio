import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";

export const fetchTournamentTeams = async () => {
  const teams = Array.from({ length: 16 }, (_, i) => `Team ${i + 1}`);
  const teamStats: Record<string, { wins: number; losses: number }> = {};
  teams.forEach(team => {
    teamStats[team] = { wins: 0, losses: 0 };
  });

  // Get the latest tournament id
  const tournamentsRef = collection(db, "tournaments");
  const tournamentsSnap = await getDocs(tournamentsRef);
  let latestTournamentId = "";
  let latestTimestamp = 0;
  tournamentsSnap.forEach(doc => {
    const data = doc.data();
    if (data.createdAt && data.createdAt.seconds) {
      if (data.createdAt.seconds > latestTimestamp) {
        latestTimestamp = data.createdAt.seconds;
        latestTournamentId = doc.id;
      }
    } else {
      if (doc.id > latestTournamentId) {
        latestTournamentId = doc.id;
      }
    }
  });
  if (!latestTournamentId) return teams.map(team => ({ name: team, wins: 0, losses: 0 }));

  const matchesRef = collection(db, `tournaments/${latestTournamentId}/rounds/1/matches`);
  const matchesSnap = await getDocs(matchesRef);

  for (const matchDoc of matchesSnap.docs) {
    const matchId = matchDoc.id;
    const dailyResultsRef = collection(db, `tournaments/${latestTournamentId}/rounds/1/matches/${matchId}/dailyResults`);
    const dailyResultsSnap = await getDocs(dailyResultsRef);

    for (const dailyDoc of dailyResultsSnap.docs) {
      const data = dailyDoc.data();
      // Firestore REST API returns fields nested under 'fields' and values as stringValue/integerValue
      const fields = data.fields || {};
      let winner = fields.winner?.stringValue;
      let loser = fields.loser?.stringValue;
      let team1 = fields.team1?.stringValue;
      let team2 = fields.team2?.stringValue;
      let team1Score = fields.team1Score?.integerValue !== undefined ? Number(fields.team1Score.integerValue) : undefined;
      let team2Score = fields.team2Score?.integerValue !== undefined ? Number(fields.team2Score.integerValue) : undefined;
      // Fallback: try to determine winner/loser from scores if not present
      if (!winner && team1 && team2 && typeof team1Score === 'number' && typeof team2Score === 'number') {
        if (team1Score > team2Score) {
          winner = team1;
          loser = team2;
        } else if (team2Score > team1Score) {
          winner = team2;
          loser = team1;
        }
      }
      if (teams.includes(winner)) {
        teamStats[winner].wins += 1;
      }
      if (teams.includes(loser)) {
        teamStats[loser].losses += 1;
      }
    }
  }

  // Return in the required array format
  return teams.map(team => ({
    name: team,
    wins: teamStats[team].wins,
    losses: teamStats[team].losses,
  }));
}

export const fetchTournamentMatches = async () => {
  // 1. Get latest tournament and its startDate
  const tournamentsRef = collection(db, "tournaments");
  const tournamentsSnap = await getDocs(tournamentsRef);
  let latestTournament = null;
  let latestTimestamp = 0;
  tournamentsSnap.forEach(doc => {
    const data = doc.data();
    if (data.createdAt && data.createdAt.seconds > latestTimestamp) {
      latestTimestamp = data.createdAt.seconds;
      latestTournament = { id: doc.id, ...data };
    }
  });
  if (!latestTournament) return [];

  const startDate = latestTournament.startDate?.seconds
    ? new Date(latestTournament.startDate.seconds * 1000)
    : null;
  if (!startDate) return [];

  // 2. Fetch all matches in round 1 (expand for more rounds if needed)
  const matchesRef = collection(db, `tournaments/${latestTournament.id}/rounds/1/matches`);
  const matchesSnap = await getDocs(matchesRef);

  const results = [];
  for (const matchDoc of matchesSnap.docs) {
    const matchId = matchDoc.id;
    const dailyResultsRef = collection(db, `tournaments/${latestTournament.id}/rounds/1/matches/${matchId}/dailyResults`);
    const dailyResultsSnap = await getDocs(dailyResultsRef);

    for (const dailyDoc of dailyResultsSnap.docs) {
      const data = dailyDoc.data();
      const fields = data.fields || {};
      const dateStr = dailyDoc.id; // e.g. "2025-06-16"
      const dateObj = new Date(dateStr);
      if (dateObj < startDate) continue;

      const team1 = fields.team1?.stringValue;
      const team2 = fields.team2?.stringValue;
      const winner = fields.winner?.stringValue;
      const team1Score = fields.team1Score?.integerValue !== undefined ? Number(fields.team1Score.integerValue) : undefined;
      const team2Score = fields.team2Score?.integerValue !== undefined ? Number(fields.team2Score.integerValue) : undefined;
      let score = undefined;
      if (typeof team1Score === "number" && typeof team2Score === "number") {
        score = `${team1Score}-${team2Score}`;
      }

      results.push({
        date: dateStr,
        team1,
        team2,
        winner,
        score,
      });
    }
  }
  return results;
};

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
