
"use client";

import React from 'react';
import ReactBracketsViewer from '@/components/react-brackets/ReactBracketsViewer';
import { sampleRoundsWithScores, sampleRounds16Teams } from '@/lib/react-brackets-sample-data';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export default function ReactBracketsDemoPage() {
  return (
    <div className="space-y-8">
      <div className="p-4 bg-card rounded-lg shadow">
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">
          <code>react-brackets</code> Library Demo
        </h1>
        <p className="text-muted-foreground mt-1">
          This page demonstrates the <code>react-brackets</code> library with sample data.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Note on Two-Sided Brackets</AlertTitle>
        <AlertDescription>
          The <code>react-brackets</code> library renders rounds sequentially from left to right.
          To achieve a true visual "two-sided" tournament bracket that converges to a final (like a standard NCAA bracket),
          you typically structure your data so that early rounds from both sides are presented first, then their respective next rounds,
          and so on, until the final round naturally appears at the end.
          The "16 Team Structure" example below simulates this by having distinct "Round 1 - Left" and "Round 1 - Right" rounds.
          For a more complex visual split where rounds are truly on opposite sides of the screen and lines converge, custom rendering logic or CSS beyond the library's default might be needed, or using two separate Bracket instances for each half that feed into a final match display.
        </AlertDescription>
      </Alert>

      <ReactBracketsViewer
        rounds={sampleRoundsWithScores}
        title="16 Team Bracket - Sample with Scores"
      />

      <Separator className="my-8" />

      <ReactBracketsViewer
        rounds={sampleRounds16Teams}
        title="16 Team Bracket - Basic Structure"
      />

       <div className="mt-8 p-4 bg-muted/50 rounded-lg">
        <h3 className="font-semibold text-lg mb-2">Styling Notes:</h3>
        <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
          <li>
            Basic global styles have been applied within <code>ReactBracketsViewer.tsx</code> to make the default
            <code>react-brackets</code> output somewhat align with the Tailwind/ShadCN theme.
          </li>
          <li>
            The library uses Emotion for its internal styling. Overriding its styles comprehensively might require
            deeper inspection of the generated HTML/CSS and more targeted global selectors or by using its
            <code>theme</code> prop if available and compatible with CSS variables.
          </li>
          <li>
            The <code>CustomSeed</code> component (commented out in <code>ReactBracketsViewer.tsx</code>) can be enabled and customized
            for more granular control over how each match/seed is rendered, allowing better integration with Tailwind/ShadCN.
          </li>
        </ul>
      </div>
    </div>
  );
}
