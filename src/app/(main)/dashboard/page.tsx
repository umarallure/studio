
"use client";

import CenterDashboardDisplay from '@/components/dashboard/CenterDashboardDisplay';
import { mockCenterData1, mockCenterData2, defaultCenterData, type CenterDashboardData } from '@/lib/mock-data';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const availableCenters = [
  { id: 'center1', name: 'Alpha Ops HQ', data: mockCenterData1 },
  { id: 'center2', name: 'Bravo Solutions Hub', data: mockCenterData2 },
  { id: 'default', name: 'Your Center', data: defaultCenterData }
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [selectedCenterData, setSelectedCenterData] = useState<CenterDashboardData>(defaultCenterData);
  const [currentCenterId, setCurrentCenterId] = useState<string>(user?.centerId || 'default');

  useEffect(() => {
    const activeCenterId = user?.centerId || 'default';
    setCurrentCenterId(activeCenterId);
    const data = availableCenters.find(c => c.id === activeCenterId)?.data || defaultCenterData;
    setSelectedCenterData(data);
  }, [user]);

  const handleCenterChange = (centerId: string) => {
    setCurrentCenterId(centerId);
    const data = availableCenters.find(c => c.id === centerId)?.data || defaultCenterData;
    setSelectedCenterData(data);
  };
  
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-card rounded-lg shadow">
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">
          {selectedCenterData.centerName || "Center Dashboard"}
        </h1>
        {!user?.centerId && ( // Only show selector if user is not tied to a specific center
            <Select value={currentCenterId} onValueChange={handleCenterChange}>
            <SelectTrigger className="w-full sm:w-[220px] bg-background">
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
      <CenterDashboardDisplay data={selectedCenterData} />
    </div>
  );
}
