
"use client";

import type { DailyChartDataPoint } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { TrendingUp } from 'lucide-react';

interface DailySubmissionsBarChartProps {
  data: DailyChartDataPoint[];
  title?: string;
  description?: string;
  isLoading?: boolean;
}

const chartConfig = {
  submissions: {
    label: "Submissions",
    color: "hsl(var(--chart-1))",
  },
};

export default function DailySubmissionsBarChart({
  data,
  title = "Daily Sales Volume",
  description = "Count of 'Submitted' entries over the selected period.",
  isLoading = false,
}: DailySubmissionsBarChartProps) {

  if (isLoading) {
    return (
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col items-center justify-center min-h-[350px]">
        <CardHeader>
          <CardTitle className="text-center">{title}</CardTitle>
          <CardDescription className="text-center">{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </CardContent>
      </Card>
    );
  }
  
  if (!data || data.length === 0) {
    return (
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col items-center justify-center min-h-[350px]">
        <CardHeader>
          <CardTitle className="text-center">{title}</CardTitle>
          <CardDescription className="text-center">{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <p className="text-muted-foreground">No data available for this period.</p>
        </CardContent>
      </Card>
    );
  }

  const formattedData = data.map(item => ({
    ...item,
    formattedDate: format(parseISO(item.date), 'MMM d'), // Short date format for XAxis
  }));

  const barSize = formattedData.length > 0 ? Math.min(30, 300 / formattedData.length) : 30;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={formattedData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
              dataKey="formattedDate" 
              tickLine={false} 
              axisLine={false} 
              tickMargin={8}
              fontSize={12}
              interval={Math.max(0, Math.floor(formattedData.length / 7) -1)} // Show roughly 7 ticks
            />
            <YAxis 
              tickLine={false} 
              axisLine={false} 
              tickMargin={8} 
              fontSize={12}
              allowDecimals={false}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent 
                labelFormatter={(value, payload) => {
                   if (payload && payload.length > 0 && payload[0].payload.date) {
                     return format(parseISO(payload[0].payload.date), 'PPP');
                   }
                   return value;
                }}
                formatter={(value) => [`${value} submissions`, undefined]}
                indicator="dot" 
              />}
            />
            <Bar dataKey="count" fill={chartConfig.submissions.color} radius={4} barSize={barSize} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
