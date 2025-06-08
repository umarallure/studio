
"use client"

import { useState } from "react"
import { Bracket, Seed, SeedItem, type RoundProps as ReactBracketsRoundProps } from "react-brackets" // Added RoundProps for type safety
import { Card } from "@/components/ui/card"
// Note: src/app/styles/bracket.css is imported in src/app/(main)/layout.tsx

interface Team {
  name: string;
  score?: number; // Keep score optional if data might include it later
}

interface CustomSeedProps {
  id: number | string;
  date: string;
  teams: Team[];
  winner?: 0 | 1; // Optional winner property for seed data
}

interface Round extends ReactBracketsRoundProps {
  seeds: CustomSeedProps[];
}


export default function TournamentBracket() {
  const [rounds] = useState<Round[]>([
    // Left side - Quarter Finals
    {
      title: "Quarter Finals",
      seeds: [
        {
          id: 1,
          date: "Wed Jul 05 2023",
          teams: [{ name: "Team 1" }, { name: "Team 2" }],
        },
        {
          id: 2,
          date: "Wed Jul 05 2023",
          teams: [{ name: "Team 3" }, { name: "Team 4" }],
        },
        {
          id: 3,
          date: "Wed Jul 05 2023",
          teams: [{ name: "Team 5" }, { name: "Team 6" }],
        },
        {
          id: 4,
          date: "Wed Jul 05 2023",
          teams: [{ name: "Team 7" }, { name: "Team 8" }],
        },
      ],
    },
    // Left side - Semi Finals
    {
      title: "Semi Finals",
      seeds: [
        {
          id: 5,
          date: "Wed Jul 08 2023",
          teams: [{ name: "Team 1" }, { name: "Team 3" }], // Assuming Team 1 and 3 won
        },
        {
          id: 6,
          date: "Wed Jul 08 2023",
          teams: [{ name: "Team 5" }, { name: "Team 7" }], // Assuming Team 5 and 7 won
        },
      ],
    },
    // Final
    {
      title: "Final",
      seeds: [
        {
          id: 7,
          date: "Wed Jul 10 2023",
          teams: [{ name: "Team 1" }, { name: "Team 5" }], // Assuming Team 1 and 5 won semis
        },
      ],
    },
    // Right side - Semi Finals (data needs to represent progression, mirroring is visual)
    // For a 16-team bracket, the "right side" QFs and SFs are distinct matches.
    // The visual mirroring handles their placement.
    {
      title: "Semi Finals ", // Note: Title might appear duplicated if not handled by CSS/Layout
      seeds: [
        {
          id: 8, // Match ID for SF on the right
          date: "Wed Jul 08 2023",
          teams: [{ name: "Team 9" }, { name: "Team 11" }], // Assuming Team 9 and 11 won
        },
        {
          id: 9, // Match ID for other SF on the right
          date: "Wed Jul 08 2023",
          teams: [{ name: "Team 13" }, { name: "Team 15" }], // Assuming Team 13 and 15 won
        },
      ],
    },
    // Right side - Quarter Finals
    {
      title: "Quarter Finals ", // Note: Title might appear duplicated
      seeds: [
        {
          id: 10,
          date: "Wed Jul 05 2023",
          teams: [{ name: "Team 9" }, { name: "Team 10" }],
        },
        {
          id: 11,
          date: "Wed Jul 05 2023",
          teams: [{ name: "Team 11" }, { name: "Team 12" }],
        },
        {
          id: 12,
          date: "Wed Jul 05 2023",
          teams: [{ name: "Team 13" }, { name: "Team 14" }],
        },
        {
          id: 13,
          date: "Wed Jul 05 2023",
          teams: [{ name: "Team 15" }, { name: "Team 16" }],
        },
      ],
    },
  ])

  // Correctly divide rounds for two-sided display
  // Left side: QF, SF
  // Final: Final
  // Right side: SF, QF (data ordered for rendering, then CSS reverses visual order of rounds for mirror)
  const leftRounds = rounds.slice(0, 2); // QF-Left, SF-Left
  const finalRound = [rounds[2]];      // Final
  const rightRoundsData = rounds.slice(3); // SF-Right, QF-Right (Data as is)
                                       // CSS will handle the visual reversal of these right rounds.
                                       // If react-brackets applies transforms directly based on array order,
                                       // .reverse() on data might be needed: rounds.slice(3).reverse()

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6 text-center font-headline text-primary">Two Sided Single Elimination (16 Teams)</h1>
       <p className="text-center text-muted-foreground mb-6">
        This bracket displays a 16-team tournament with left and right paths converging to a central final.
      </p>
      <div className="overflow-x-auto bg-card p-2 rounded-lg shadow-lg">
        <div className="min-w-[1600px] p-4"> {/* Increased min-width for better layout */}
          <div className="flex justify-center items-start"> {/* items-start to align tops */}
            {/* Left side of the bracket */}
            <div className="flex-initial pr-8"> {/* Spacing */}
              <Bracket
                rounds={leftRounds}
                renderSeedComponent={CustomSeedInternal}
                roundTitleComponent={RoundTitle}
                swipeableProps={{ enableMouseEvents: true }}
              />
            </div>

            {/* Final in the middle */}
            <div className="flex-initial px-8"> {/* Spacing */}
              <Bracket
                rounds={finalRound}
                renderSeedComponent={CustomSeedInternal}
                roundTitleComponent={RoundTitle}
                swipeableProps={{ enableMouseEvents: true }}
              />
            </div>

            {/* Right side of the bracket (mirrored) */}
            <div className="flex-initial pl-8"> {/* Spacing */}
              <div className="mirror-bracket">
                <Bracket
                  rounds={rightRoundsData} // Data order: SF, QF
                                         // CSS mirror-bracket .react-brackets-round { flex-direction: column-reverse; } handles the visual order
                  renderSeedComponent={(props: any) => CustomSeedInternal({ ...props, isRightSide: true })}
                  roundTitleComponent={RoundTitle}
                  swipeableProps={{ enableMouseEvents: true }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RoundTitle({ title, roundIndex }: { title: React.ReactNode; roundIndex: number }) {
  return <div className="text-center text-lg font-semibold text-primary mb-3 mt-2 py-1 px-3 bg-primary/10 rounded-md">{title}</div>
}

function CustomSeedInternal({ // Renamed to avoid conflict if global CustomSeed exists elsewhere
  seed,
  breakpoint,
  roundIndex,
  seedIndex, // Added by react-brackets
  isRightSide = false,
}: { seed: CustomSeedProps; breakpoint: string; roundIndex: number; seedIndex: number; isRightSide?: boolean }) {
  
  // The `isRightSide` prop here applies specific transforms for text direction.
  // The global CSS in bracket.css handles the overall mirroring of the bracket structure.
  const seedStyle = isRightSide ? { transform: "scaleX(-1)" } : {};
  const contentStyle = isRightSide ? { transform: "scaleX(-1)" } : {};

  return (
    <Seed mobileBreakpoint={breakpoint} style={seedStyle}>
      <SeedItem className="bg-transparent border-none shadow-none"> {/* Remove SeedItem default styling */}
        <div className="flex flex-col items-center" style={contentStyle}> {/* Center the card */}
          <Card className="w-[220px] rounded-md overflow-hidden shadow-md border-border bg-popover">
            <div className="flex flex-col">
              {/* seed.winner is not in current data, so winner prop will be undefined */}
              <TeamItemInternal team={seed.teams[0]} winner={seed.winner === 0} />
              <div className="border-t border-border/50"></div> {/* Separator */}
              <TeamItemInternal team={seed.teams[1]} winner={seed.winner === 1} />
            </div>
          </Card>
          {seed.date && <div className="text-xs text-muted-foreground mt-1.5 text-center">{seed.date}</div>}
        </div>
      </SeedItem>
    </Seed>
  )
}

function TeamItemInternal({ team, winner }: { team: Team | undefined; winner?: boolean }) { // Renamed
  if (!team || !team.name) return (
    <div className="py-2 px-3 flex justify-between items-center bg-muted/50 text-muted-foreground min-h-[36px]">
        <span className="text-sm italic">TBD</span>
    </div>
  );

  // Theme-aware colors
  const winnerBgColor = 'bg-accent';
  const winnerTextColor = 'text-accent-foreground';
  const defaultBgColor = 'bg-card'; // or bg-popover if card is inside popover style
  const defaultTextColor = 'text-card-foreground'; // or text-popover-foreground

  return (
    <div
      className={`py-2 px-3 flex justify-between items-center min-h-[36px] transition-colors
        ${winner ? `${winnerBgColor} ${winnerTextColor}` : `${defaultBgColor} ${defaultTextColor}`}
        ${winner ? 'font-semibold' : ''}
      `}
    >
      <span className="text-sm">{team.name}</span>
      {/* Score display removed as it's not in the new data structure for teams */}
    </div>
  )
}

    