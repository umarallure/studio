
"use client";
import type { CenterMetric } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  metric: CenterMetric;
}

export default function MetricCard({ metric }: MetricCardProps) {
  const Icon = metric.icon;
  
  const TrendIcon = metric.trend === 'up' 
    ? TrendingUp 
    : metric.trend === 'down' 
    ? TrendingDown 
    : Minus;

  const trendColor = metric.trend === 'up' 
    ? 'text-green-500' 
    : metric.trend === 'down' 
    ? (metric.id === 'chargeback' ? 'text-green-500' : 'text-red-500') // Green for lower chargeback
    : 'text-muted-foreground';
    
  const previousValueText = metric.previousValue !== undefined ? `From ${metric.previousValue}${metric.unit || ''}` : '';


  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground font-body">{metric.title}</CardTitle>
        {Icon && <Icon className="h-5 w-5 text-primary" />}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold font-headline text-foreground">
          {metric.value}{metric.unit}
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center">
          {metric.trend !== 'neutral' && <TrendIcon className={cn("h-4 w-4 mr-1", trendColor)} />}
          <span className={cn(trendColor, "font-medium")}>{metric.description || previousValueText}</span>
        </div>
      </CardContent>
    </Card>
  );
}
