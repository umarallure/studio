
"use client";

import CenterDashboardDisplay from '@/components/dashboard/CenterDashboardDisplay';
import { mockCenterData1, mockCenterData2, defaultCenterData, type CenterDashboardData } from '@/lib/mock-data';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDailySubmissions, type DailySubmissionsOutput } from '@/ai/flows/get-daily-submissions-flow'; // Import the Genkit flow
import { format as formatDate, subDays } from 'date-fns'; // For date formatting
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface AvailableCenter {
  id: string;
  name: string;
  data: CenterDashboardData; // Base mock data
  leadVenderFilterName: string | null; // Name used in Sheet1Rows.LeadVender for filtering
}

const availableCenters: AvailableCenter[] = [
  { id: 'center1', name: 'Alpha Ops HQ', data: mockCenterData1, leadVenderFilterName: 'Alpha Team' }, // Example, adjust to actual LeadVender names
  { id: 'center2', name: 'Bravo Solutions Hub', data: mockCenterData2, leadVenderFilterName: 'Bravo Team' }, // Example
  { id: 'default', name: 'Your Center (All)', data: defaultCenterData, leadVenderFilterName: null } // Null means no filter / all teams
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCenterUIData, setSelectedCenterUIData] = useState<CenterDashboardData>(defaultCenterData);
  const [currentCenterId, setCurrentCenterId] = useState<string>(user?.centerId || 'default');
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [lastFetchedSubmissions, setLastFetchedSubmissions] = useState<number | null>(null);

  const fetchAndUpdateDashboardMetrics = useCallback(async (center: AvailableCenter) => {
    setIsLoadingMetrics(true);
    const todayStr = formatDate(new Date(), 'yyyy-MM-dd');
    // For "previousValue" of daily submissions, let's fetch yesterday's.
    const yesterdayStr = formatDate(subDays(new Date(), 1), 'yyyy-MM-dd');

    try {
      const [todaySubmissionsResult, yesterdaySubmissionsResult] = await Promise.all([
        getDailySubmissions({ targetDate: todayStr, leadVenderFilter: center.leadVenderFilterName }),
        getDailySubmissions({ targetDate: yesterdayStr, leadVenderFilter: center.leadVenderFilterName })
      ]);
      
      const todayCount = todaySubmissionsResult.submissionCount;
      const yesterdayCount = yesterdaySubmissionsResult.submissionCount;
      setLastFetchedSubmissions(todayCount);

      // Create new data, merging dynamic submissions with base mock data for the center
      const updatedData: CenterDashboardData = {
        ...center.data, // Start with the base mock data for the selected center
        centerName: center.name, // Ensure center name is correct
        dailySales: {
          ...center.data.dailySales, // Keep icon, title, unit, description from mock
          value: todayCount,
          previousValue: yesterdayCount,
          trend: todayCount > yesterdayCount ? 'up' : todayCount < yesterdayCount ? 'down' : 'neutral',
          description: center.leadVenderFilterName 
            ? `Submissions for ${center.leadVenderFilterName} today.` 
            : 'Total submissions today across all centers.',
        },
        // chargebackPercentage and flowThroughRate will still come from center.data (mock)
      };
      setSelectedCenterUIData(updatedData);

    } catch (error) {
      console.error("Failed to fetch dynamic dashboard metrics:", error);
      toast({
        title: "Error Fetching Metrics",
        description: "Could not load dynamic submission data. Displaying last known or default values.",
        variant: "destructive",
      });
      // Fallback to base mock data if API fails
      const fallbackData: CenterDashboardData = {
        ...center.data,
        centerName: center.name,
        dailySales: {
            ...center.data.dailySales,
            value: lastFetchedSubmissions !== null ? lastFetchedSubmissions : center.data.dailySales.value, // Show last fetched if available
            description: "Error fetching live data. Displaying cached/default.",
        }
      }
      setSelectedCenterUIData(fallbackData);
    } finally {
      setIsLoadingMetrics(false);
    }
  }, [toast, lastFetchedSubmissions]);

  useEffect(() => {
    const activeCenterId = user?.centerId || currentCenterId || 'default';
    setCurrentCenterId(activeCenterId);
    const centerToLoad = availableCenters.find(c => c.id === activeCenterId) || availableCenters.find(c => c.id === 'default')!;
    fetchAndUpdateDashboardMetrics(centerToLoad);
  }, [user, fetchAndUpdateDashboardMetrics, currentCenterId]); // currentCenterId added to refetch on manual change

  const handleCenterChange = (newCenterId: string) => {
    setCurrentCenterId(newCenterId); // This will trigger the useEffect above
  };
  
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-card rounded-lg shadow">
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary flex items-center">
          {isLoadingMetrics && <Loader2 className="h-8 w-8 mr-3 animate-spin text-primary/70" />}
          {selectedCenterUIData.centerName || "Center Dashboard"}
        </h1>
        {/* Removed !user?.centerId condition to always show selector if multiple centers exist */}
        {availableCenters.length > 1 && ( 
            <Select value={currentCenterId} onValueChange={handleCenterChange} disabled={isLoadingMetrics}>
            <SelectTrigger className="w-full sm:w-[280px] bg-background">
                <SelectValue placeholder="Select Center" />
            </SelectTrigger>
            <SelectContent>
                {availableCenters.map(center => (
                <SelectItem key={center.id} value={center.id}>
                    {center.name}
                </SelectItem>
                ))}
            </SelectContent>
            </Select>
        )}
      </div>
      {isLoadingMetrics && selectedCenterUIData.dailySales.value === 0 && ( // Show skeleton or minimal loading state if initial load with 0
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Placeholder for loading state, or you can show a more detailed skeleton */}
            <div className="h-32 bg-card rounded-lg shadow-md flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
            <div className="h-32 bg-card rounded-lg shadow-md flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
            <div className="h-32 bg-card rounded-lg shadow-md flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        </div>
      )}
      {!isLoadingMetrics && <CenterDashboardDisplay data={selectedCenterUIData} />}
    </div>
  );
}
