
"use client"

import type { ReactNode } from "react"; // For RoundTitle type
import { useState } from "react"
import { Bracket, Seed, SeedItem, type RoundProps as ReactBracketsRoundProps } from "react-brackets"
import { Card } from "@/components/ui/card"
import "@/app/styles/bracket.css"; // Ensure styles are applied

// Define types for better clarity
interface Team {
  name: string;
  score?: number;
}

interface CustomSeedProps {
  id: number | string;
  date: string;
  teams: Team[];
  // Winner is derived from scores in this version
}

interface Round extends ReactBracketsRoundProps {
  seeds: CustomSeedProps[];
}

export default function AdvancedTournamentBracket() {
  const [rounds] = useState<Round[]>([
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
      ],
    },
    // Left side - Semi Finals
    {
      title: "Semi Finals",
      seeds: [
        {
          id: 5,
          date: "Wed Jul 08 2023",
          teams: [ // Winner 1 vs Winner 2
            { name: "Team 1", score: 2 },
            { name: "Team 3", score: 3 }, 
          ],
        },
        {
          id: 6,
          date: "Wed Jul 08 2023",
          teams: [ // Winner 3 vs Winner 4
            { name: "Team 5", score: 4 },
            { name: "Team 8", score: 1 },
          ],
        },
      ],
    },
    // Left side - Finals (leads to one side of Championship)
    {
      title: "Finals",
      seeds: [
        {
          id: 7,
          date: "Wed Jul 12 2023",
          teams: [ // Winner of SF1(Left) vs Winner of SF2(Left)
            { name: "Team 3", score: 2 }, 
            { name: "Team 5", score: 3 },
          ],
        },
      ],
    },
    // Championship - Central round
    {
      title: "Championship",
      seeds: [
        {
          id: 8, 
          date: "Wed Jul 15 2023",
          teams: [
            { name: "Team 5", score: 4 }, // Winner of Finals (Left Side)
            { name: "Team 9", score: 3 }, // Winner of Finals (Right Side)
          ],
        },
      ],
    },
    // Right side - Finals (leads to other side of Championship)
    {
      title: "Finals",
      seeds: [
        {
          id: 9, 
          date: "Wed Jul 12 2023",
          teams: [ // Winner of SF1(Right) vs Winner of SF2(Right)
            { name: "Team 9", score: 5 }, 
            { name: "Team 15", score: 3 },
          ],
        },
      ],
    },
    // Right side - Semi Finals
    {
      title: "Semi Finals",
      seeds: [
        {
          id: 10, 
          date: "Wed Jul 08 2023",
          teams: [ 
            // Winner QF1(Right) vs Winner QF2(Right) 
            // Based on scores: Team 15 (from id:12) vs Team 13 (from id:13) -> Team 15 wins
            { name: "Team 15", score: 2 }, // Team 15 (advances from QF_R)
            { name: "Team 13", score: 1 }, // Team 13 (advances from QF_R)
          ],
        },
        {
          id: 11, 
          date: "Wed Jul 08 2023",
          teams: [ 
            // Winner QF3(Right) vs Winner QF4(Right)
            // Based on scores: Team 11 (from id:14) vs Team 9 (from id:15) -> Team 9 wins
            { name: "Team 11", score: 3 }, // Team 11 (advances from QF_R)
            { name: "Team 9", score: 5 }, // Team 9 (advances from QF_R)
          ],
        },
      ],
    },
    // Right side - Quarter Finals
    {
      title: "Quarter Finals",
      seeds: [
        {
          id: 12, 
          date: "Wed Jul 05 2023",
          teams: [
            { name: "Team 15", score: 3 },
            { name: "Team 16", score: 1 },
          ],
        },
        {
          id: 13, 
          date: "Wed Jul 05 2023",
          teams: [
            { name: "Team 13", score: 5 },
            { name: "Team 14", score: 4 },
          ],
        },
        {
          id: 14, 
          date: "Wed Jul 05 2023",
          teams: [
            { name: "Team 11", score: 3 },
            { name: "Team 12", score: 2 },
          ],
        },
        {
          id: 15, 
          date: "Wed Jul 05 2023",
          teams: [
            { name: "Team 9", score: 4 },
            { name: "Team 10", score: 1 },
          ],
        },
      ],
    },
  ]);

  // Split rounds for layout
  const leftPathRounds = rounds.slice(0, 3);    // QF-L, SF-L, Finals-L
  const championshipRound = rounds.slice(3, 4); // Championship
  const rightPathRounds = rounds.slice(4);      // Finals-R, SF-R, QF-R (Order for react-brackets, mirroring handles visual)


  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6 text-center font-headline text-primary">Two Sided Single Elimination (16 Teams)</h1>
       <p className="text-center text-muted-foreground mb-6">
        This bracket displays a 16-team tournament. Scores and progression are illustrative.
      </p>
      <div className="overflow-x-auto bg-card p-2 rounded-lg shadow-lg">
        <div className="min-w-[1600px] p-4"> {/* Adjust min-width as needed */}
          <div className="flex justify-center items-start">
            {/* Left side of the bracket */}
            <div className="flex-initial mx-2">
              <Bracket
                rounds={leftPathRounds}
                renderSeedComponent={CustomSeedInternal}
                roundTitleComponent={RoundTitleInternal}
              />
            </div>

            {/* Championship in the middle */}
            <div className="flex-initial mx-2 pt-[calc(2*6rem)]"> {/* Adjust pt to align vertically */}
              <Bracket
                rounds={championshipRound}
                renderSeedComponent={CustomSeedInternal}
                roundTitleComponent={RoundTitleInternal}
              />
            </div>

            {/* Right side of the bracket (mirrored) */}
            <div className="flex-initial mx-2">
              <div className="mirror-bracket">
                <Bracket
                  rounds={rightPathRounds}
                  renderSeedComponent={(props: any) => CustomSeedInternal({ ...props, isRightSide: true })}
                  roundTitleComponent={RoundTitleInternal}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RoundTitleInternal({ title, roundIndex }: { title: ReactNode; roundIndex: number }) {
  return <div className="text-center text-lg font-semibold text-muted-foreground mb-3 mt-2 py-1 px-3 bg-muted/50 rounded-md">{title}</div>
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

  let winnerIndex: 0 | 1 | undefined = undefined;
  let winnerName: string | undefined = undefined;

  if (team1?.score !== undefined && team2?.score !== undefined) {
    if (team1.score > team2.score) {
      winnerIndex = 0;
      winnerName = team1.name;
    } else if (team2.score > team1.score) {
      winnerIndex = 1;
      winnerName = team2.name;
    }
  } else if (team1?.score !== undefined) { // Case where only one team has a score (e.g. TBD opponent)
      winnerIndex = 0; // Assume team with score advances if opponent is TBD or has no score
      winnerName = team1.name;
  } else if (team2?.score !== undefined) {
      winnerIndex = 1;
      winnerName = team2.name;
  }
  
  const seedWrapperStyle = isRightSide ? { transform: "scaleX(-1)" } : {};
  // The content itself needs to be mirrored back if the seed container is mirrored
  const seedContentStyle = isRightSide ? { transform: "scaleX(-1)" } : {};

  return (
    <Seed mobileBreakpoint={breakpoint} style={seedWrapperStyle}>
      <SeedItem className="bg-transparent border-none shadow-none"> {/* Removed default SeedItem styling */}
        <div className="flex flex-col items-center" style={seedContentStyle}>
          <Card className="w-[220px] rounded-md overflow-hidden shadow-md border-border">
            <div className="flex flex-col">
              <TeamItemInternal team={team1} isWinner={winnerIndex === 0} />
              <div className="border-t border-border/50"></div>
              <TeamItemInternal team={team2} isWinner={winnerIndex === 1} />
            </div>
            {/* Add winner bar only if a clear winner is determined */}
            {winnerName && (
              <div className="text-xs font-bold py-1 px-3 text-center bg-primary text-primary-foreground">
                Winner: {winnerName}
              </div>
            )}
          </Card>
          {seed.date && <div className="text-xs text-muted-foreground mt-1.5 text-center">{seed.date}</div>}
        </div>
      </SeedItem>
    </Seed>
  )
}

function TeamItemInternal({ team, isWinner }: { team: Team | undefined; isWinner?: boolean }) {
  if (!team || !team.name) return (
    <div className="py-2 px-3 flex justify-between items-center bg-muted/50 text-muted-foreground min-h-[36px]">
        <span className="text-sm italic">TBD</span>
    </div>
  );

  return (
    <div
      className={`py-2 px-3 flex justify-between items-center min-h-[36px] transition-colors
        ${isWinner ? "bg-accent text-accent-foreground font-semibold" : "bg-card text-card-foreground"}
      `}
    >
      <span className="text-sm">{team.name}</span>
      {team.score !== undefined && <span className="text-sm font-mono">{team.score}</span>}
    </div>
  )
}

    