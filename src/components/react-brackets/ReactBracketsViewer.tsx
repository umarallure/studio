
"use client";

import React from 'react';
import { Bracket, RoundProps, Seed, SeedItem, SeedTeam } from 'react-brackets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ReactBracketsViewerProps {
  rounds: RoundProps[];
  title?: string;
}

// Custom SeedComponent to allow for more Tailwind styling if needed,
// and to ensure structure matches what react-brackets expects.
const CustomSeed = ({ seed, roundIndex, seedIndex, breakpoint }: any) => {
  return (
    <Seed mobileBreakpoint={breakpoint} style={{ fontSize: 12 }}>
      <SeedItem className="bg-card shadow-md rounded-md border border-border">
        <div>
          <SeedTeam
            className="px-2 py-1 text-sm text-foreground hover:bg-accent/10"
            style={{
              backgroundColor: seed.teams[0]?.score > seed.teams[1]?.score ? 'var(--colors-accent-soft)' : 'transparent',
              fontWeight: seed.teams[0]?.score > seed.teams[1]?.score ? 'bold' : 'normal'
            }}
          >
            {seed.teams[0]?.name || 'TBD'}
            {seed.teams[0]?.score !== undefined && <span className="ml-2 text-xs text-muted-foreground">({seed.teams[0].score})</span>}
          </SeedTeam>
          <div className="h-px bg-border my-0.5"></div> {/* Simple separator */}
          <SeedTeam
            className="px-2 py-1 text-sm text-foreground hover:bg-accent/10"
            style={{
              backgroundColor: seed.teams[1]?.score > seed.teams[0]?.score ? 'var(--colors-accent-soft)' : 'transparent',
              fontWeight: seed.teams[1]?.score > seed.teams[0]?.score ? 'bold' : 'normal'
            }}
          >
            {seed.teams[1]?.name || 'TBD'}
            {seed.teams[1]?.score !== undefined && <span className="ml-2 text-xs text-muted-foreground">({seed.teams[1].score})</span>}
          </SeedTeam>
        </div>
      </SeedItem>
    </Seed>
  );
};


const ReactBracketsViewer: React.FC<ReactBracketsViewerProps> = ({ rounds, title = "Tournament Bracket" }) => {
  if (!rounds || rounds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No bracket data provided.</p>
        </CardContent>
      </Card>
    );
  }

  // react-brackets renders rounds from left to right.
  // For a two-sided bracket feeding into a final, we might need to adjust data structure
  // or use multiple Bracket components if the library doesn't natively support a typical tournament flow visualization.
  // For now, we'll render it as a single flow. The sample data is structured to show progression.

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-primary font-headline text-2xl text-center">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-4 overflow-x-auto">
        <div style={{ minWidth: rounds.length * 200 }}> {/* Ensure enough width for horizontal scroll */}
          <Bracket
            rounds={rounds}
            rtl={false} // Standard left-to-right
            roundTitleComponent={(title: React.ReactNode, roundIndex: number) => (
              <div className="text-center font-semibold text-primary mb-2 py-1 px-3 bg-primary/10 rounded-md">
                {title}
              </div>
            )}
            // Using a custom seed component for more control if needed
            // seedComponent={CustomSeed} // You can enable this for further customization
          />
        </div>
        <style jsx global>{`
          // react-brackets uses emotion for styling. Some overrides might be needed.
          // These are basic styles to make it fit a bit better with Tailwind.
          // You might need to inspect elements and add more specific styles.
          div[style*="transform: translateY(-50%) translateX(-50%); display: flex;"] { /* Lines connecting seeds */
            background-color: hsl(var(--border)) !important;
          }
          div[style*="background-color: rgb(53, 56, 60); color: rgb(232, 232, 232);"] { /* Default seed item style */
            background-color: hsl(var(--card)) !important;
            color: hsl(var(--card-foreground)) !important;
            border: 1px solid hsl(var(--border)) !important;
            border-radius: var(--radius) !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05) !important;
          }
          div[style*="color: rgb(145, 147, 150);"] { /* Default team name style */
             color: hsl(var(--muted-foreground)) !important;
          }
           div[style*="color: rgb(232, 232, 232);"] { /* Default team name score color (if any) */
             color: hsl(var(--foreground)) !important;
          }
          /* Adjust spacing if necessary */
          section > div { /* Round container */
            margin-right: 20px !important; /* Space between rounds */
          }
          section > div > div:not(:first-child) { /* Seed items within a round */
             margin-top: 20px !important; /* Space between matchups vertically */
          }
        `}</style>
      </CardContent>
    </Card>
  );
};

export default ReactBracketsViewer;
