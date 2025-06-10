import React from 'react';

interface GaugeChartProps {
  value: number;
  minValue?: number;
  maxValue?: number;
  deficit?: number;
  size?: number;
}

export function GaugeChart({ 
  value, 
  minValue = 0, 
  maxValue = 100,
  deficit,
  size = 200 
}: GaugeChartProps) {
  // Calculate angles for the arc
  const startAngle = -120;
  const endAngle = 120;
  const range = maxValue - minValue;
  const valueAngle = startAngle + ((value - minValue) / range) * (endAngle - startAngle);

  // Calculate center and radius
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = (size / 2) * 0.8;

  // Create the arc path
  const createArc = (start: number, end: number) => {
    const startRad = (start * Math.PI) / 180;
    const endRad = (end * Math.PI) / 180;
    
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);
    
    const largeArcFlag = end - start <= 180 ? "0" : "1";
    
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
  };

  // Create tick marks
  const createTicks = () => {
    const ticks = [];
    for (let i = 0; i <= 10; i++) {
      const angle = startAngle + (i / 10) * (endAngle - startAngle);
      const rad = (angle * Math.PI) / 180;
      const outerX = centerX + radius * Math.cos(rad);
      const outerY = centerY + radius * Math.sin(rad);
      const innerX = centerX + (radius * 0.9) * Math.cos(rad);
      const innerY = centerY + (radius * 0.9) * Math.sin(rad);
      
      ticks.push(
        <line
          key={i}
          x1={innerX}
          y1={innerY}
          x2={outerX}
          y2={outerY}
          stroke="currentColor"
          strokeWidth="2"
          className="text-muted-foreground/30"
        />
      );
    }
    return ticks;
  };

  return (
    <div className="flex justify-center items-center w-full">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background arc */}
        <path
          d={createArc(startAngle, endAngle)}
          fill="none"
          className="stroke-muted"
          strokeWidth="20"
          strokeLinecap="round"
        />
        
        {/* Value arc */}
        <path
          d={createArc(startAngle, valueAngle)}
          fill="none"
          className="stroke-primary"
          strokeWidth="20"
          strokeLinecap="round"
        />

        {/* Tick marks */}
        {createTicks()}
        
        {/* Center text */}
        <g transform={`rotate(90 ${centerX} ${centerY})`}>
          <text
            x={centerX}
            y={centerY}
            textAnchor="middle"
            dominantBaseline="central"
            className="text-3xl font-bold fill-foreground"
          >
            {value.toLocaleString()}
          </text>
          {deficit && (
            <text
              x={centerX}
              y={centerY + 25}
              textAnchor="middle"
              className="text-sm fill-destructive"
            >
              ▼ {deficit.toLocaleString()}
            </text>
          )}
        </g>
      </svg>
    </div>
  );
}
