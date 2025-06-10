"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, ClipboardList, AlertTriangle } from 'lucide-react';
import { cn } from "@/lib/utils";

interface Period {
  rate: number;
  startDate: string;
  endDate: string;
  totalEntries: number;
  chargebackEntries: number;
}

interface ChargebackComparisonCardProps {
  isLoading?: boolean;
  currentPeriod?: Period | null;
  previousPeriod?: Period | null;
  industryAverage?: number;
}

export default function ChargebackComparisonCard({
  isLoading = false,  currentPeriod = null,
  previousPeriod = null,
  industryAverage = 5.0,
}: ChargebackComparisonCardProps) {
  if (!currentPeriod || !previousPeriod) {
    isLoading = true;
  }

  const isGoodPerformance = currentPeriod ? currentPeriod.rate < industryAverage : false;
  const trendImproving = currentPeriod && previousPeriod ? currentPeriod.rate < previousPeriod.rate : false;
  
  const PerformanceIcon = isGoodPerformance ? CheckCircle2 : AlertTriangle;
  const TrendIcon = trendImproving ? CheckCircle2 : XCircle;

  if (isLoading) {
    return (
      <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-red-500" /> 
            Chargeback Analysis
          </CardTitle>
          <CardDescription>Month-over-month comparison</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center min-h-[200px]">
          <div className="animate-pulse space-y-4 w-full">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-red-500" /> 
          Chargeback Analysis
        </CardTitle>
        <CardDescription>Month-over-month comparison</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="text-sm space-y-2">
          <li className="flex items-center justify-between">
            Selected Period Rate:
            <strong className={cn(              "text-foreground",
              !currentPeriod || currentPeriod.rate === 0 ? "text-muted" : currentPeriod.rate > industryAverage ? "text-red-500" : "text-green-500"
            )}>
              {currentPeriod ? currentPeriod.rate.toFixed(2) : "0.00"}%
            </strong>
          </li>
          <li className="flex items-center justify-between">
            Previous Period Rate:
            <strong className={cn(              "text-foreground",
              !previousPeriod || previousPeriod.rate === 0 ? "text-muted" : previousPeriod.rate > industryAverage ? "text-red-500" : "text-green-500"
            )}>
              {previousPeriod ? previousPeriod.rate.toFixed(2) : "0.00"}%
            </strong>
          </li>
          <li className="flex items-center justify-between">
            Industry Average:
            <strong className="text-foreground">{industryAverage.toFixed(1)}%</strong>
          </li>
        </ul>

        <div className="pt-4 space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <PerformanceIcon className={cn(
              "h-5 w-5 mt-0.5",
              isGoodPerformance ? "text-green-500" : "text-yellow-500"
            )} />
            <span>
              <strong className={cn(
                isGoodPerformance ? "text-green-600" : "text-yellow-600"
              )}>
                {isGoodPerformance ? "Below Average (Good)" : "Above Average"}
              </strong>
              <br />
              <span className="text-muted-foreground">
                {currentPeriod ? `${currentPeriod.chargebackEntries} chargebacks out of ${currentPeriod.totalEntries} entries` : "No data available"}
              </span>
            </span>
          </div>

          <div className="flex items-start gap-2 text-sm">
            <TrendIcon className={cn(
              "h-5 w-5 mt-0.5",
              trendImproving ? "text-green-500" : "text-red-500"
            )} />
            <span>
              <strong className={cn(
                trendImproving ? "text-green-600" : "text-red-600"
              )}>
                {trendImproving ? "Improving" : "Declining"}
              </strong>
              <br />              <span className="text-muted-foreground">
                {currentPeriod && previousPeriod ? 
                  `${Math.abs(currentPeriod.rate - previousPeriod.rate).toFixed(2)}% ${trendImproving ? "decrease" : "increase"} from previous period` :
                  "No trend data available"
                }
              </span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
