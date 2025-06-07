
"use client";

import type { CenterDashboardData, TopAgentMetric, ChartSegment, DateRange, DailyChartDataPoint, RateChartDataPoint } from '@/lib/types';
import { defaultCenterData, mockCenterData1, mockCenterData2 } from '@/lib/mock-data'; // Keep existing mocks for base structure
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

import { getDailySubmissions } from '@/ai/flows/get-daily-submissions-flow';
import { getTopAgentLastMonth } from '@/ai/flows/get-top-agent-last-month-flow';
import { getTotalPointsInRange } from '@/ai/flows/get-total-points-in-range-flow';
import { getDailySubmissionsInRange } from '@/ai/flows/get-daily-submissions-in-range-flow';
import { getDailyNegativeStatusRateInRange } from '@/ai/flows/get-daily-negative-status-rate-in-range-flow';

import { format as formatDate, subDays, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Users, ShieldCheck, Target, Award, CalendarDays, Sigma, BarChartHorizontalBig, LineChart as LineChartIcon } from 'lucide-react'; 
import MetricCard from '@/components/dashboard/MetricCard';
import DailySubmissionsBarChart from '@/components/dashboard/DailySubmissionsBarChart';
import DailyStatusRateLineChart from '@/components/dashboard/DailyStatusRateLineChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AvailableCenter {
  id: string;
  name: string;
  baseMockData: CenterDashboardData; // Base structure, dynamic values will override
  leadVenderFilterName: string | null;
}

const availableCentersForAdmin: AvailableCenter[] = [
  { id: 'all', name: 'All Teams (Admin View)', baseMockData: defaultCenterData, leadVenderFilterName: null },
  { id: 'team1_view', name: 'Team 1 View', baseMockData: mockCenterData1, leadVenderFilterName: 'Team 1' },
  { id: 'team2_view', name: 'Team 2 View', baseMockData: mockCenterData2, leadVenderFilterName: 'Team 2' },
  // Add more teams here if needed
];

export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [displayedDashboardData, setDisplayedDashboardData] = useState<CenterDashboardData>(defaultCenterData);
  const [adminSelectedCenterId, setAdminSelectedCenterId] = useState<string>('all');
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true); 
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29), // last 30 days including today
    to: new Date(),
  });

  // States for new metrics and charts
  const [totalPointsInRange, setTotalPointsInRange] = useState<number | null>(null);
  const [dailySubmissionsForCard, setDailySubmissionsForCard] = useState<{current: number, previous: number} | null>(null);
  const [dailySubmissionsChartData, setDailySubmissionsChartData] = useState<DailyChartDataPoint[]>([]);
  const [dailyNegativeRateChartData, setDailyNegativeRateChartData] = useState<RateChartDataPoint[]>([]);
  
  // States for static metrics (not affected by date range)
  const [topAgentData, setTopAgentData] = useState<TopAgentMetric | null>(defaultCenterData.topAgentLastMonth || null);
  // Chargeback % is also static for "Prev. Month" from mock for now

  const fetchAndDisplayMetrics = useCallback(async (
    filterName: string | null,
    baseDataForUI: CenterDashboardData, // Used for static parts like chargeback%
    uiCenterName: string,
    currentDateRange: DateRange | undefined
  ) => {
    console.log('[DashboardPage] fetchAndDisplayMetrics called. Filter:', filterName, 'UI Name:', uiCenterName, 'Date Range:', currentDateRange);
    setIsLoadingMetrics(true);

    if (!currentDateRange || !currentDateRange.from || !currentDateRange.to) {
      toast({ title: "Date Range Error", description: "Please select a valid date range.", variant: "destructive" });
      setIsLoadingMetrics(false);
      return;
    }

    const startDateStr = formatDate(currentDateRange.from, 'yyyy-MM-dd');
    const endDateStr = formatDate(currentDateRange.to, 'yyyy-MM-dd');
    const dayBeforeEndDateStr = formatDate(subDays(currentDateRange.to, 1), 'yyyy-MM-dd');


    try {
      const flowInput = { leadVenderFilter: filterName, startDate: startDateStr, endDate: endDateStr };
      
      // Fetch data for new metrics and charts
      const [
        totalPointsResult,
        dailySubmissionsInRangeResult,
        dailyNegativeRateResult,
        // Data for "Daily Submissions" card
        submissionsForLastDayResult,
        submissionsForDayBeforeLastDayResult,
        // Static data (fetched once or less frequently, but included here for unified loading state)
        topAgentResult,
      ] = await Promise.all([
        getTotalPointsInRange(flowInput),
        getDailySubmissionsInRange(flowInput),
        getDailyNegativeStatusRateInRange(flowInput),
        getDailySubmissions({ targetDate: endDateStr, leadVenderFilter: filterName }),
        getDailySubmissions({ targetDate: dayBeforeEndDateStr, leadVenderFilter: filterName }),
        getTopAgentLastMonth({ leadVenderFilter: filterName }),
      ]);
      
      console.log('[DashboardPage] API - Total Points:', totalPointsResult);
      console.log('[DashboardPage] API - Daily Submissions In Range:', dailySubmissionsInRangeResult);
      console.log('[DashboardPage] API - Daily Negative Rate:', dailyNegativeRateResult);
      console.log('[DashboardPage] API - Submissions for Last Day of Range:', submissionsForLastDayResult);
      console.log('[DashboardPage] API - Submissions for Day Before Last Day:', submissionsForDayBeforeLastDayResult);
      console.log('[DashboardPage] API - Top Agent:', topAgentResult);

      setTotalPointsInRange(totalPointsResult.totalPoints);
      setDailySubmissionsChartData(dailySubmissionsInRangeResult.dailySubmissions);
      setDailyNegativeRateChartData(dailyNegativeRateResult.dailyRates);

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

      // Update the parts of displayedDashboardData that are truly dynamic or depend on these fetches
      setDisplayedDashboardData(prev => ({
        ...prev, // Keep existing structure like mock chargeback %
        centerName: uiCenterName, 
        dailySales: { // This card is now for the "Last Day of Selected Range"
          ...prev.dailySales, // Keep icon etc. from base
          title: "Submissions (Last Day of Range)",
          value: submissionsForLastDayResult.submissionCount,
          previousValue: submissionsForDayBeforeLastDayResult.submissionCount,
          trend: submissionsForLastDayResult.submissionCount > submissionsForDayBeforeLastDayResult.submissionCount ? 'up' 
               : submissionsForLastDayResult.submissionCount < submissionsForDayBeforeLastDayResult.submissionCount ? 'down' 
               : 'neutral',
          description: filterName ? `For ${filterName} on ${endDateStr}` : `Total on ${endDateStr}`,
          unit: 'subs',
        },
        // Chargeback and Flow-through are from mock data in this setup currently
        // If they need to be dynamic, they'd need their own flows and state updates.
        // For now, they take their values from baseDataForUI which is derived from mocks.
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
      // Fallback to less dynamic data or zeros on error
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
  }, [toast]); 

  useEffect(() => {
    if (isAuthLoading) { 
      setIsLoadingMetrics(true); 
      return;
    }
    if (!user || !dateRange?.from || !dateRange?.to) {
        setIsLoadingMetrics(false);
        return;
    }

    console.log('[DashboardPage] User/DateRange change. User:', { role: user.role, teamNameForFilter: user.teamNameForFilter }, 'AdminCenter:', adminSelectedCenterId, 'DateRange:', dateRange);

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
        baseMockData: defaultCenterData,
        leadVenderFilterName: null
      };
       if (user.role === 'teamMember' && !user.teamNameForFilter) {
        toast({
          title: "Team Data Note",
          description: "Your account is not assigned to a specific team filter. Showing general data.",
          variant: "default",
        });
      }
    }
    fetchAndDisplayMetrics(centerToLoad.leadVenderFilterName, centerToLoad.baseMockData, centerToLoad.name, dateRange);

  }, [user, isAuthLoading, adminSelectedCenterId, dateRange, fetchAndDisplayMetrics, toast]);


  const handleAdminCenterChange = (newCenterId: string) => {
    console.log('[DashboardPage] Admin Center Change - New center selected:', newCenterId);
    setAdminSelectedCenterId(newCenterId); // This will trigger the useEffect
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
    displayedDashboardData.dailySales, // Now represents last day of range
    { // New "Total Points (Range)" card
      id: 'totalPointsRange',
      title: `Total Points (${dateRange?.from ? formatDate(dateRange.from, 'LLL d') : ''} - ${dateRange?.to ? formatDate(dateRange.to, 'LLL d') : ''})`,
      value: totalPointsInRange ?? (isLoadingMetrics ? '...' : 0),
      unit: 'points',
      trend: 'neutral' as 'neutral',
      icon: Sigma,
      description: 'Total "Submitted" entries in selected range.',
    },
    displayedDashboardData.chargebackPercentage, // Static: Prev. Month
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
                Team View Locked
              </div>
            )}
             <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className="w-full sm:w-[260px] justify-start text-left font-normal bg-input"
                    disabled={isLoadingMetrics}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {formatDate(dateRange.from, "LLL dd, y")} - {" "}
                          {formatDate(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        formatDate(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange} // This will trigger useEffect
                    numberOfMonths={2}
                    disabled={(date) => date > new Date() || date < new Date("2000-01-01")}
                  />
                </PopoverContent>
              </Popover>
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
            <CardDescription>Visualizing performance over the selected period: {dateRange?.from ? formatDate(dateRange.from, "PPP") : ""} - {dateRange?.to ? formatDate(dateRange.to, "PPP") : ""}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <DailySubmissionsBarChart 
                data={dailySubmissionsChartData} 
                isLoading={isLoadingMetrics}
                title="Daily Submissions Volume"
                description={`Total 'Submitted' entries per day for ${pageTitle}.`}
            />
            <DailyStatusRateLineChart 
                data={dailyNegativeRateChartData} 
                isLoading={isLoadingMetrics}
                title="Daily 'Rejected' Entry Rate"
                description={`Percentage of entries marked 'Rejected' each day for ${pageTitle}.`}
            />
        </CardContent>
      </Card>

    </div>
  );
}
