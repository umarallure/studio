
"use client";

import type { ChartSegment } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { TrendingUp } from 'lucide-react'; // Or another relevant icon

interface EntryStatusChartProps {
  chartData: ChartSegment[];
  chartConfig: any; // Recharts/ShadCN chart config
  title?: string;
  description?: string;
}

const defaultChartConfig = {
  // Config will be built dynamically based on data if not provided
};

export default function EntryStatusChart({
  chartData,
  chartConfig = defaultChartConfig,
  title = "Entry Status Breakdown",
  description = "Distribution of entry statuses over the selected period."
}: EntryStatusChartProps) {
  if (!chartData || chartData.length === 0) {
    return (
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col items-center justify-center min-h-[300px]">
        <CardHeader>
          <CardTitle className="text-center">{title}</CardTitle>
          <CardDescription className="text-center">{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <p className="text-muted-foreground">No data available for the chart.</p>
        </CardContent>
      </Card>
    );
  }

  // Build chartConfig dynamically if not fully provided, mapping data names to their fills
  const dynamicChartConfig = chartData.reduce((acc, segment) => {
    acc[segment.name] = { label: segment.name, color: segment.fill };
    return acc;
  }, { ...chartConfig });


  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={dynamicChartConfig}
          className="mx-auto aspect-square max-h-[300px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60} // Makes it a donut chart
              outerRadius={100}
              strokeWidth={2}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"/>
              ))}
            </Pie>
             <ChartLegend content={<ChartLegendContent nameKey="name" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
