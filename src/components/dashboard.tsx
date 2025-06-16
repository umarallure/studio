"use client"

import type React from "react"
import type {
  Team,
  Matchup,
  TopAgentMetric,
  ChartSegment,
  CenterMetric,
} from "@/lib/types"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import { CircularProgressbar, buildStyles } from "react-circular-progressbar"
import "react-circular-progressbar/dist/styles.css"
import {
  Trophy,
  Users,
  Target,
  Calendar,
  TrendingUp,
  BarChart3,
  AlertCircle,
  Loader2,
  CalendarDays,
  Award,
  ClipboardList,
  Check,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import {
  fetchTournamentTeams,
  fetchTournamentMatches,
  fetchPerformanceData,
  fetchTopPerformers,
  fetchStatusDistribution,
  fetchTournamentMetrics,
} from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"

// Map legacy team names to real team names
const TEAM_NAME_MAP: Record<string, string> = {
  "Team 1": "Rawlpindi Tiger",
  "Team 2": "Lahore qalanders",
  "Team 3": "Islamabad United",
  "Team 4": "Timberwolfs",
  "Team 5": "Rawlpindi Express",
  "Team 6": "Rawlpindi Gladiators",
  "Team 7": "Peshawar Zalmi",
  "Team 8": "Multan Sultans",
  "Team 9": "Avengers",
  "Team 10": "Hustlers",
  "Team 11": "A-Team",
  "Team 12": "Rawlpindi Bears",
  "Team 13": "Alpha's",
  "Team 14": "Vipers",
  "Team 15": "Karachi Kings",
  "Team 16": "Islamabad Sneak",
};

// Short code map for teams
const TEAM_SHORT_CODE_MAP: Record<string, string> = {
  "Team 1": "RWT",
  "Team 2": "LQ",
  "Team 3": "IU",
  "Team 4": "TMW",
  "Team 5": "RWE",
  "Team 6": "RWG",
  "Team 7": "PZ",
  "Team 8": "MS",
  "Team 9": "AVG",
  "Team 10": "HST",
  "Team 11": "ATM",
  "Team 12": "RWB",
  "Team 13": "ALP",
  "Team 14": "VIP",
  "Team 15": "KK",
  "Team 16": "ISB",
};

function getDisplayTeamName(teamName?: string) {
  if (!teamName) return undefined;
  return TEAM_NAME_MAP[teamName] || teamName;
}

function getTeamShortCode(teamName?: string) {
  if (!teamName) return '';
  return TEAM_SHORT_CODE_MAP[teamName] || teamName;
}

export default function Dashboard() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true)
  const [selectedView, setSelectedView] = useState("overview")
  const [selectedTeam, setSelectedTeam] = useState("all")

  // State for real data with explicit types
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<{ date: string; team1: string; team2: string; winner: string; score: string }[]>([])
  const [performanceData, setPerformanceData] = useState<{ date: string; submissions: number; chargebacks: number }[]>([])
  const [topPerformers, setTopPerformers] = useState<{ name: string; team: string; submissions: number; winRate: number }[]>([])
  const [statusDistribution, setStatusDistribution] = useState<{ name: string; value: number; color: string }[]>([])
  const [metrics, setMetrics] = useState<{
    totalTeams: number
    totalMatches: number
    completedMatches: number
    upcomingMatches: number
    averageSubmissions: number
    chargebackRate: number
    flowThroughRate: number
    targetAchievement: number
  }>({
    totalTeams: 0,
    totalMatches: 0,
    completedMatches: 0,
    upcomingMatches: 0,
    averageSubmissions: 0,
    chargebackRate: 0,
    flowThroughRate: 0,
    targetAchievement: 0,
  })

  // Compute chargeback rate data for the chart
  const chargebackRateData = performanceData.map((day) => ({
    ...day,
    rate: ((day.chargebacks / (day.submissions || 1)) * 100).toFixed(1),
  }))

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        const [teams, matches, performanceData, topPerformers, statusDistribution, metrics] = await Promise.all([
          fetchTournamentTeams(),
          fetchTournamentMatches(),
          // Only fetch team data for logged-in user if teamMember
          user?.role === 'teamMember' && user.teamNameForFilter
            ? fetchPerformanceData(user.teamNameForFilter)
            : fetchPerformanceData("all"),
          fetchTopPerformers(),
          fetchStatusDistribution(),
          fetchTournamentMetrics(),
        ])
        setTeams(teams)
        setMatches(matches)
        setPerformanceData(performanceData)
        setTopPerformers(topPerformers)
        setStatusDistribution(statusDistribution)
        setMetrics(metrics)
      } finally {
        setIsLoading(false)
      }
    }
    if (!isAuthLoading) fetchData()
  }, [user, isAuthLoading])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 min-h-[calc(100vh-200px)]">
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-r from-[#0a7578] to-[#b17e1e] rounded-2xl flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-white" />
          </div>
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#b17e1e] rounded-full flex items-center justify-center">
            <Trophy className="h-3 w-3 text-white" />
          </div>
        </div>
        <p className="text-lg text-foreground font-bold">Loading tournament dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 px-4 md:px-8 lg:px-16 py-6">
      {/* Dashboard Header */}
      <Card className="shadow sticky top-[calc(theme(spacing.16)_+_1px)] md:top-[calc(theme(spacing.16)_+_1px)] z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <CardContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#0a7578] to-[#b17e1e] bg-clip-text text-transparent flex items-center self-start md:self-center">
            BPO Games Dashboard
          </h1>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-full sm:w-[220px] bg-input">
                <SelectValue placeholder="Select Team View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map((team: any) => (
                  <SelectItem key={team.name} value={team.name}>
                    {getDisplayTeamName(team.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center text-sm p-2 rounded-md bg-input text-foreground border border-border">
              <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
              Tournament Period: Jun 16 - Jul 21, 2025
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Selection Tabs */}
      <Tabs defaultValue="overview" value={selectedView} onValueChange={setSelectedView} className="w-full">
        <TabsList className="grid grid-cols-3 md:grid-cols-4 w-full">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#0a7578]/10 data-[state=active]:to-[#b17e1e]/10 data-[state=active]:text-[#0a7578]"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="teams"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#0a7578]/10 data-[state=active]:to-[#b17e1e]/10 data-[state=active]:text-[#0a7578]"
          >
            <Users className="h-4 w-4 mr-2" />
            Teams
          </TabsTrigger>
          <TabsTrigger
            value="matches"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#0a7578]/10 data-[state=active]:to-[#b17e1e]/10 data-[state=active]:text-[#0a7578]"
          >
            <Trophy className="h-4 w-4 mr-2" />
            Matches
          </TabsTrigger>
          <TabsTrigger
            value="performance"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#0a7578]/10 data-[state=active]:to-[#b17e1e]/10 data-[state=active]:text-[#0a7578]"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
          
        </TabsList>

        {/* Overview Tab Content */}
        <TabsContent value="overview" className="space-y-6 pt-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Daily Submissions"
              value={performanceData[performanceData.length - 1]?.submissions ?? 0}
              previousValue={performanceData[performanceData.length - 2]?.submissions ?? 0}
              icon={ClipboardList}
              description="Total submissions for today"
            />
            <MetricCard
              title="Chargeback Rate"
              value={metrics.chargebackRate ?? 0}
              unit="%"
              icon={AlertCircle}
              description="Average over last 30 days"
              trend="down"
            />
            <MetricCard
              title="Flow Through Rate"
              value={metrics.flowThroughRate ?? 0}
              unit="%"
              icon={Target}
              description="Percentage of successful entries"
              trend="up"
            />
            
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Submissions Chart */}
            <Card className="bg-card shadow-lg rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <TrendingUp className="mr-2 h-5 w-5 text-[#0a7578]" />
                  Daily Submissions (Last 15 days)
                </CardTitle>
                <CardDescription>
                  {selectedTeam !== "all"
                    ? `Daily submission volume trend for ${selectedTeam}`
                    : "Daily submission volume trend for all teams"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} stroke="hsl(var(--border))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(value: number) => [`${value} submissions`, "Daily Submissions"]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="submissions"
                      name="Daily Submissions"
                      stroke="#0a7578"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Chargeback Chart */}
            <Card className="bg-card shadow-lg rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <AlertCircle className="mr-2 h-5 w-5 text-red-500" />
                  Daily Chargeback Rate (Last 15 days)
                </CardTitle>
                <CardDescription>
                  {selectedTeam !== "all"
                    ? `Daily chargeback rate trend for ${selectedTeam}`
                    : "Daily chargeback rate trend for all teams"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chargebackRateData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      tickFormatter={(value) => `${value}%`}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      stroke="hsl(var(--border))"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(value: string) => [`${value}%`, "Chargeback Rate"]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      name="Chargeback Rate"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Flow Through Rate */}
            <Card className="bg-card text-card-foreground shadow-xl rounded-lg">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-xl font-bold flex items-center text-foreground">
                  <Target className="mr-2 h-6 w-6 text-[#0a7578]" /> Flow Through Rate
                </h2>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>
                    • Total Entries:{" "}
                    <strong className="text-foreground">{metrics.totalMatches?.toLocaleString?.() ?? 0}</strong>
                  </li>
                  <li>
                    • Target Entries:{" "}
                    <strong className="text-foreground">
                      {metrics.totalMatches ? (metrics.totalMatches * 1.25).toFixed(0) : 0}
                    </strong>
                  </li>
                  <li>
                    • Achievement:{" "}
                    <strong className="text-foreground">{metrics.targetAchievement ?? 0}%</strong>
                  </li>
                  <li>
                    • Status:
                    <Check className="inline h-4 w-4 ml-1 mr-1 text-green-500" />
                    <span className="font-medium text-green-500">On Track</span>
                  </li>
                </ul>

                <div className="text-center mt-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Flow Through Progress</h3>
                  <div className="flex justify-center items-center">
                    <div className="w-[180px]">
                      <CircularProgressbar
                        value={metrics.flowThroughRate ?? 0}
                        text={`${metrics.flowThroughRate ?? 0}%`}
                        styles={buildStyles({
                          textSize: "16px",
                          pathColor: "#0a7578",
                          textColor: "#0a7578",
                          trailColor: "#e5e7eb",
                        })}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card className="bg-card text-card-foreground shadow-xl rounded-lg">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-xl font-bold flex items-center text-foreground">
                  <BarChart3 className="mr-2 h-6 w-6 text-[#b17e1e]" /> Entry Status Distribution
                </h2>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  {statusDistribution.filter(s => s.value > 0).map((status) => (
                    <li key={status.name} style={{ color: status.color, fontWeight: 600 }}>
                      • {status.name}: <span style={{ color: 'inherit', fontWeight: 700 }}>{status.value}%</span>
                    </li>
                  ))}
                </ul>
                <div className="text-center mt-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Status Breakdown</h3>
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width={280} height={180}>
                      <PieChart>
                        <Pie
                          data={statusDistribution.filter(s => s.value > 0)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={70}
                          dataKey="value"
                          nameKey="name"
                        >
                          {statusDistribution.filter(s => s.value > 0).map((entry, idx) => (
                            <Cell key={`cell-${entry.name}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name) => [`${value}%`, name]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "var(--radius)",
                          }}
                        />
                        <Legend
                          layout="horizontal"
                          align="center"
                          verticalAlign="bottom"
                          iconType="circle"
                          wrapperStyle={{ fontSize: 13, marginTop: 10 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-r from-[#0a7578] to-[#0b1821] text-white shadow-md rounded-xl hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <h3 className="text-md font-bold mb-2 flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5" /> Tournament Progress
                </h3>
                <p className="text-sm">Completed Matches: {metrics.completedMatches}</p>
                <p className="text-sm">Remaining Matches: {metrics.upcomingMatches}</p>
                <div className="mt-2 bg-white/20 rounded-full h-2">
                  <div
                    className="bg-white h-2 rounded-full"
                    style={{
                      width: `${(metrics.completedMatches / metrics.totalMatches) * 100}%`,
                    }}
                  ></div>
                </div>
                <p className="text-xs mt-1 text-right">
                  {Math.round(
                    (metrics.completedMatches / metrics.totalMatches) * 100,
                  )}
                  % Complete
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-[#b17e1e] to-[#d4a017] text-white shadow-md rounded-xl hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <h3 className="text-md font-bold mb-2 flex items-center">
                  <Award className="mr-2 h-5 w-5" /> Top Team
                </h3>
                <p className="text-sm">Team: {teams[0]?.name}</p>
                <p className="text-sm">
                  Win Rate:{" "}
                  {teams[0] && typeof teams[0].wins === 'number' && typeof teams[0].losses === 'number' && (teams[0].wins + teams[0].losses > 0)
                    ? Math.round((teams[0].wins / (teams[0].wins + teams[0].losses)) * 100)
                    : 0}
                  %
                </p>
                <p className="text-sm mt-2">
                  Record: {teams[0]?.wins ?? 0}W - {teams[0]?.losses ?? 0}L
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-[#0b1821] to-[#0a7578] text-white shadow-md rounded-xl hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <h3 className="text-md font-bold mb-2 flex items-center">
                  <Calendar className="mr-2 h-5 w-5" /> Upcoming Matches
                </h3>
                <p className="text-sm">Next Match: Team Alpha vs Team Zeta</p>
                <p className="text-sm">Date: July 1, 2025</p>
                <p className="text-sm mt-2">
                  Round: Semifinals
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Teams Tab Content */}
        <TabsContent value="teams" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5 text-[#0a7578]" />
                Team Rankings
              </CardTitle>
              <CardDescription>Current standings based on win/loss record</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <div className="grid grid-cols-5 bg-muted/50 p-3 text-sm font-medium">
                  <div>Rank</div>
                  <div className="col-span-2">Team</div>
                  <div>Record</div>
                  <div>Win Rate</div>
                </div>
                <div className="divide-y">
                  {teams.map((team, index) => {
                    const wins = typeof team.wins === 'number' ? team.wins : 0;
                    const losses = typeof team.losses === 'number' ? team.losses : 0;
                    const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
                    return (
                      <div key={team.name} className="grid grid-cols-5 p-3 text-sm items-center">
                        <div className="font-medium">{index + 1}</div>
                        <div className="col-span-2 font-medium">{getDisplayTeamName(team.name)}</div>
                        <div>
                          {wins}W - {losses}L
                        </div>
                        <div>
                          <Badge
                            className={
                              winRate > 70
                                ? "bg-green-100 text-green-800"
                                : winRate > 50
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-orange-100 text-orange-800"
                            }
                          >
                            {winRate}%
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="mr-2 h-5 w-5 text-[#b17e1e]" />
                  Team Performance
                </CardTitle>
                <CardDescription>Win/loss comparison across teams</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={teams} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={60} tickFormatter={getTeamShortCode} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="wins" name="Wins" fill="#0a7578" />
                    <Bar dataKey="losses" name="Losses" fill="#b17e1e" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="mr-2 h-5 w-5 text-[#0a7578]" />
                  Team Achievement
                </CardTitle>
                <CardDescription>Progress toward tournament goals</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {teams.slice(0, 4).map((team, index) => {
                    const wins = typeof team.wins === 'number' ? team.wins : 0;
                    const losses = typeof team.losses === 'number' ? team.losses : 0;
                    const progress = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
                    return (
                      <div key={team.name} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{team.name}</span>
                          <span className="text-muted-foreground">{progress}% Complete</span>
                        </div>
                        <div className="bg-muted rounded-full h-2">
                          <div
                            className={`rounded-full h-2 ${
                              progress > 70 ? "bg-green-500" : progress > 50 ? "bg-[#0a7578]" : "bg-[#b17e1e]"
                            }`}
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Matches Tab Content */}
        <TabsContent value="matches" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trophy className="mr-2 h-5 w-5 text-[#b17e1e]" />
                Recent Matches
              </CardTitle>
              <CardDescription>Results from the latest tournament matches</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <div className="grid grid-cols-5 bg-muted/50 p-3 text-sm font-medium">
                  <div>Date</div>
                  <div className="col-span-2">Teams</div>
                  <div>Score</div>
                  <div>Winner</div>
                </div>
                <div className="divide-y">
                  {matches.map((match) => (
                    <div
                      key={`${match.date}-${match.team1}-${match.team2}`}
                      className="grid grid-cols-5 p-3 text-sm items-center"
                    >
                      <div>
                        {match.date.split("-")[2]}/{match.date.split("-")[1]}
                      </div>
                      <div className="col-span-2 font-medium">
                        {getDisplayTeamName(match.team1)} vs {getDisplayTeamName(match.team2)}
                      </div>
                      <div>{match.score}</div>
                      <div>
                        <Badge className="bg-[#0a7578]/10 text-[#0a7578] border-[#0a7578]/20">{getDisplayTeamName(match.winner)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="mr-2 h-5 w-5 text-[#0a7578]" />
                  Upcoming Matches
                </CardTitle>
                <CardDescription>Schedule for the next round of matches</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-muted/30 p-4 rounded-lg border border-border">
                    <div className="flex justify-between items-center mb-2">
                      <Badge variant="outline">July 1, 2025</Badge>
                      <Badge className="bg-[#0a7578]/10 text-[#0a7578]">Semifinals</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="font-medium">Team Alpha</div>
                      <div className="text-sm text-muted-foreground">vs</div>
                      <div className="font-medium">Team Zeta</div>
                    </div>
                  </div>

                  <div className="bg-muted/30 p-4 rounded-lg border border-border">
                    <div className="flex justify-between items-center mb-2">
                      <Badge variant="outline">July 1, 2025</Badge>
                      <Badge className="bg-[#0a7578]/10 text-[#0a7578]">Semifinals</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="font-medium">Team Beta</div>
                      <div className="text-sm text-muted-foreground">vs</div>
                      <div className="font-medium">Team Gamma</div>
                    </div>
                  </div>

                  <div className="bg-muted/30 p-4 rounded-lg border border-border">
                    <div className="flex justify-between items-center mb-2">
                      <Badge variant="outline">July 14, 2025</Badge>
                      <Badge className="bg-[#b17e1e] text-white">Championship</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="font-medium">TBD</div>
                      <div className="text-sm text-muted-foreground">vs</div>
                      <div className="font-medium">TBD</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="mr-2 h-5 w-5 text-[#b17e1e]" />
                  Match Statistics
                </CardTitle>
                <CardDescription>Key performance indicators from matches</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/30 p-4 rounded-lg border border-border">
                    <div className="text-sm text-muted-foreground mb-1">Average Score</div>
                    <div className="text-2xl font-bold text-[#0a7578]">3-1</div>
                    <div className="text-xs text-muted-foreground mt-1">Across all matches</div>
                  </div>

                  <div className="bg-muted/30 p-4 rounded-lg border border-border">
                    <div className="text-sm text-muted-foreground mb-1">Shutouts</div>
                    <div className="text-2xl font-bold text-[#b17e1e]">3</div>
                    <div className="text-xs text-muted-foreground mt-1">3-0 victories</div>
                  </div>

                  <div className="bg-muted/30 p-4 rounded-lg border border-border">
                    <div className="text-sm text-muted-foreground mb-1">Close Matches</div>
                    <div className="text-2xl font-bold text-[#0a7578]">4</div>
                    <div className="text-xs text-muted-foreground mt-1">Decided by 1 point</div>
                  </div>

                  <div className="bg-muted/30 p-4 rounded-lg border border-border">
                    <div className="text-sm text-muted-foreground mb-1">Completion</div>
                    <div className="text-2xl font-bold text-[#b17e1e]">43%</div>
                    <div className="text-xs text-muted-foreground mt-1">Of tournament matches</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab Content */}
        <TabsContent value="performance" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5 text-[#0a7578]" />
                  Submission Trends
                </CardTitle>
                <CardDescription>Daily submission volume over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="submissions" name="Submissions" stroke="#0a7578" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertCircle className="mr-2 h-5 w-5 text-red-500" />
                  Chargeback Analysis
                </CardTitle>
                <CardDescription>Chargeback rates and comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm text-muted-foreground">Current Period</div>
                      <div className="text-2xl font-bold text-[#0a7578]">
                        {metrics.chargebackRate}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Previous Period</div>
                      <div className="text-2xl font-bold text-[#b17e1e]">
                        {(metrics.chargebackRate * 1.2).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Industry Avg</div>
                      <div className="text-2xl font-bold text-muted-foreground">5.0%</div>
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={[
                        { name: "Current", value: metrics.chargebackRate, fill: "#0a7578" },
                        {
                          name: "Previous",
                          value: Number.parseFloat((metrics.chargebackRate * 1.2).toFixed(1)),
                          fill: "#b17e1e",
                        },
                        { name: "Industry", value: 5.0, fill: "#94a3b8" },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => `${value}%`} />
                      <Tooltip
                        formatter={(value) => [`${value}%`, "Rate"]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]}>
                        {[
                          <Cell key="cell-0" fill="#0a7578" />,
                          <Cell key="cell-1" fill="#b17e1e" />,
                          <Cell key="cell-2" fill="#94a3b8" />,
                        ]}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="mr-2 h-5 w-5 text-[#0a7578]" />
                Performance Metrics
              </CardTitle>
              <CardDescription>Key performance indicators for the tournament</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Average Daily Submissions</div>
                  <div className="text-3xl font-bold text-[#0a7578]">
                    {metrics.averageSubmissions}
                  </div>
                  <div className="flex items-center text-sm text-green-600">
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    <span>12% increase from last month</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Flow Through Rate</div>
                  <div className="text-3xl font-bold text-[#0a7578]">{metrics.flowThroughRate}%</div>
                  <div className="flex items-center text-sm text-green-600">
                    <ArrowUpRight className="h-4 w-4 mr-1" />
                    <span>5% increase from last month</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Chargeback Rate</div>
                  <div className="text-3xl font-bold text-[#0a7578]">{metrics.chargebackRate}%</div>
                  <div className="flex items-center text-sm text-red-600">
                    <ArrowDownRight className="h-4 w-4 mr-1" />
                    <span>2% decrease from last month</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        
       
      </Tabs>
    </div>
  )
}

// Metric Card Component
interface MetricCardProps {
  title: string
  value: number | string
  previousValue?: number
  unit?: string
  icon: React.ElementType
  description: string
  trend?: "up" | "down" | "neutral"
}

function MetricCard({
  title,
  value,
  previousValue,
  unit = "",
  icon: Icon,
  description,
  trend = "neutral",
}: MetricCardProps) {
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline">
              <h2 className="text-3xl font-bold tracking-tight">
                {value}
                {unit}
              </h2>
              {previousValue !== undefined && <p className="ml-2 text-sm text-muted-foreground">vs {previousValue}</p>}
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend !== "neutral" && (
          <div className="mt-4 flex items-center text-xs">
            {trend === "up" ? (
              <>
                <ArrowUpRight className="mr-1 h-4 w-4 text-green-500" />
                <span className="text-green-500">Increasing</span>
              </>
            ) : (
              <>
                <ArrowDownRight className="mr-1 h-4 w-4 text-red-500" />
                <span className="text-red-500">Decreasing</span>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
