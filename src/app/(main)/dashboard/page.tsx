
"use client";

import CenterDashboardDisplay from '@/components/dashboard/CenterDashboardDisplay';
import EntryStatusChart from '@/components/dashboard/EntryStatusChart';
import { mockCenterData1, mockCenterData2, defaultCenterData, type CenterDashboardData, type TopAgentMetric, type ChartSegment } from '@/lib/mock-data';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDailySubmissions } from '@/ai/flows/get-daily-submissions-flow';
import { getTopAgentLastMonth } from '@/ai/flows/get-top-agent-last-month-flow';
import { getEntryStatsByStatusForChart } from '@/ai/flows/get-entry-stats-by-status-for-chart-flow';
import { format as formatDate, subDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Users, ShieldCheck, Target, Award } from 'lucide-react'; 
import MetricCard from '@/components/dashboard/MetricCard'; 

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

const initialChartConfig = { 
  statuses: {
    label: "Statuses",
  },
};


export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [displayedDashboardData, setDisplayedDashboardData] = useState<CenterDashboardData>(defaultCenterData);
  const [adminSelectedCenterId, setAdminSelectedCenterId] = useState<string>('all');
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true); 
  const [lastFetchedSubmissions, setLastFetchedSubmissions] = useState<number | null>(null);
  const [topAgentData, setTopAgentData] = useState<TopAgentMetric | null>(defaultCenterData.topAgentLastMonth || null);
  const [entryStatusChartData, setEntryStatusChartData] = useState<ChartSegment[]>([]);


  const fetchAndDisplayMetrics = useCallback(async (
    filterName: string | null,
    baseDataForUI: CenterDashboardData,
    uiCenterName: string
  ) => {
    console.log('[DashboardPage] fetchAndDisplayMetrics called for filter:', filterName, 'UI Name:', uiCenterName);
    setIsLoadingMetrics(true);
    const todayStr = formatDate(new Date(), 'yyyy-MM-dd');
    const yesterdayStr = formatDate(subDays(new Date(), 1), 'yyyy-MM-dd');

    try {
      const [
        dailySubmissionsResult,
        yesterdaySubmissionsResult,
        topAgentResult,
        chartStatsResult
      ] = await Promise.all([
        getDailySubmissions({ targetDate: todayStr, leadVenderFilter: filterName }),
        getDailySubmissions({ targetDate: yesterdayStr, leadVenderFilter: filterName }),
        getTopAgentLastMonth({ leadVenderFilter: filterName }),
        getEntryStatsByStatusForChart({ leadVenderFilter: filterName, daysToCover: 30 })
      ]);
      
      console.log('[DashboardPage] API Response - Today Submissions:', dailySubmissionsResult);
      console.log('[DashboardPage] API Response - Yesterday Submissions:', yesterdaySubmissionsResult);
      console.log('[DashboardPage] API Response - Top Agent:', topAgentResult);
      console.log('[DashboardPage] API Response - Chart Stats:', chartStatsResult);

      const todayCount = dailySubmissionsResult.submissionCount;
      const yesterdayCount = yesterdaySubmissionsResult.submissionCount;
      setLastFetchedSubmissions(todayCount);
      
      const newTopAgentData: TopAgentMetric = {
          id: 'topAgentLM',
          title: 'Top Agent (Last Month)',
          agentName: topAgentResult.agentName || "N/A",
          submissionCount: topAgentResult.submissionCount,
          icon: Award,
          description: `${topAgentResult.submissionCount} submissions last month.`
      };
      setTopAgentData(newTopAgentData);
      setEntryStatusChartData(chartStatsResult);

      const updatedData: CenterDashboardData = {
        ...baseDataForUI,
        centerName: uiCenterName,
        dailySales: {
          ...baseDataForUI.dailySales,
          value: todayCount,
          previousValue: yesterdayCount,
          trend: todayCount > yesterdayCount ? 'up' : todayCount < yesterdayCount ? 'down' : 'neutral',
          description: filterName ? `Submissions for ${filterName} today.` : 'Total submissions today across all teams.',
        },
      };
      setDisplayedDashboardData(updatedData); 
      console.log('[DashboardPage] Successfully updated UI data for:', uiCenterName);

    } catch (error) {
      console.error("[DashboardPage] Failed to fetch dynamic dashboard metrics:", error);
      toast({
        title: "Error Fetching Metrics",
        description: "Could not load all dynamic data. Displaying last known or default values for some metrics.",
        variant: "destructive",
      });
      
      setDisplayedDashboardData({
        ...baseDataForUI,
        centerName: uiCenterName,
        dailySales: {
            ...baseDataForUI.dailySales,
            value: lastFetchedSubmissions !== null ? lastFetchedSubmissions : (baseDataForUI.dailySales.value || 0),
            description: "Error fetching live data. Displaying cached/default.",
        }
      });
      setTopAgentData(baseDataForUI.topAgentLastMonth || defaultCenterData.topAgentLastMonth!);
      setEntryStatusChartData(baseDataForUI.entryStatusChartData || []);
    } finally {
      setIsLoadingMetrics(false);
      console.log('[DashboardPage] fetchAndDisplayMetrics finished for:', uiCenterName);
    }
  }, [toast]); 

  useEffect(() => {
    if (isAuthLoading || !user) {
      setIsLoadingMetrics(true); 
      return;
    }

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
    displayedDashboardData.chargebackPercentage,
    displayedDashboardData.flowThroughRate,
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
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-card rounded-lg shadow">
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary flex items-center">
          {(isLoadingMetrics) && <Loader2 className="h-8 w-8 mr-3 animate-spin text-primary/70" />}
          {pageTitle}
        </h1>
        {user?.role === 'admin' && ( 
            <Select value={adminSelectedCenterId} onValueChange={handleAdminCenterChange} disabled={isLoadingMetrics}>
            <SelectTrigger className="w-full sm:w-[280px] bg-background">
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
          <div className="flex items-center text-sm text-muted-foreground p-2 rounded-md bg-muted">
            <Lock className="h-4 w-4 mr-2 text-primary" />
            Team View Locked
          </div>
        )}
      </div>
      
      {isLoadingMetrics && metricsToDisplay.every(m => m.value === 0 || m.value === "N/A") && (!topAgentData || topAgentData.submissionCount === 0) && entryStatusChartData.length === 0 ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-40 bg-card rounded-lg shadow-md flex items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {metricsToDisplay.map((metric) => (
                <MetricCard key={metric.id} metric={metric} />
            ))}
          </div>
          <div className="mt-8">
            <EntryStatusChart 
                chartData={entryStatusChartData} 
                chartConfig={initialChartConfig} 
                title="Entry Status Breakdown"
                description="Distribution of all entry statuses in the last 30 days."
            />
          </div>
        </>
      )}
    </div>
  );
}
