
"use client"

import { useState } from "react"
import { Bracket, Seed, SeedItem, type RoundProps as ReactBracketsRoundProps } from "react-brackets" // Added RoundProps for type safety
import { Card } from "@/components/ui/card"
// Note: src/app/styles/bracket.css is imported in src/app/(main)/layout.tsx

interface Team {
  name: string;
  score?: number; // Added score property
}

interface CustomSeedProps {
  id: number | string;
  date: string;
  teams: Team[];
  winner?: 0 | 1; // Optional winner property, can be derived or explicit
}

// Explicitly type the rounds state for better clarity
interface Round extends ReactBracketsRoundProps {
  seeds: CustomSeedProps[];
}


export default function TournamentBracket() {
  const [rounds] = useState<Round[]>([
    // Left side - Quarter Finals
    {
      title: "Quarter Finals",
      seeds: [
        { id: 1, date: "Wed Jul 05 2023", teams: [{ name: "Team 1", score: 3 }, { name: "Team 2", score: 1 }] },
        { id: 2, date: "Wed Jul 05 2023", teams: [{ name: "Team 3", score: 2 }, { name: "Team 4", score: 0 }] },
        { id: 3, date: "Wed Jul 05 2023", teams: [{ name: "Team 5", score: 4 }, { name: "Team 6", score: 3 }] },
        { id: 4, date: "Wed Jul 05 2023", teams: [{ name: "Team 7", score: 1 }, { name: "Team 8", score: 3 }] },
      ],
    },
    // Left side - Semi Finals
    {
      title: "Semi Finals",
      seeds: [
        { id: 5, date: "Wed Jul 08 2023", teams: [{ name: "Team 1", score: 2 }, { name: "Team 3", score: 3 }] }, // Team 3 wins
        { id: 6, date: "Wed Jul 08 2023", teams: [{ name: "Team 5", score: 3 }, { name: "Team 8", score: 1 }] }, // Team 5 wins
      ],
    },
    // Final
    {
      title: "Final",
      seeds: [
        { id: 7, date: "Wed Jul 10 2023", teams: [{ name: "Team 3", score: 1 }, { name: "Team 5", score: 3 }] }, // Team 5 wins
      ],
    },
    // Right side - Semi Finals (data order for rendering, CSS mirrors)
    {
      title: "Semi Finals ", // Added space to differentiate title slightly if needed, or handle via CSS
      seeds: [
        { id: 8, date: "Wed Jul 08 2023", teams: [{ name: "Team 9", score: 3 }, { name: "Team 11", score: 2 }] },  // Team 9 wins
        { id: 9, date: "Wed Jul 08 2023", teams: [{ name: "Team 13", score: 1 }, { name: "Team 15", score: 3 }] }, // Team 15 wins
      ],
    },
    // Right side - Quarter Finals (data order for rendering, CSS mirrors)
    {
      title: "Quarter Finals ", // Added space
      seeds: [
        { id: 10, date: "Wed Jul 05 2023", teams: [{ name: "Team 9", score: 3 }, { name: "Team 10", score: 0 }] },
        { id: 11, date: "Wed Jul 05 2023", teams: [{ name: "Team 11", score: 2 }, { name: "Team 12", score: 1 }] },
        { id: 12, date: "Wed Jul 05 2023", teams: [{ name: "Team 13", score: 3 }, { name: "Team 14", score: 2 }] },
        { id: 13, date: "Wed Jul 05 2023", teams: [{ name: "Team 15", score: 4 }, { name: "Team 16", score: 1 }] },
      ],
    },
  ])

  // Correctly divide rounds for two-sided display
  const leftRounds = rounds.slice(0, 2); // QF-Left, SF-Left
  const finalRound = [rounds[2]];      // Final
  const rightRoundsData = rounds.slice(3); // SF-Right, QF-Right (Data as is)

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6 text-center font-headline text-primary">Two Sided Single Elimination (16 Teams)</h1>
       <p className="text-center text-muted-foreground mb-6">
        This bracket displays a 16-team tournament with left and right paths converging to a central final. Scores are illustrative.
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
                  rounds={rightRoundsData} 
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

function CustomSeedInternal({
  seed,
  breakpoint,
  roundIndex,
  seedIndex, // Added by react-brackets
  isRightSide = false,
}: { seed: CustomSeedProps; breakpoint: string; roundIndex: number; seedIndex: number; isRightSide?: boolean }) {
  
  const team1 = seed.teams[0];
  const team2 = seed.teams[1];

  // Determine winner based on score if scores are present
  let winnerIndex: 0 | 1 | undefined = undefined;
  if (team1?.score !== undefined && team2?.score !== undefined) {
    if (team1.score > team2.score) {
      winnerIndex = 0;
    } else if (team2.score > team1.score) {
      winnerIndex = 1;
    }
  } else if (seed.winner !== undefined) { // Fallback to explicit winner prop if scores aren't there
    winnerIndex = seed.winner;
  }

  const seedStyle = isRightSide ? { transform: "scaleX(-1)" } : {};
  const contentStyle = isRightSide ? { transform: "scaleX(-1)" } : {};

  return (
    <Seed mobileBreakpoint={breakpoint} style={seedStyle}>
      <SeedItem className="bg-transparent border-none shadow-none"> {/* Remove SeedItem default styling */}
        <div className="flex flex-col items-center" style={contentStyle}> {/* Center the card */}
          <Card className="w-[220px] rounded-md overflow-hidden shadow-md border-border bg-popover">
            <div className="flex flex-col">
              <TeamItemInternal team={team1} winner={winnerIndex === 0} />
              <div className="border-t border-border/50"></div> {/* Separator */}
              <TeamItemInternal team={team2} winner={winnerIndex === 1} />
            </div>
          </Card>
          {seed.date && <div className="text-xs text-muted-foreground mt-1.5 text-center">{seed.date}</div>}
        </div>
      </SeedItem>
    </Seed>
  )
}

function TeamItemInternal({ team, winner }: { team: Team | undefined; winner?: boolean }) {
  if (!team || !team.name) return (
    <div className="py-2 px-3 flex justify-between items-center bg-muted/50 text-muted-foreground min-h-[36px]">
        <span className="text-sm italic">TBD</span>
    </div>
  );

  const winnerBgColor = 'bg-accent';
  const winnerTextColor = 'text-accent-foreground';
  const defaultBgColor = 'bg-card'; 
  const defaultTextColor = 'text-card-foreground'; 

  return (
    <div
      className={`py-2 px-3 flex justify-between items-center min-h-[36px] transition-colors
        ${winner ? `${winnerBgColor} ${winnerTextColor}` : `${defaultBgColor} ${defaultTextColor}`}
        ${winner ? 'font-semibold' : ''}
      `}
    >
      <span className="text-sm">{team.name}</span>
      {team.score !== undefined && <span className="text-sm font-mono">{team.score}</span>}
    </div>
  )
}
