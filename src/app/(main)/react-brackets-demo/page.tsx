
"use client";

import React from 'react';
import ReactBracketsViewer from '@/components/react-brackets/ReactBracketsViewer';
import { sampleRoundsWithScores, sampleRounds16Teams, imageData8TeamBracket } from '@/lib/react-brackets-sample-data';
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
        <AlertTitle>Note on Two-Sided / Converging Brackets</AlertTitle>
        <AlertDescription>
          The <code>react-brackets</code> library renders rounds sequentially from left to right. 
          The visual structure often desired for "two-sided" tournament brackets (like a standard NCAA bracket, or your provided image with a central final and symmetrically converging left/right branches with mirrored round titles like "Quarter Finals ... Final ... Quarter Finals") is a custom layout.
          <br /><br />
          While <code>react-brackets</code> can represent the tournament <em>progression</em> (e.g., Quarterfinals {"->"} Semifinals {"->"} Final), it does not natively create that specific symmetric visual out of the box.
          The "8-Team Bracket from Image Data" example below shows the data inferred from your image, rendered using <code>react-brackets</code>' standard linear flow.
        </AlertDescription>
      </Alert>

      <ReactBracketsViewer
        rounds={imageData8TeamBracket}
        title="8-Team Bracket from Image Data (Linear Flow)"
      />

      <Separator className="my-8" />
      
      <ReactBracketsViewer
        rounds={sampleRoundsWithScores}
        title="16 Team Bracket - Sample with Scores (Linear Flow)"
      />

      <Separator className="my-8" />

      <ReactBracketsViewer
        rounds={sampleRounds16Teams}
        title="16 Team Bracket - Basic Structure (Linear Flow with Grouped Rounds)"
      />

       <div className="mt-8 p-4 bg-muted/50 rounded-lg">
        <h3 className="font-semibold text-lg mb-2">Styling Notes:</h3>
        <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
          <li>
            Basic global styles have been applied within <code>ReactBracketsViewer.tsx</code> to make the default
            <code>react-brackets</code> output somewhat align with the Tailwind/ShadCN theme.
            The seeds (matchup boxes) now use your theme's popover colors.
          </li>
          <li>
            The library uses Emotion for its internal styling. Overriding its styles comprehensively might require
            deeper inspection of the generated HTML/CSS and more targeted global selectors or by using its
            <code>theme</code> prop if available and compatible with CSS variables.
          </li>
          <li>
            The <code>CustomSeed</code> component in <code>ReactBracketsViewer.tsx</code> is now active and styled to better reflect the desired look and displays the date.
          </li>
        </ul>
      </div>
    </div>
  );
}
