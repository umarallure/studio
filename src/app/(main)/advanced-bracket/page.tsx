
"use client"

import { useState } from "react"
import { Bracket, Seed, SeedItem, type RoundProps } from "react-brackets" // Added RoundProps for type safety
import { Card } from "@/components/ui/card"
import '@/app/styles/bracket.css'; // Import the custom CSS

// Define a more specific type for team and seed if possible, for now using 'any' as per user's code
interface Team {
  name: string;
  score?: number;
}

interface CustomSeedProps {
  id: number;
  date: string;
  teams: Team[];
}


export default function AdvancedTournamentBracket() {
  const [rounds] = useState<RoundProps[]>([ // Added type for rounds
    // Left side - Quarter Finals
    {
      title: "Quarter Finals",
      seeds: [
        {
          id: 1,
          date: "Wed Jul 05 2023",
          teams: [
            { name: "Team 1", score: 4 },
            { name: "Team 2", score: 2 },
          ],
        },
        {
          id: 2,
          date: "Wed Jul 05 2023",
          teams: [
            { name: "Team 3", score: 5 },
            { name: "Team 4", score: 1 },
          ],
        },
        {
          id: 3,
          date: "Wed Jul 05 2023",
          teams: [
            { name: "Team 5", score: 3 },
            { name: "Team 6", score: 2 },
          ],
        },
        {
          id: 4,
          date: "Wed Jul 05 2023",
          teams: [
            { name: "Team 7", score: 2 },
            { name: "Team 8", score: 3 },
          ],
        },
      ] as any, // Cast to any if seed structure doesn't perfectly match SeedProps
    },
    // Left side - Semi Finals
    {
      title: "Semi Finals",
      seeds: [
        {
          id: 5,
          date: "Wed Jul 08 2023",
          teams: [
            { name: "Team 1", score: 2 }, // Winner of QF1 vs Winner of QF2 if scores are considered
            { name: "Team 3", score: 3 },
          ],
        },
        {
          id: 6,
          date: "Wed Jul 08 2023",
          teams: [
            { name: "Team 5", score: 4 }, // Winner of QF3 vs Winner of QF4
            { name: "Team 8", score: 1 },
          ],
        },
      ] as any,
    },
    // Final (conceptually in the middle, but react-brackets renders linearly)
    {
      title: "Final",
      seeds: [
        {
          id: 7,
          date: "Wed Jul 10 2023",
          teams: [
            { name: "Team 3", score: 2 }, // Winner of Left SF1
            { name: "Team 5", score: 3 }, // Winner of Left SF2 (or this should be winner of Right SF)
          ],
        },
      ] as any,
    },
    // Right side - Semi Finals (for mirroring, data should be structured as if it's a separate bracket path)
    {
      title: "Semi Finals ", // Added space to differentiate title if needed
      seeds: [
         {
          id: 8, // Original ID was 9, ensure unique IDs if necessary or map from a different source
          date: "Wed Jul 08 2023",
          teams: [
            { name: "Team 9", score: 5 },  // Assuming these are winners from Right QF
            { name: "Team 11", score: 3 },
          ],
        },
        {
          id: 9, // Original ID was 8
          date: "Wed Jul 08 2023",
          teams: [
            { name: "Team 13", score: 1 },
            { name: "Team 15", score: 2 },
          ],
        },
      ] as any,
    },
    // Right side - Quarter Finals (for mirroring)
    {
      title: "Quarter Finals ", // Added space to differentiate title
      seeds: [
        {
          id: 10, // Original ID was 13
          date: "Wed Jul 05 2023",
          teams: [
            { name: "Team 9", score: 4 },
            { name: "Team 10", score: 1 },
          ],
        },
        {
          id: 11, // Original ID was 12
          date: "Wed Jul 05 2023",
          teams: [
            { name: "Team 11", score: 3 },
            { name: "Team 12", score: 2 },
          ],
        },
        {
          id: 12, // Original ID was 11
          date: "Wed Jul 05 2023",
          teams: [
            { name: "Team 13", score: 5 },
            { name: "Team 14", score: 4 },
          ],
        },
        {
          id: 13, // Original ID was 10
          date: "Wed Jul 05 2023",
          teams: [
            { name: "Team 15", score: 3 },
            { name: "Team 16", score: 1 },
          ],
        },
      ] as any,
    },
  ])

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6 text-center font-headline text-primary">Two Sided Single Elimination (with Scores)</h1>
      <p className="text-center text-muted-foreground mb-6">
        This bracket attempts a two-sided visual using CSS transforms. The data is structured into left and right paths.
      </p>
      <div className="overflow-x-auto bg-card p-2 rounded-lg shadow-lg">
        <div className="min-w-[1600px] p-4"> {/* Increased min-width for better layout */}
          <div className="flex justify-center"> {/* Centering the two bracket containers */}
            {/* Left side of the bracket (QF, SF) */}
            <div className="flex-initial pr-4"> {/* Use flex-initial and padding for spacing */}
              <Bracket
                rounds={rounds.slice(0, 2)} // QF-Left, SF-Left
                renderSeedComponent={CustomSeed}
                roundTitleComponent={RoundTitle}
                swipeableProps={{ enableMouseEvents: true }}
              />
            </div>

            {/* Final (Rendered as a separate Bracket in the middle) */}
            <div className="flex-initial px-4"> {/* Spacing for the final */}
              <Bracket
                rounds={[rounds[2]]} // Only the Final round
                renderSeedComponent={CustomSeed}
                roundTitleComponent={RoundTitle}
                swipeableProps={{ enableMouseEvents: true }}
              />
            </div>

            {/* Right side of the bracket (SF, QF - data already reversed for rendering) */}
            <div className="flex-initial pl-4"> {/* Use flex-initial and padding for spacing */}
              <div className="mirror-bracket">
                <Bracket
                  rounds={rounds.slice(3).reverse()} // Reverse to display QF then SF for the right side
                  renderSeedComponent={(props: any) => CustomSeed({ ...props, isRightSide: true })}
                  roundTitleComponent={RoundTitle}
                  swipeableProps={{ enableMouseEvents: true }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Removed <style jsx global> as styles are now in bracket.css */}
    </div>
  )
}

function RoundTitle({ title, roundIndex }: { title: React.ReactNode; roundIndex: number }) {
  return <div className="text-center text-lg font-semibold text-primary mb-3 mt-2 py-1 px-3 bg-primary/10 rounded-md">{title}</div>
}

function CustomSeed({
  seed,
  breakpoint, // mobileBreakpoint prop from react-brackets
  roundIndex,
  seedIndex, // Added by react-brackets
  isRightSide = false, // Prop to indicate if it's for the right side (though CSS handles mirroring)
}: { seed: CustomSeedProps; breakpoint: string; roundIndex: number; seedIndex: number; isRightSide?: boolean }) {
  
  const team1 = seed.teams[0];
  const team2 = seed.teams[1];

  let winnerTeam1 = false;
  let winnerTeam2 = false;

  if (team1?.score !== undefined && team2?.score !== undefined) {
    if (team1.score > team2.score) {
      winnerTeam1 = true;
    } else if (team2.score > team1.score) {
      winnerTeam2 = true;
    }
    // If scores are equal, neither is marked as a winner explicitly by this logic
  }


  return (
    <Seed mobileBreakpoint={breakpoint} style={{ fontSize: 12 }}> {/* Ensure Seed component is used correctly */}
      <SeedItem className="bg-transparent border-none shadow-none"> {/* Remove SeedItem default styling */}
        <div className="flex flex-col items-center"> {/* Center the card */}
          <Card className="w-[220px] rounded-md overflow-hidden shadow-md border-border bg-popover">
            <div className="flex flex-col">
              <TeamItem team={team1} winner={winnerTeam1} />
              <div className="border-t border-border/50"></div> {/* Separator */}
              <TeamItem team={team2} winner={winnerTeam2} />
            </div>
          </Card>
          {seed.date && <div className="text-xs text-muted-foreground mt-1.5 text-center">{seed.date}</div>}
        </div>
      </SeedItem>
    </Seed>
  )
}

function TeamItem({ team, winner }: { team: Team | undefined; winner?: boolean }) {
  if (!team || !team.name) return (
    <div className="py-2 px-3 flex justify-between items-center bg-muted/50 text-muted-foreground min-h-[36px]">
        <span className="text-sm italic">TBD</span>
    </div>
  );

  // Define colors based on your theme's CSS variables
  const winnerBgColor = 'bg-accent'; // Use accent for winner
  const winnerTextColor = 'text-accent-foreground';
  const defaultBgColor = 'bg-card'; // Use card for default
  const defaultTextColor = 'text-card-foreground';

  return (
    <div
      className={`py-2 px-3 flex justify-between items-center min-h-[36px] transition-colors
        ${winner ? `${winnerBgColor} ${winnerTextColor}` : `${defaultBgColor} ${defaultTextColor}`}
        ${winner ? 'font-semibold' : ''}
      `}
    >
      <span className="text-sm">{team.name}</span>
      {team.score !== undefined && <span className="text-sm ml-2 px-1.5 py-0.5 rounded bg-black/10 text-xs">{team.score}</span>}
    </div>
  )
}

    