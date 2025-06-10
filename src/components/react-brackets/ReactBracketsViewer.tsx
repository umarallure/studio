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
      <SeedItem className="bg-popover shadow-md rounded-md border border-border">
        <div>
          <SeedTeam
            className="px-2 py-1 text-sm text-popover-foreground hover:bg-accent/10"
            style={{
              // Example: highlight winner based on score
              // backgroundColor: seed.teams[0]?.score > seed.teams[1]?.score ? 'var(--colors-accent-soft)' : 'transparent',
              // fontWeight: seed.teams[0]?.score > seed.teams[1]?.score ? 'bold' : 'normal'
            }}
          >
            {seed.teams[0]?.name || 'TBD'}
            {seed.teams[0]?.score !== undefined && <span className="ml-2 text-xs text-muted-foreground">({seed.teams[0].score})</span>}
          </SeedTeam>
          <div className="h-px bg-border my-0.5"></div> {/* Simple separator */}
          <SeedTeam
            className="px-2 py-1 text-sm text-popover-foreground hover:bg-accent/10"
            style={{
              // Example: highlight winner
              // backgroundColor: seed.teams[1]?.score > seed.teams[0]?.score ? 'var(--colors-accent-soft)' : 'transparent',
              // fontWeight: seed.teams[1]?.score > seed.teams[0]?.score ? 'bold' : 'normal'
            }}
          >
            {seed.teams[1]?.name || 'TBD'}
            {seed.teams[1]?.score !== undefined && <span className="ml-2 text-xs text-muted-foreground">({seed.teams[1].score})</span>}
          </SeedTeam>
        </div>
      </SeedItem>
      {seed.date && <div className="text-xs text-muted-foreground text-center mt-1">{seed.date}</div>}
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

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-primary font-headline text-2xl text-center">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-4 overflow-x-auto">
        <div style={{ minWidth: rounds.length * 220 }}> {/* Ensure enough width for horizontal scroll, adjusted for potentially wider seeds */}
          <Bracket
            rounds={rounds}
            rtl={false} // Standard left-to-right
            roundTitleComponent={(title: React.ReactNode, roundIndex: number) => (
              <div className="text-center font-semibold text-primary mb-2 py-1 px-3 bg-primary/10 rounded-md">
                {title}
              </div>
            )}
            // Using a custom seed component for more control if needed, and to display date
            seedComponent={CustomSeed}
          />
        </div>
        <style jsx global>{`
          // react-brackets uses emotion for styling. Some overrides might be needed.
          // These are basic styles to make it fit a bit better with Tailwind.
          
          // Lines connecting seeds
          div[style*="transform: translateY(-50%) translateX(-50%); display: flex;"] { 
            background-color: hsl(var(--border)) !important;
          }

          // Default seed item style override (handled by CustomSeed component now for more direct control if needed)
          // If not using CustomSeed, this is where you'd target the default styles:
          // div[style*="background-color: rgb(53, 56, 60); color: rgb(232, 232, 232);"] {
          //   background-color: hsl(var(--popover)) !important;
          //   color: hsl(var(--popover-foreground)) !important;
          //   border: 1px solid hsl(var(--border)) !important;
          //   border-radius: var(--radius) !important;
          //   box-shadow: 0 2px 4px rgba(0,0,0,0.05) !important;
          // }
          
          // Default team name style if not using CustomSeed
          // div[style*="color: rgb(145, 147, 150);"] {
          //    color: hsl(var(--muted-foreground)) !important;
          // }
          // Default team name score color (if any) if not using CustomSeed
          //  div[style*="color: rgb(232, 232, 232);"] {
          //    color: hsl(var(--foreground)) !important;
          // }

          /* Adjust spacing if necessary */
          section > div { /* Round container */
            margin-right: 40px !important; /* Space between rounds */
          }
          section > div > div:not(:first-child) { /* Seed items within a round */
             margin-top: 16px !important; /* Reduced space between matchups vertically */
          }
        `}</style>
      </CardContent>
    </Card>
  );
};

export default ReactBracketsViewer;
