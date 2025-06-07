
"use client";

import type { CenterDashboardData, TopAgentMetric, DailyChartDataPoint, RateChartDataPoint } from '@/lib/types';
import { defaultCenterData, mockCenterData1, mockCenterData2 } from '@/lib/mock-data';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

import { getDailySubmissions } from '@/ai/flows/get-daily-submissions-flow';
import { getTopAgentLastMonth } from '@/ai/flows/get-top-agent-last-month-flow';
import { getTotalPointsInRange } from '@/ai/flows/get-total-points-in-range-flow';
import { getDailySubmissionsInRange } from '@/ai/flows/get-daily-submissions-in-range-flow';
import { getDailyNegativeStatusRateInRange } from '@/ai/flows/get-daily-negative-status-rate-in-range-flow';

import { format as formatDate, subDays, isValid, parseISO } from 'date-fns'; 
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Sigma, Award, CalendarDays, Info } from 'lucide-react'; 
import MetricCard from '@/components/dashboard/MetricCard';
import DailySubmissionsBarChart from '@/components/dashboard/DailySubmissionsBarChart';
import DailyStatusRateLineChart from '@/components/dashboard/DailyStatusRateLineChart';
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

export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [displayedDashboardData, setDisplayedDashboardData] = useState<CenterDashboardData>(defaultCenterData);
  const [adminSelectedCenterId, setAdminSelectedCenterId] = useState<string>('all');
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true); 
  
  const [totalPointsInRange, setTotalPointsInRange] = useState<number | null>(null);
  const [dailySubmissionsForCard, setDailySubmissionsForCard] = useState<{current: number, previous: number} | null>(null);
  const [dailySubmissionsChartData, setDailySubmissionsChartData] = useState<DailyChartDataPoint[]>([]);
  const [dailyNegativeRateChartData, setDailyNegativeRateChartData] = useState<RateChartDataPoint[]>([]);
  
  const [topAgentData, setTopAgentData] = useState<TopAgentMetric | null>(defaultCenterData.topAgentLastMonth || null);
  
  const fixedDateRange = {
    to: new Date(),
    from: subDays(new Date(), FIXED_DATE_RANGE_DAYS - 1),
  };

  const fetchAndDisplayMetrics = useCallback(async (
    filterName: string | null,
    baseDataForUI: CenterDashboardData, 
    uiCenterName: string
  ) => {
    console.log('[DashboardPage] fetchAndDisplayMetrics called. Filter:', filterName, 'UI Name:', uiCenterName);
    setIsLoadingMetrics(true);

    const startDateStr = formatDate(fixedDateRange.from, 'yyyy-MM-dd');
    const endDateStr = formatDate(fixedDateRange.to, 'yyyy-MM-dd');
    const dayBeforeEndDateStr = formatDate(subDays(fixedDateRange.to, 1), 'yyyy-MM-dd');

    try {
      const flowInput = { leadVenderFilter: filterName, startDate: startDateStr, endDate: endDateStr };
      
      const [
        totalPointsResult,
        dailySubmissionsInRangeResult,
        dailyNegativeRateResult,
        submissionsForLastDayResult,
        submissionsForDayBeforeLastDayResult,
        topAgentResult,
      ] = await Promise.all([
        getTotalPointsInRange(flowInput),
        getDailySubmissionsInRange(flowInput),
        getDailyNegativeStatusRateInRange(flowInput),
        getDailySubmissions({ targetDate: endDateStr, leadVenderFilter: filterName }),
        getDailySubmissions({ targetDate: dayBeforeEndDateStr, leadVenderFilter: filterName }),
        getTopAgentLastMonth({ leadVenderFilter: filterName }),
      ]);
      
      console.log('[DashboardPage] API - Total Points (Fixed Range):', totalPointsResult);
      console.log('[DashboardPage] API - Daily Submissions In Range (Fixed Range):', dailySubmissionsInRangeResult);
      setTotalPointsInRange(totalPointsResult.totalPoints);

      // Validate and filter dailySubmissionsInRangeResult
      const validDailySubmissions = dailySubmissionsInRangeResult.dailySubmissions.filter(
        dp => dp.date && isValid(parseISO(dp.date)) && typeof dp.count === 'number'
      );
      setDailySubmissionsChartData(validDailySubmissions);
      console.log('[DashboardPage] API - Validated Daily Submissions for Chart:', validDailySubmissions.length, 'items');


      const validNegativeRates = dailyNegativeRateResult.dailyRates.filter(
        dp => dp.date && isValid(parseISO(dp.date)) && typeof dp.rate === 'number'
      );
      setDailyNegativeRateChartData(validNegativeRates);

      setDailySubmissionsForCard({
        current: submissionsForLastDayResult.submissionCount,
        previous: submissionsForDayBeforeLastDayResult.submissionCount,
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

      setDisplayedDashboardData(prev => ({
        ...prev, 
        centerName: uiCenterName, 
        dailySales: { 
          ...prev.dailySales, 
          title: `Submissions (${formatDate(fixedDateRange.to, 'LLL d')})`, 
          value: submissionsForLastDayResult.submissionCount,
          previousValue: submissionsForDayBeforeLastDayResult.submissionCount,
          trend: submissionsForLastDayResult.submissionCount > submissionsForDayBeforeLastDayResult.submissionCount ? 'up' 
               : submissionsForLastDayResult.submissionCount < submissionsForDayBeforeLastDayResult.submissionCount ? 'down' 
               : 'neutral',
          description: filterName ? `For ${filterName} on ${endDateStr}` : `Total on ${endDateStr}`,
          unit: 'subs',
        },
        chargebackPercentage: baseDataForUI.chargebackPercentage,
        flowThroughRate: baseDataForUI.flowThroughRate,
      })); 
      
      console.log('[DashboardPage] Successfully updated UI data for:', uiCenterName);

    } catch (error) {
      console.error("[DashboardPage] Failed to fetch dynamic dashboard metrics:", error);
      toast({
        title: "Error Fetching Metrics",
        description: "Could not load all dynamic data. Displaying last known or default values.",
        variant: "destructive",
      });
      setTotalPointsInRange(0);
      setDailySubmissionsChartData([]);
      setDailyNegativeRateChartData([]);
      setDailySubmissionsForCard({current: 0, previous: 0});
      setTopAgentData(baseDataForUI.topAgentLastMonth || defaultCenterData.topAgentLastMonth!);
       setDisplayedDashboardData(prev => ({
        ...prev,
        centerName: uiCenterName,
        dailySales: { ...baseDataForUI.dailySales, value: 0, previousValue: 0, description: "Error loading live data." },
        chargebackPercentage: baseDataForUI.chargebackPercentage,
        flowThroughRate: baseDataForUI.flowThroughRate,
      }));
    } finally {
      setIsLoadingMetrics(false);
      console.log('[DashboardPage] fetchAndDisplayMetrics finished for:', uiCenterName);
    }
  }, [toast, fixedDateRange.from, fixedDateRange.to]); 

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

    if (user.role === 'admin') {
      centerToLoad = availableCentersForAdmin.find(c => c.id === adminSelectedCenterId) || availableCentersForAdmin[0];
    } else if (user.role === 'teamMember' && user.teamNameForFilter) {
      const teamConfig = availableCentersForAdmin.find(c => c.leadVenderFilterName === user.teamNameForFilter);
      centerToLoad = {
        id: user.teamNameForFilter.replace(/\s+/g, '-').toLowerCase(), 
        name: user.teamNameForFilter,
        baseMockData: teamConfig ? teamConfig.baseMockData : defaultCenterData,
        leadVenderFilterName: user.teamNameForFilter
      };
    } else { 
      centerToLoad = {
        id: 'general_user_view',
        name: 'Your Dashboard (General)',
        baseMocData: defaultCenterData,
        leadVenderFilterName: null
      };
       if (user.role === 'teamMember' && !user.teamNameForFilter) {
        setDailySubmissionsChartData([]); // Clear chart data if no team filter
        setDailyNegativeRateChartData([]);
        toast({
          title: "Data View Restricted",
          description: "Your account is not assigned to a specific team. Some metrics may not be available.",
          variant: "default",
        });
      }
    }
    fetchAndDisplayMetrics(centerToLoad.leadVenderFilterName, centerToLoad.baseMockData, centerToLoad.name);

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

  const metricsToDisplay = [
    displayedDashboardData.dailySales, 
    { 
      id: 'totalPointsRange',
      title: `Total Points (Last ${FIXED_DATE_RANGE_DAYS} Days)`,
      value: totalPointsInRange ?? (isLoadingMetrics ? '...' : 0),
      unit: 'points',
      trend: 'neutral' as 'neutral',
      icon: Sigma,
      description: `Total 'Submitted' entries in the last ${FIXED_DATE_RANGE_DAYS} days.`,
    },
    displayedDashboardData.chargebackPercentage,
  ];
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
      
      {isLoadingMetrics && metricsToDisplay.every(m => m.value === 0 || m.value === '...' || m.value === "N/A") ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
            {[1,2,3,4].map(i => (
              <Card key={i} className="h-40 shadow-md flex items-center justify-center">
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

      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">Charts & Trends</CardTitle>
            <CardDescription>Visualizing performance over the last {FIXED_DATE_RANGE_DAYS} days for {pageTitle}: {fixedRangeText}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <DailySubmissionsBarChart 
                data={dailySubmissionsChartData} 
                isLoading={isLoadingMetrics}
                title="Daily Submissions Volume"
                description={`Total 'Submitted' entries per day.`}
            />
            <DailyStatusRateLineChart 
                data={dailyNegativeRateChartData} 
                isLoading={isLoadingMetrics}
                title="Daily 'Rejected' Entry Rate"
                description={`Percentage of entries marked 'Rejected' each day.`}
            />
        </CardContent>
      </Card>
       {(user?.role === 'teamMember' && !user.teamNameForFilter && !isLoadingMetrics && !isAuthLoading) && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-600 dark:text-orange-400">
              <Info className="mr-2 h-5 w-5" /> Data View Restricted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Your account is not currently assigned to a specific team, so team-specific dashboard data (including charts) cannot be displayed. 
              Please contact an administrator if you believe this is an error.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

    
