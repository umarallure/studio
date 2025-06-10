"use client";

import type { CenterDashboardData, TopAgentMetric, ChartSegment, CenterMetric } from '@/lib/types';
import { defaultCenterData, mockCenterData1, mockCenterData2 } from '@/lib/mock-data';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { getDailySubmissions } from '@/ai/flows/get-daily-submissions-flow';
import { getTopAgentLastMonth } from '@/ai/flows/get-top-agent-last-month-flow';
import { getEntryStatsByStatusForChart } from '@/ai/flows/get-entry-stats-by-status-for-chart-flow';
import { getTeamChargebackRate } from '@/ai/flows/get-team-chargeback-rate-flow';
import { getDailySubmissionsInRange } from '@/ai/flows/get-daily-submissions-in-range-flow';
import { getDailyChargebackRate } from '@/ai/flows/get-daily-chargeback-rate-flow';
import { getChargebackComparison } from '@/ai/flows/get-chargeback-comparison-flow';

import { format as formatDate, subDays, isValid, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Award, CalendarDays, Info, ClipboardList, Users, Target, TrendingUp as TrendingUpIcon, BarChart3, AlertCircle, Coins, DollarSign, Check, AlertTriangle as AlertTriangleIcon } from 'lucide-react'; 
import MetricCard from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { GaugeChart } from '@/components/dashboard/GaugeChart';

interface AvailableCenter {
  id: string;
  name: string;
  baseMockData: CenterDashboardData;
  leadVenderFilterName: string | null;
}

const availableCentersForAdmin: AvailableCenter[] = [
  { id: 'all', name: 'All Teams (Admin View)', baseMockData: defaultCenterData, leadVenderFilterName: null },
  { id: 'team1_view', name: 'Team 1 View', baseMockData: mockCenterData1, leadVenderFilterName: 'Team 1' },
  { id: 'team2_view', name: 'Team 2 View', baseMockData: mockCenterData2, leadVenderFilterName: 'Team 2' },
];

const FIXED_DATE_RANGE_DAYS = 30;

// Types for sample chart data
interface SalesChartPoint {
  date: string; // YYYY-MM-DD
  displayDate: string; // Formatted for XAxis
  sales: number;
}
interface ChargebackChartPoint {
  date: string; // YYYY-MM-DD
  displayDate: string; // Formatted for XAxis
  rate: number;
}


export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [displayedDashboardData, setDisplayedDashboardData] = useState<CenterDashboardData>(defaultCenterData);
  const [adminSelectedCenterId, setAdminSelectedCenterId] = useState<string>('all');
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);

  const [dailySubmissionsForCard, setDailySubmissionsForCard] = useState<{current: number, previous: number} | null>(null);
  const [topAgentData, setTopAgentData] = useState<TopAgentMetric | null>(defaultCenterData.topAgentLastMonth || null);
  const [totalSubmittedLast30DaysValue, setTotalSubmittedLast30DaysValue] = useState<number>(0);

  // State for sample chart data
  const [salesChartData, setSalesChartData] = useState<SalesChartPoint[]>([]);
  const [chargebackChartData, setChargebackChartData] = useState<ChargebackChartPoint[]>([]);
  const [submissionsChartData, setSubmissionsChartData] = useState<{ 
    date: string; 
    displayDate: string; 
    submissions: number; 
  }[]>([]);
  const [chargebackRateData, setChargebackRateData] = useState<{
    date: string;
    displayDate: string;
    rate: number;
    totalEntries: number;
    chargebackEntries: number;
  }[]>([]);

  // State for flow through rate
  const [flowThroughStats, setFlowThroughStats] = useState<{
    totalEntries: number;
    targetEntries: number;
    achievement: number;
    trend: 'up' | 'down' | 'neutral';
  }>({
    totalEntries: 0,
    targetEntries: 100, // Example target, adjust as needed
    achievement: 0,
    trend: 'neutral'
  });

  // State for chargeback comparison data
  const [chargebackComparisonData, setChargebackComparisonData] = useState([
    { metric: 'Current Period', value: 0, entries: 'N/A' },
    { metric: 'Previous Period', value: 0, entries: 'N/A' },
    { metric: 'Industry Avg', value: 5.0, entries: 'Standard' }
  ]);
  const [chargebackComparisonStats, setChargebackComparisonStats] = useState<{
    currentPeriod: number;
    previousPeriod: number;
    industryAverage: number;
  }>({
    currentPeriod: 0,
    previousPeriod: 0,
    industryAverage: 5.0
  });


  const fixedDateRange = useMemo(() => {
    const toDate = new Date();
    const fromDate = subDays(toDate, FIXED_DATE_RANGE_DAYS - 1);
    return {
      to: toDate,
      from: fromDate,
    };
  }, []); 

  const fetchAndDisplayMetrics = useCallback(async (
    filterNameForCards: string | null,
    baseDataForUI: CenterDashboardData,
    uiCenterName: string
  ) => {
    console.log('[DashboardPage] fetchAndDisplayMetrics called. Cards Filter:', filterNameForCards, 'UI Name:', uiCenterName);
    setIsLoadingMetrics(true);
    
    try {
      // Get daily submissions and chargeback data
      const [dailySubmissionsResult, dailyChargebackResult] = await Promise.all([
        getDailySubmissionsInRange({ 
          leadVenderFilter: filterNameForCards,
          daysToLookBack: 31
        }),
        getDailyChargebackRate({
          leadVenderFilter: filterNameForCards,
          daysToLookBack: 31
        })
      ]);

      // Process daily submissions data for chart
      if (dailySubmissionsResult?.dailyStats && dailySubmissionsResult.dailyStats.length > 0) {
        const processedChartData = dailySubmissionsResult.dailyStats
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map(stat => ({
            date: stat.date,
            displayDate: formatDate(parseISO(stat.date), 'MMM d'),
            submissions: stat.count
          }));
        
        console.log('[DashboardPage] Processed chart data:', processedChartData);
        setSubmissionsChartData(processedChartData);
      } else {
        console.warn('[DashboardPage] No daily submissions data available');
        setSubmissionsChartData([]);
      }

      // Process chargeback rate data
      if (dailyChargebackResult?.dailyStats) {
        const processedChargebackData = dailyChargebackResult.dailyStats
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map(stat => ({
            date: stat.date,
            displayDate: formatDate(parseISO(stat.date), 'MMM d'),
            rate: stat.rate,
            totalEntries: stat.totalEntries,
            chargebackEntries: stat.chargebackEntries
          }));
        
        console.log('[DashboardPage] Processed chargeback data:', processedChargebackData);
        setChargebackRateData(processedChargebackData);
      }

      const [
        submissionsForTodayResult,
        submissionsForYesterdayResult,
        topAgentResult,
        entryStatsResult,
        chargebackResult,
        chargebackComparisonResult
      ] = await Promise.all([
        getDailySubmissions({ targetDate: formatDate(fixedDateRange.to, 'yyyy-MM-dd'), leadVenderFilter: filterNameForCards }),
        getDailySubmissions({ targetDate: formatDate(subDays(fixedDateRange.to, 1), 'yyyy-MM-dd'), leadVenderFilter: filterNameForCards }),
        getTopAgentLastMonth({ leadVenderFilter: filterNameForCards }),
        getEntryStatsByStatusForChart({ 
            leadVenderFilter: filterNameForCards, 
            daysToCover: FIXED_DATE_RANGE_DAYS 
        }),
        getTeamChargebackRate({ leadVenderFilter: filterNameForCards }),
        getChargebackComparison({ 
          leadVenderFilter: filterNameForCards,
          currentPeriodDays: FIXED_DATE_RANGE_DAYS
        })
      ]);

      setDailySubmissionsForCard({
        current: submissionsForTodayResult.submissionCount,
        previous: submissionsForYesterdayResult.submissionCount,
      });

      const newTopAgentData: TopAgentMetric = {
          id: 'topAgentLM',
          title: 'Top Agent (Last Month)',
          agentName: topAgentResult.agentName || "N/A",
          submissionCount: topAgentResult.submissionCount,
          icon: Award,
          description: `${topAgentResult.submissionCount} submissions last month.`
      };
      setTopAgentData(newTopAgentData);

      let submittedCountLast30Days = 0;
      const submittedStat = entryStatsResult.find((segment: ChartSegment) => segment.name === "Submitted");
      if (submittedStat) {
          submittedCountLast30Days = submittedStat.value;
      }
      setTotalSubmittedLast30DaysValue(submittedCountLast30Days);
      
      // Calculate flow through stats
      const totalEntries = entryStatsResult.reduce((sum, stat) => sum + stat.value, 0);
      const targetEntries = 100; // Adjust target as needed
      const achievement = (totalEntries / targetEntries) * 100;

      setFlowThroughStats({
        totalEntries,
        targetEntries,
        achievement: parseFloat(achievement.toFixed(1)),
        trend: achievement >= 80 ? 'up' : achievement >= 50 ? 'neutral' : 'down'
      });

      // Update chargeback comparison stats
      setChargebackComparisonStats({
        currentPeriod: parseFloat(chargebackComparisonResult.currentPeriod.rate.toFixed(2)),
        previousPeriod: parseFloat(chargebackComparisonResult.previousPeriod.rate.toFixed(2)),
        industryAverage: chargebackComparisonResult.industryAverage
      });

      // Update the chargebackComparisonData
      const newChargebackComparisonData = [
        { 
          metric: 'Current Period', 
          value: parseFloat(chargebackComparisonResult.currentPeriod.rate.toFixed(2)),
          entries: `${chargebackComparisonResult.currentPeriod.chargebackEntries}/${chargebackComparisonResult.currentPeriod.totalEntries}`
        },
        { 
          metric: 'Previous Period', 
          value: parseFloat(chargebackComparisonResult.previousPeriod.rate.toFixed(2)),
          entries: `${chargebackComparisonResult.previousPeriod.chargebackEntries}/${chargebackComparisonResult.previousPeriod.totalEntries}`
        },
        { 
          metric: 'Industry Avg', 
          value: chargebackComparisonResult.industryAverage,
          entries: 'Standard'
        }
      ];
      setChargebackComparisonData(newChargebackComparisonData);

      const fixedRangeTextShort = `Last ${FIXED_DATE_RANGE_DAYS}D`;

      setDisplayedDashboardData(prev => ({
        ...prev,
        centerName: uiCenterName,
        dailySales: { 
          ...baseDataForUI.dailySales, 
          title: `Daily Submissions (${formatDate(fixedDateRange.to, 'LLL d')})`,
          value: submissionsForTodayResult.submissionCount,
          previousValue: submissionsForYesterdayResult.submissionCount,
          trend: submissionsForTodayResult.submissionCount > submissionsForYesterdayResult.submissionCount ? 'up'
               : submissionsForTodayResult.submissionCount < submissionsForYesterdayResult.submissionCount ? 'down'
               : 'neutral',
          description: filterNameForCards ? `For ${filterNameForCards}` : `Total for today`,
        },
        chargebackPercentage: {
            ...baseDataForUI.chargebackPercentage,
            title: "Chargeback Rate (30 Days)",
            value: chargebackResult.chargebackRate.toFixed(2),
            unit: "%",
            trend: 'neutral',
            description: `${chargebackResult.submittedEntries} submitted out of ${chargebackResult.totalEntries} total entries`,
            icon: AlertCircle,
        }, 
        totalSubmittedLast30Days: {
            id: 'totalSubmitted30d',
            title: `Total Submitted (${fixedRangeTextShort})`,
            value: submittedCountLast30Days,
            unit: '', 
            trend: 'neutral', 
            icon: ClipboardList,
            description: `Total 'Submitted' entries in the last ${FIXED_DATE_RANGE_DAYS} days.`,
        },
      }));

      console.log(`[DashboardPage] Successfully updated UI data for: ${uiCenterName}. Total Submitted (30D from entryStats): ${submittedCountLast30Days}`);

    } catch (error) {
      console.error("[DashboardPage] Failed to fetch dynamic dashboard metrics:", error);
      setSubmissionsChartData([]);
      setChargebackRateData([]);
      toast({
        title: "Error Fetching Metrics",
        description: "Could not load all dynamic data. Displaying last known or default values.",
        variant: "destructive",
      });
      setDailySubmissionsForCard({current: 0, previous: 0});
      setTopAgentData(baseDataForUI.topAgentLastMonth || defaultCenterData.topAgentLastMonth!);
      setTotalSubmittedLast30DaysValue(0);
      setDisplayedDashboardData(prev => ({
        ...prev,
        centerName: uiCenterName,
        dailySales: { ...baseDataForUI.dailySales, value: 0, previousValue: 0, description: "Error loading live data." },
        chargebackPercentage: {
          ...baseDataForUI.chargebackPercentage,
          title: "Chargeback Rate (30 Days)",
          value: "0.00",
          unit: "%",
          trend: 'neutral',
          description: "Error loading chargeback data",
          icon: AlertCircle,
        },
        totalSubmittedLast30Days: { 
          ...(baseDataForUI.totalSubmittedLast30Days || defaultCenterData.totalSubmittedLast30Days!), 
          value: 0, 
          description: "Error loading live data."
        },
      }));
    } finally {
      setIsLoadingMetrics(false);
      console.log('[DashboardPage] fetchAndDisplayMetrics finished for:', uiCenterName);
    }
  }, [toast, fixedDateRange.to, fixedDateRange.from]);

  useEffect(() => {
    if (isAuthLoading) {
      setIsLoadingMetrics(true);
      return;
    }
    if (!user) {
        setIsLoadingMetrics(false);
        return;
    }

    console.log('[DashboardPage] User/AdminCenter change. User:', { role: user.role, teamNameForFilter: user.teamNameForFilter }, 'AdminCenter:', adminSelectedCenterId);

    let centerToLoad: AvailableCenter;
    let filterForMetricCards: string | null;

    if (user.role === 'admin') {
      centerToLoad = availableCentersForAdmin.find(c => c.id === adminSelectedCenterId) || availableCentersForAdmin[0];
      filterForMetricCards = centerToLoad.leadVenderFilterName;
    } else if (user.role === 'teamMember' && user.teamNameForFilter) {
      const teamConfig = availableCentersForAdmin.find(c => c.leadVenderFilterName === user.teamNameForFilter);
      centerToLoad = {
        id: user.teamNameForFilter.replace(/\s+/g, '-').toLowerCase(),
        name: user.teamNameForFilter,
        baseMockData: teamConfig ? teamConfig.baseMockData : defaultCenterData,
        leadVenderFilterName: user.teamNameForFilter
      };
      filterForMetricCards = user.teamNameForFilter;
    } else {
      centerToLoad = {
        id: 'general_user_view',
        name: 'Your Dashboard (General)',
        baseMockData: defaultCenterData,
        leadVenderFilterName: null
      };
      filterForMetricCards = null;
       if (user.role === 'teamMember' && !user.teamNameForFilter) {
        toast({
          title: "Data View Restricted",
          description: "Your account is not assigned to a specific team. Some metrics may not be available.",
          variant: "default",
        });
      }
    }
    fetchAndDisplayMetrics(filterForMetricCards, centerToLoad.baseMockData, centerToLoad.name);

  }, [user, isAuthLoading, adminSelectedCenterId, fetchAndDisplayMetrics, toast]);


  const handleAdminCenterChange = (newCenterId: string) => {
    console.log('[DashboardPage] Admin Center Change - New center selected:', newCenterId);
    setAdminSelectedCenterId(newCenterId);
  };

  if (isAuthLoading && isLoadingMetrics) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-foreground font-headline">Loading user and dashboard data...</p>
      </div>
    );
  }

  const pageTitle = displayedDashboardData.centerName || (user?.role === 'admin'
    ? (availableCentersForAdmin.find(c => c.id === adminSelectedCenterId)?.name || "Admin Dashboard")
    : (user?.teamNameForFilter ? `${user.teamNameForFilter} Dashboard` : "Team Dashboard"));

  const metricsToDisplay: CenterMetric[] = [
    displayedDashboardData.dailySales,
    displayedDashboardData.chargebackPercentage, 
  ];
  
  if (displayedDashboardData.totalSubmittedLast30Days) {
    metricsToDisplay.push(displayedDashboardData.totalSubmittedLast30Days);
  } else { 
     metricsToDisplay.push({
        id: 'totalSubmitted30d',
        title: `Total Submitted (Last ${FIXED_DATE_RANGE_DAYS}D)`,
        value: totalSubmittedLast30DaysValue, 
        unit: '',
        trend: 'neutral',
        icon: ClipboardList,
        description: `Total 'Submitted' entries in the last ${FIXED_DATE_RANGE_DAYS} days.`,
     });
  }

  if (topAgentData) {
     const topAgentCardMetric = {
        id: topAgentData.id,
        title: topAgentData.title,
        value: topAgentData.agentName || "N/A",
        unit: topAgentData.submissionCount > 0 ? ` (${topAgentData.submissionCount} subs)` : '',
        trend: 'neutral' as 'neutral', 
        icon: topAgentData.icon || Award,
        description: topAgentData.description || `${topAgentData.submissionCount} submissions last month`,
     };
     metricsToDisplay.push(topAgentCardMetric as any); 
  }

  const fixedRangeText = `Last ${FIXED_DATE_RANGE_DAYS} Days (${formatDate(fixedDateRange.from, "LLL d")} - ${formatDate(fixedDateRange.to, "LLL d")})`;

  const customTooltipFormatter = (value: number, name: string, props: any) => {
    const originalDate = props.payload?.date;
    // For sales and chargeback, use a more descriptive name
    let displayName = name;
    if (name === 'sales') displayName = 'Submissions';
    if (name === 'rate') displayName = 'Chargeback Rate (%)';
    return [`${value}`, displayName];
  };

  const customTooltipLabelFormatter = (label: string, payload: any[]) => {
    if (payload && payload.length > 0 && payload[0].payload.date) {
      return formatDate(parseISO(payload[0].payload.date), 'EEEE, MMM d, yyyy');
    }
    return label;
  };


  return (
    <div className="space-y-8">
      <Card className="shadow sticky top-[calc(theme(spacing.16)_+_1px)] md:top-[calc(theme(spacing.16)_+_1px)] z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <CardContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="font-headline text-2xl md:text-3xl font-bold text-primary flex items-center self-start md:self-center">
            {(isLoadingMetrics && isAuthLoading) && <Loader2 className="h-7 w-7 mr-2 animate-spin text-primary/70" />}
            {pageTitle}
          </h1>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {user?.role === 'admin' && (
                <Select value={adminSelectedCenterId} onValueChange={handleAdminCenterChange} disabled={isLoadingMetrics}>
                <SelectTrigger className="w-full sm:w-[220px] bg-input">
                    <SelectValue placeholder="Select Center View" />
                </SelectTrigger>
                <SelectContent>
                    {availableCentersForAdmin.map(center => (
                    <SelectItem key={center.id} value={center.id}>
                        {center.name}
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
            )}
            {user?.role === 'teamMember' && (
              <div className="flex items-center text-xs text-muted-foreground p-2 rounded-md bg-muted whitespace-nowrap">
                <Lock className="h-3 w-3 mr-1.5 text-primary" />
                {user.teamNameForFilter ? `Viewing data for ${user.teamNameForFilter}` : "Team View (Unassigned)"}
              </div>
            )}
            <div className="flex items-center text-sm p-2 rounded-md bg-input text-foreground border border-border">
                <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                Data for: {fixedRangeText}
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoadingMetrics && metricsToDisplay.every(m => (m.value === 0 || m.value === '...' || m.value === "N/A" || (typeof m.value === 'string' && parseFloat(m.value) === 0) )) ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
            {metricsToDisplay.map(m => (
              <Card key={m.id || Math.random()} className="h-40 shadow-md flex items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </Card>
            ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
            {metricsToDisplay.map((metric) => (
                <MetricCard key={metric.id} metric={metric} />
            ))}
          </div>
        </>
      )}

      {/* Submissions Chart Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
        <Card className="bg-card shadow-lg rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <TrendingUpIcon className="mr-2 h-5 w-5 text-primary" />
              Daily Submissions (Last 31 days)
            </CardTitle>
            <CardDescription>
              {user?.teamNameForFilter ? 
                `Daily submission volume trend for ${user.teamNameForFilter}` : 
                'Daily submission volume trend for all teams'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {submissionsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={submissionsChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="displayDate" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                    stroke="hsl(var(--border))"
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    stroke="hsl(var(--border))"
                  />
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [`${value} submissions`, 'Daily Submissions']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="submissions" 
                    name="Daily Submissions" 
                    stroke="hsl(var(--chart-1))" 
                    strokeWidth={2} 
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                {isLoadingMetrics ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin mr-2" /> 
                    Loading submissions data...
                  </>
                ) : (
                  <div className="text-center">
                    <AlertTriangleIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p>No submission data available for this period</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card shadow-lg rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
               <AlertCircle className="mr-2 h-5 w-5 text-destructive" />
              Daily Chargeback Rate (Last 31 days)
            </CardTitle>
            <CardDescription>
              {user?.teamNameForFilter ? 
                `Daily chargeback rate trend for ${user.teamNameForFilter}` : 
                'Daily chargeback rate trend for all teams'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
             {chargebackRateData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chargebackRateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="displayDate" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    stroke="hsl(var(--border))"
                  />
                  <YAxis 
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    stroke="hsl(var(--border))"
                  />
                   <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value}% (${props.payload.chargebackEntries}/${props.payload.totalEntries})`,
                      'Chargeback Rate'
                    ]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Line type="monotone" dataKey="rate" name="Chargeback Rate" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                {isLoadingMetrics ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin mr-2" /> 
                    Loading chargeback data...
                  </>
                ) : (
                  <div className="text-center">
                    <AlertTriangleIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p>No chargeback data available for this period</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Static Sales & Chargeback Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
        {/* Sales Performance */}
        <Card className="bg-card text-card-foreground shadow-xl rounded-lg">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-bold font-headline flex items-center text-foreground">
              <DollarSign className="mr-2 h-6 w-6 text-green-500" /> Flow Through Rate
            </h2>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Total Entries: <strong className="text-foreground">{flowThroughStats.totalEntries.toLocaleString()}</strong></li>
              <li>• Target Entries: <strong className="text-foreground">{flowThroughStats.targetEntries.toLocaleString()}</strong></li>
              <li>• Achievement: <strong className="text-foreground">{flowThroughStats.achievement}%</strong></li>
              <li>• Status: {flowThroughStats.trend === 'up' ? (
                <Check className="inline h-4 w-4 mr-1 text-green-500" />
              ) : flowThroughStats.trend === 'down' ? (
                <AlertTriangleIcon className="inline h-4 w-4 mr-1 text-destructive" />
              ) : (
                <AlertCircle className="inline h-4 w-4 mr-1 text-yellow-500" />
              )}
                <span className={`font-medium ${
                  flowThroughStats.trend === 'up' ? 'text-green-500' :
                  flowThroughStats.trend === 'down' ? 'text-destructive' :
                  'text-yellow-500'
                }`}>
                  {flowThroughStats.trend === 'up' ? 'On Track' :
                   flowThroughStats.trend === 'down' ? 'Below Target' :
                   'Needs Attention'}
                </span>
              </li>
            </ul>

            <div className="text-center mt-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Flow Through Progress</h3>
              <div className="flex justify-center items-center">
                <div className="w-[180px]"> {/* Fixed width container */}
                  <GaugeChart 
                    value={flowThroughStats.totalEntries} 
                    maxValue={flowThroughStats.targetEntries}
                    deficit={flowThroughStats.targetEntries - flowThroughStats.totalEntries}
                    size={180}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chargeback Analysis */}
        <Card className="bg-card text-card-foreground shadow-xl rounded-lg">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-xl font-bold font-headline flex items-center text-foreground">
              <ClipboardList className="mr-2 h-6 w-6 text-red-500" /> Chargeback Analysis
            </h2>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Selected Period: <strong className="text-foreground">{chargebackComparisonStats.currentPeriod}%</strong></li>
              <li>• Previous Period: <strong className="text-foreground">{chargebackComparisonStats.previousPeriod}%</strong></li>
              <li>• Industry Average: <strong className="text-foreground">{chargebackComparisonStats.industryAverage}%</strong></li>
              <li>• Performance: {chargebackComparisonStats.currentPeriod <= chargebackComparisonStats.industryAverage ? (
                <><Check className="inline h-4 w-4 mr-1 text-green-500" /> 
                  <span className="text-green-500 font-medium">Below Average (Good)</span>
                </>
              ) : (
                <><AlertTriangleIcon className="inline h-4 w-4 mr-1 text-destructive" /> 
                  <span className="text-destructive font-medium">Above Average (Action Needed)</span>
                </>
              )}</li>
            </ul>

            <div>
              <h3 className="text-lg font-semibold mt-4 text-foreground">Chargeback Comparison</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chargebackComparisonData} margin={{ top: 20, right: 0, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="metric" 
                    fontSize={10} 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                    stroke="hsl(var(--border))" 
                  />
                  <YAxis 
                    fontSize={10} 
                    tickFormatter={(value) => `${value}%`} 
                    tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                    stroke="hsl(var(--border))" 
                  />
                  <RechartsTooltip 
                    formatter={(value: any, name: any, props: any) => [
                      `${props.payload.value}% (${props.payload.entries})`,
                      props.payload.metric
                    ]}
                    cursor={{fill: 'hsl(var(--accent)/0.1)'}}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      borderColor: 'hsl(var(--border))', 
                      color: 'hsl(var(--popover-foreground))' 
                    }}
                    labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="hsl(var(--destructive))" 
                    radius={[4, 4, 0, 0]} 
                    barSize={40} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
        <Card className="bg-blue-900 text-white shadow-md rounded-xl hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <h3 className="text-md font-bold mb-2 flex items-center"><TrendingUpIcon className="mr-2 h-5 w-5"/> Sales Performance</h3>
            <p className="text-sm">Daily Sales: $7,673.95</p>
            <p className="text-sm">Trend: <AlertTriangleIcon className="inline h-4 w-4 mr-1 text-yellow-300"/> Needs Focus</p>
          </CardContent>
        </Card>

        <Card className="bg-lime-700 text-white shadow-md rounded-xl hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <h3 className="text-md font-bold mb-2 flex items-center"><Check className="mr-2 h-5 w-5"/> Chargeback Analysis</h3>
            <p className="text-sm">Selected Period: 0.0%</p>
            <p className="text-sm">Previous Period: 1.2%</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-700 text-white shadow-md rounded-xl hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <h3 className="text-md font-bold mb-2 flex items-center"><Award className="mr-2 h-5 w-5"/> Points Status</h3>
            <p className="text-sm">Total: 10 Points</p>
            <p className="text-sm">Data Source: Google Sheets</p>
          </CardContent>
        </Card>
      </div>


       {(user?.role === 'teamMember' && !user.teamNameForFilter && !isLoadingMetrics && !isAuthLoading) && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-600 dark:text-orange-400">
              <Info className="mr-2 h-5 w-5" /> Data View Restricted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Your account is not currently assigned to a specific team, so team-specific dashboard data cannot be displayed.
              Please contact an administrator if you believe this is an error.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}



