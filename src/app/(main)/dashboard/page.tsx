
"use client";

import type { CenterDashboardData, TopAgentMetric, ChartSegment, CenterMetric } from '@/lib/types';
import { defaultCenterData, mockCenterData1, mockCenterData2 } from '@/lib/mock-data';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { getDailySubmissions } from '@/ai/flows/get-daily-submissions-flow';
import { getTopAgentLastMonth } from '@/ai/flows/get-top-agent-last-month-flow';
import { getEntryStatsByStatusForChart } from '@/ai/flows/get-entry-stats-by-status-for-chart-flow';
// import { getTeamSubmissionsLast30Days } from '@/ai/flows/get-team-submissions-last-30-days-flow'; // Removed import


import { format as formatDate, subDays, isValid, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Award, CalendarDays, Info, ClipboardList, Users, Bug, Target } from 'lucide-react';
import MetricCard from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


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
const TEAM1_FILTER_NAME = "Team 1"; 

export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [displayedDashboardData, setDisplayedDashboardData] = useState<CenterDashboardData>(defaultCenterData);
  const [adminSelectedCenterId, setAdminSelectedCenterId] = useState<string>('all');
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);

  const [dailySubmissionsForCard, setDailySubmissionsForCard] = useState<{current: number, previous: number} | null>(null);
  const [topAgentData, setTopAgentData] = useState<TopAgentMetric | null>(defaultCenterData.topAgentLastMonth || null);
  const [totalSubmittedLast30DaysValue, setTotalSubmittedLast30DaysValue] = useState<number>(0);

  // Removed state variables for the debug card
  // const [debugLast30DaysSubmittedCount, setDebugLast30DaysSubmittedCount] = useState<number | null>(null);
  // const [debugFilterApplied, setDebugFilterApplied] = useState<string | null>(null);
  // const [debugDateRange, setDebugDateRange] = useState<{start: string, end: string} | null>(null);


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
    // Reset debug state not needed anymore
    // setDebugLast30DaysSubmittedCount(null); 

    const todayStr = formatDate(fixedDateRange.to, 'yyyy-MM-dd');
    const yesterdayStr = formatDate(subDays(fixedDateRange.to, 1), 'yyyy-MM-dd');

    try {
      const [
        submissionsForTodayResult,
        submissionsForYesterdayResult,
        topAgentResult,
        entryStatsResult,
        // debugSubmissionsResult, // Removed call to debug flow
      ] = await Promise.all([
        getDailySubmissions({ targetDate: todayStr, leadVenderFilter: filterNameForCards }),
        getDailySubmissions({ targetDate: yesterdayStr, leadVenderFilter: filterNameForCards }),
        getTopAgentLastMonth({ leadVenderFilter: filterNameForCards }),
        getEntryStatsByStatusForChart({ 
            leadVenderFilter: filterNameForCards, 
            daysToCover: FIXED_DATE_RANGE_DAYS 
        }),
        // getTeamSubmissionsLast30Days({ leadVenderFilter: filterNameForCards }), // Removed call
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
            title: "Placeholder Metric 1"
        }, 
        totalSubmittedLast30Days: {
            id: 'totalSubmitted30d',
            title: `Total Submitted (${fixedRangeTextShort})`,
            value: submittedCountLast30Days, // This uses the result from getEntryStatsByStatusForChart
            unit: '', 
            trend: 'neutral', 
            icon: ClipboardList,
            description: `Total 'Submitted' entries in the last ${FIXED_DATE_RANGE_DAYS} days.`,
        },
      }));

      // Removed debug logging for the removed flow
      // console.log(`[DashboardPage] Debug Flow Result - Last 30D Submitted Count for '${debugSubmissionsResult.filterApplied || 'All'}': ${debugSubmissionsResult.submissionCount} (Range: ${debugSubmissionsResult.startDate} - ${debugSubmissionsResult.endDate})`);
      // setDebugLast30DaysSubmittedCount(debugSubmissionsResult.submissionCount);
      // setDebugFilterApplied(debugSubmissionsResult.filterApplied);
      // setDebugDateRange({start: debugSubmissionsResult.startDate, end: debugSubmissionsResult.endDate });


      console.log(`[DashboardPage] Successfully updated UI data for: ${uiCenterName}. Total Submitted (30D from entryStats): ${submittedCountLast30Days}`);

    } catch (error) {
      console.error("[DashboardPage] Failed to fetch dynamic dashboard metrics:", error);
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
        chargebackPercentage: baseDataForUI.chargebackPercentage, 
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
  }, [toast, fixedDateRange.to, fixedDateRange.from]); // Added fixedDateRange.from as a dependency

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

      {/* Debug Card Removed */}
    </div>
  );
}

    