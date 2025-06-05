
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
  const [currentCenterId, setCurrentCenterId] = useState<string>('default');
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [lastFetchedSubmissions, setLastFetchedSubmissions] = useState<number | null>(null);

  const fetchAndUpdateDashboardMetrics = useCallback(async (center: AvailableCenter) => {
    console.log('[DashboardPage] fetchAndUpdateDashboardMetrics called for center:', center.name);
    setIsLoadingMetrics(true);
    const todayStr = formatDate(new Date(), 'yyyy-MM-dd');
    const yesterdayStr = formatDate(subDays(new Date(), 1), 'yyyy-MM-dd');

    try {
      console.log(`[DashboardPage] Fetching submissions for today (${todayStr}) and yesterday (${yesterdayStr}) for ${center.leadVenderFilterName || 'all teams'}`);
      const [todaySubmissionsResult, yesterdaySubmissionsResult] = await Promise.all([
        getDailySubmissions({ targetDate: todayStr, leadVenderFilter: center.leadVenderFilterName }),
        getDailySubmissions({ targetDate: yesterdayStr, leadVenderFilter: center.leadVenderFilterName })
      ]);
      
      console.log('[DashboardPage] API Response - Today:', todaySubmissionsResult);
      console.log('[DashboardPage] API Response - Yesterday:', yesterdaySubmissionsResult);

      const todayCount = todaySubmissionsResult.submissionCount;
      const yesterdayCount = yesterdaySubmissionsResult.submissionCount;
      setLastFetchedSubmissions(todayCount);

      const updatedData: CenterDashboardData = {
        ...center.data, 
        centerName: center.name, 
        dailySales: {
          ...center.data.dailySales, 
          value: todayCount,
          previousValue: yesterdayCount,
          trend: todayCount > yesterdayCount ? 'up' : todayCount < yesterdayCount ? 'down' : 'neutral',
          description: center.leadVenderFilterName 
            ? `Submissions for ${center.leadVenderFilterName} today.` 
            : 'Total submissions today across all teams.',
        },
      };
      setSelectedCenterUIData(updatedData);
      console.log('[DashboardPage] Successfully updated UI data.');

    } catch (error) {
      console.error("[DashboardPage] Failed to fetch dynamic dashboard metrics:", error);
      toast({
        title: "Error Fetching Metrics",
        description: "Could not load dynamic submission data. Displaying last known or default values.",
        variant: "destructive",
      });
      const fallbackData: CenterDashboardData = {
        ...center.data,
        centerName: center.name,
        dailySales: {
            ...center.data.dailySales,
            value: lastFetchedSubmissions !== null ? lastFetchedSubmissions : center.data.dailySales.value,
            description: "Error fetching live data. Displaying cached/default.",
        }
      }
      setSelectedCenterUIData(fallbackData);
    } finally {
      setIsLoadingMetrics(false);
      console.log('[DashboardPage] fetchAndUpdateDashboardMetrics finished.');
    }
  }, [toast]); // Removed lastFetchedSubmissions, fetchAndUpdateDashboardMetrics from deps


  // Effect to set initial center or react to user login
  useEffect(() => {
    const initialCenterId = user?.centerId || 'default';
    console.log('[DashboardPage] useEffect (user change) - Setting currentCenterId to:', initialCenterId);
    setCurrentCenterId(initialCenterId);
  }, [user]);


  // Effect to fetch data when currentCenterId changes
  useEffect(() => {
    console.log('[DashboardPage] useEffect (currentCenterId change) - currentCenterId is:', currentCenterId);
    if (currentCenterId) {
        const centerToLoad = availableCenters.find(c => c.id === currentCenterId) || availableCenters.find(c => c.id === 'default')!;
        if (centerToLoad) {
            fetchAndUpdateDashboardMetrics(centerToLoad);
        } else {
            console.warn(`[DashboardPage] No center found for ID: ${currentCenterId}. Using default.`);
            const defaultCenterInfo = availableCenters.find(c => c.id === 'default')!;
            fetchAndUpdateDashboardMetrics(defaultCenterInfo);
        }
    }
  }, [currentCenterId, fetchAndUpdateDashboardMetrics]);

  const handleCenterChange = (newCenterId: string) => {
    console.log('[DashboardPage] handleCenterChange - New center selected:', newCenterId);
    setCurrentCenterId(newCenterId);
  };
  
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-card rounded-lg shadow">
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary flex items-center">
          {isLoadingMetrics && <Loader2 className="h-8 w-8 mr-3 animate-spin text-primary/70" />}
          {selectedCenterUIData.centerName || "Center Dashboard"}
        </h1>
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
      {isLoadingMetrics && (!lastFetchedSubmissions && selectedCenterUIData.dailySales.value === 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
      {(!isLoadingMetrics || (isLoadingMetrics && lastFetchedSubmissions !== null)) && <CenterDashboardDisplay data={selectedCenterUIData} />}
    </div>
  );
}

