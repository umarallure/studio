
"use client";

import type { RateChartDataPoint } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { AlertOctagon } from 'lucide-react';

interface DailyStatusRateLineChartProps {
  data: RateChartDataPoint[];
  title?: string;
  description?: string;
  isLoading?: boolean;
}

const chartConfig = {
  rate: {
    label: "Rejected Rate",
    color: "hsl(var(--chart-2))", // Using a different color
  },
};

export default function DailyStatusRateLineChart({
  data,
  title = "Daily Negative Status Rate",
  description = "Daily percentage of 'Rejected' entries (proxy for chargebacks).",
  isLoading = false,
}: DailyStatusRateLineChartProps) {

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
    formattedDate: format(parseISO(item.date), 'MMM d'),
  }));

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle className="flex items-center gap-2">
          <AlertOctagon className="h-6 w-6 text-destructive" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={formattedData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
              dataKey="formattedDate" 
              tickLine={false} 
              axisLine={false} 
              tickMargin={8}
              fontSize={12}
              interval={Math.max(0, Math.floor(formattedData.length / 7) -1)} 
            />
            <YAxis 
              tickLine={false} 
              axisLine={false} 
              tickMargin={8} 
              fontSize={12}
              tickFormatter={(value) => `${value}%`}
              domain={[0, 'auto']}
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
                formatter={(value) => [`${Number(value).toFixed(2)}% Rejected Rate`, undefined]}
                indicator="dot" 
              />}
            />
            <Line 
              type="monotone" 
              dataKey="rate" 
              stroke={chartConfig.rate.color} 
              strokeWidth={2} 
              dot={{ r: 4, fill: chartConfig.rate.color, strokeWidth:0 }} 
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
