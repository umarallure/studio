
"use client";

import type { DailyChartDataPoint } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LabelList } from 'recharts';
import { format, parseISO } from 'date-fns';
import { TrendingUp, Loader2, Info } from 'lucide-react';

interface DailySubmissionsBarChartProps {
  data: DailyChartDataPoint[];
  title?: string;
  description?: string;
  isLoading?: boolean;
}

export default function DailySubmissionsBarChart({
  data,
  title = "Daily Submissions Volume",
  description = "Total 'Submitted' entries per day.",
  isLoading = false,
}: DailySubmissionsBarChartProps) {

  if (isLoading) {
    return (
      <Card className="shadow-lg flex flex-col items-center justify-center min-h-[350px]">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" /> {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }
  
  if (!data || data.length === 0) {
    return (
      <Card className="shadow-lg flex flex-col items-center justify-center min-h-[350px]">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
             <Info className="h-6 w-6 text-muted-foreground" /> {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <p className="text-muted-foreground">No data available for this period.</p>
        </CardContent>
      </Card>
    );
  }

  const formattedData = data.map(item => ({
    ...item,
    // Ensure date is parsed correctly before formatting. Handle potential invalid dates.
    formattedDate: isValid(parseISO(item.date)) ? format(parseISO(item.date), 'MMM d') : 'Invalid Date',
  }));

  // Determine a dynamic bar size, ensuring it's reasonable
  const barCategoryGap = formattedData.length > 15 ? "5%" : "20%";
  const maxBarSize = formattedData.length > 10 ? 30 : 50;


  return (
    <Card className="shadow-lg flex flex-col">
      <CardHeader className="items-center pb-2">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart 
            data={formattedData} 
            margin={{ top: 5, right: 5, left: -25, bottom: 5 }} // Adjusted left margin for YAxis labels
            barCategoryGap={barCategoryGap}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="formattedDate" 
              tickLine={false} 
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickMargin={8}
              fontSize={12}
              stroke="hsl(var(--muted-foreground))"
              interval={Math.max(0, Math.floor(formattedData.length / (formattedData.length > 10 ? 7 : 5)) -1)} // Dynamic interval
            />
            <YAxis 
              tickLine={false} 
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickMargin={8} 
              fontSize={12}
              allowDecimals={false}
              stroke="hsl(var(--muted-foreground))"
            />
            <RechartsTooltip
              cursor={{ fill: 'hsl(var(--accent) / 0.2)' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                borderColor: 'hsl(var(--border))',
                borderRadius: 'var(--radius)',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', marginBottom: '4px', fontWeight: 'bold' }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              labelFormatter={(value, payload) => {
                 // Find original date from payload if available
                 if (payload && payload.length > 0 && payload[0] && payload[0].payload && payload[0].payload.date) {
                    const originalDate = payload[0].payload.date;
                    if (isValid(parseISO(originalDate))) {
                        return format(parseISO(originalDate), 'EEEE, MMM d, yyyy');
                    }
                 }
                 return value; // Fallback to the formattedDate from XAxis
              }}
              formatter={(value: number, name: string) => {
                return [`${value} ${name === 'count' ? 'submissions' : name}`, null];
              }}
            />
            <Bar 
              dataKey="count" 
              fill="hsl(var(--primary))" 
              radius={[4, 4, 0, 0]}
              maxBarSize={maxBarSize}
            >
              <LabelList dataKey="count" position="top" fontSize={10} fill="hsl(var(--muted-foreground))" formatter={(value: number) => value > 0 ? value : ''} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
