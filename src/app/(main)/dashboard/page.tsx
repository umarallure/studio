
"use client";

import CenterDashboardDisplay from '@/components/dashboard/CenterDashboardDisplay';
import { mockCenterData1, mockCenterData2, defaultCenterData, type CenterDashboardData } from '@/lib/mock-data';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDailySubmissions, type DailySubmissionsOutput } from '@/ai/flows/get-daily-submissions-flow';
import { format as formatDate, subDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock } from 'lucide-react';

interface AvailableCenter {
  id: string; // Unique ID for the Select component key
  name: string; // Display name in the Select component
  baseMockData: CenterDashboardData; // Base mock data structure
  leadVenderFilterName: string | null; // Name used in Sheet1Rows.LeadVender for filtering, null for all/admin
}

// These are options for the Admin role in the dropdown.
// Team members will have their view determined by their user.teamNameForFilter
const availableCentersForAdmin: AvailableCenter[] = [
  { id: 'all', name: 'All Teams (Admin View)', baseMockData: defaultCenterData, leadVenderFilterName: null },
  { id: 'team1_view', name: 'Team 1 View', baseMockData: mockCenterData1, leadVenderFilterName: 'Team 1' },
  { id: 'team2_view', name: 'Team 2 View', baseMockData: mockCenterData2, leadVenderFilterName: 'Team 2' },
  // Add other specific teams here if admins need to select them individually
  // e.g., { id: 'team3_view', name: 'Team 3 View', baseMockData: defaultCenterData, leadVenderFilterName: 'Team 3' },
];

export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  // State for the actual data being displayed (merged dynamic + mock)
  const [displayedDashboardData, setDisplayedDashboardData] = useState<CenterDashboardData>(defaultCenterData);
  // State for admin's selection from the dropdown
  const [adminSelectedCenterId, setAdminSelectedCenterId] = useState<string>('all');
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [lastFetchedSubmissions, setLastFetchedSubmissions] = useState<number | null>(null);


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
      console.log(`[DashboardPage] Fetching submissions for today (${todayStr}) and yesterday (${yesterdayStr}) for ${filterName || 'all teams'}`);
      const [todaySubmissionsResult, yesterdaySubmissionsResult] = await Promise.all([
        getDailySubmissions({ targetDate: todayStr, leadVenderFilter: filterName }),
        getDailySubmissions({ targetDate: yesterdayStr, leadVenderFilter: filterName })
      ]);
      
      console.log('[DashboardPage] API Response - Today:', todaySubmissionsResult);
      console.log('[DashboardPage] API Response - Yesterday:', yesterdaySubmissionsResult);

      const todayCount = todaySubmissionsResult.submissionCount;
      const yesterdayCount = yesterdaySubmissionsResult.submissionCount;
      setLastFetchedSubmissions(todayCount);

      const updatedData: CenterDashboardData = {
        ...baseDataForUI, 
        centerName: uiCenterName, 
        dailySales: {
          ...baseDataForUI.dailySales, 
          value: todayCount,
          previousValue: yesterdayCount,
          trend: todayCount > yesterdayCount ? 'up' : todayCount < yesterdayCount ? 'down' : 'neutral',
          description: filterName 
            ? `Submissions for ${filterName} today.` 
            : 'Total submissions today across all teams.',
        },
      };
      setDisplayedDashboardData(updatedData);
      console.log('[DashboardPage] Successfully updated UI data for:', uiCenterName);

    } catch (error) {
      console.error("[DashboardPage] Failed to fetch dynamic dashboard metrics:", error);
      toast({
        title: "Error Fetching Metrics",
        description: "Could not load dynamic submission data. Displaying last known or default values.",
        variant: "destructive",
      });
      const fallbackData: CenterDashboardData = {
        ...baseDataForUI,
        centerName: uiCenterName,
        dailySales: {
            ...baseDataForUI.dailySales,
            value: lastFetchedSubmissions !== null ? lastFetchedSubmissions : baseDataForUI.dailySales.value,
            description: "Error fetching live data. Displaying cached/default.",
        }
      }
      setDisplayedDashboardData(fallbackData);
    } finally {
      setIsLoadingMetrics(false);
      console.log('[DashboardPage] fetchAndDisplayMetrics finished for:', uiCenterName);
    }
  }, [toast]);

  // Effect to determine which data to load based on user role and selection
  useEffect(() => {
    if (isAuthLoading || !user) return; // Wait for user auth to resolve

    if (user.role === 'admin') {
      const selectedAdminOption = availableCentersForAdmin.find(c => c.id === adminSelectedCenterId) || availableCentersForAdmin[0];
      fetchAndDisplayMetrics(selectedAdminOption.leadVenderFilterName, selectedAdminOption.baseMockData, selectedAdminOption.name);
    } else if (user.role === 'teamMember') {
      if (user.teamNameForFilter) {
        // Try to find a matching mock data config for the specific team member's view.
        // For dashboard purposes, a team member often has a standard dashboard structure,
        // so we might use a default or a specific team's mock data as a base.
        // Here, we'll try to find a config from 'availableCentersForAdmin' that matches the team filter,
        // or fall back to default.
        const teamConfig = availableCentersForAdmin.find(c => c.leadVenderFilterName === user.teamNameForFilter);
        const baseData = teamConfig ? teamConfig.baseMockData : defaultCenterData;
        const displayName = user.teamNameForFilter; // Display their actual team name
        fetchAndDisplayMetrics(user.teamNameForFilter, baseData, displayName);
      } else {
        // Team member with no specific teamNameForFilter - show default/all (or could be an error/restricted view)
        fetchAndDisplayMetrics(null, defaultCenterData, "Your Dashboard (General)");
         toast({
          title: "Team Data Note",
          description: "Your account is not assigned to a specific team filter for the dashboard. Showing general data.",
          variant: "default",
        });
      }
    }
  }, [user, isAuthLoading, adminSelectedCenterId, fetchAndDisplayMetrics, toast]);


  const handleAdminCenterChange = (newCenterId: string) => {
    console.log('[DashboardPage] Admin Center Change - New center selected:', newCenterId);
    setAdminSelectedCenterId(newCenterId);
  };
  
  if (isAuthLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-foreground font-headline">Loading user data...</p>
      </div>
    );
  }

  const pageTitle = user?.role === 'admin'
    ? (availableCentersForAdmin.find(c => c.id === adminSelectedCenterId)?.name || "Admin Dashboard")
    : (user?.teamNameForFilter ? `${user.teamNameForFilter} Dashboard` : "Team Dashboard");

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-card rounded-lg shadow">
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary flex items-center">
          {(isLoadingMetrics || isAuthLoading) && <Loader2 className="h-8 w-8 mr-3 animate-spin text-primary/70" />}
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
      {(isLoadingMetrics && !lastFetchedSubmissions && displayedDashboardData.dailySales.value === 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => (
              <div key={i} className="h-32 bg-card rounded-lg shadow-md flex items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            ))}
        </div>
      )}
      {(!isLoadingMetrics || (isLoadingMetrics && lastFetchedSubmissions !== null) || isAuthLoading) && 
        <CenterDashboardDisplay data={displayedDashboardData} />
      }
    </div>
  );
}
