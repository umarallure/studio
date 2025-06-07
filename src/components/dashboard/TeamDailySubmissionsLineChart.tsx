
"use client";

import type { DailyChartDataPoint } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LabelList } from 'recharts';
import { format, parseISO, isValid } from 'date-fns';
import { Loader2, Info, TrendingUp } from 'lucide-react';

interface TeamDailySubmissionsLineChartProps {
  data: DailyChartDataPoint[];
  teamName: string;
  isLoading?: boolean;
  dateRangeDescription: string;
}

const chartConfig = {
  submissions: {
    label: "Submissions",
    color: "hsl(var(--chart-1))",
  },
};

export default function TeamDailySubmissionsLineChart({
  data,
  teamName,
  isLoading = false,
  dateRangeDescription,
}: TeamDailySubmissionsLineChartProps) {

  const title = `${teamName} - Daily Submissions`;
  const description = `Submitted entries per day. ${dateRangeDescription}`;

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
          <p className="text-muted-foreground">No submission data available for {teamName} in this period.</p>
        </CardContent>
      </Card>
    );
  }

  const formattedData = data.map(item => ({
    ...item,
    formattedDate: isValid(parseISO(item.date)) ? format(parseISO(item.date), 'MMM d') : 'Invalid Date',
  })).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

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
          <LineChart
            accessibilityLayer
            data={formattedData}
            margin={{
              top: 20,
              left: 0,
              right: 12,
              bottom: 5,
            }}
          >
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="formattedDate"
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickMargin={8}
              fontSize={12}
              stroke="hsl(var(--muted-foreground))"
              interval={Math.max(0, Math.floor(formattedData.length / (formattedData.length > 10 ? 7 : 5)) -1)}
            />
            <YAxis 
              tickLine={false} 
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickMargin={8} 
              fontSize={12}
              allowDecimals={false}
              stroke="hsl(var(--muted-foreground))"
              domain={[0, 'auto']}
            />
            <ChartTooltip
              cursor={{ stroke: "hsl(var(--accent))", strokeWidth: 1, strokeDasharray: "3 3" }}
              content={
                <ChartTooltipContent 
                  indicator="line" 
                  labelFormatter={(value, payload) => {
                     if (payload && payload.length > 0 && payload[0].payload.date) {
                        return format(parseISO(payload[0].payload.date), 'EEEE, MMM d, yyyy');
                     }
                     return value;
                  }}
                  formatter={(value, name) => [`${value} ${name === 'submissions' ? 'submissions' : name}`, chartConfig.submissions.label]}
                />
              }
            />
            <Line
              dataKey="count"
              name="submissions"
              type="monotone" 
              stroke={chartConfig.submissions.color}
              strokeWidth={2}
              dot={{
                fill: chartConfig.submissions.color,
                r: 3,
              }}
              activeDot={{
                r: 6,
                strokeWidth: 1,
                fill: "hsl(var(--background))",
                stroke: chartConfig.submissions.color,
              }}
            >
              <LabelList
                dataKey="count"
                position="top"
                offset={8}
                className="fill-foreground"
                fontSize={10}
                formatter={(value: number) => (value > 0 ? value : '')}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
