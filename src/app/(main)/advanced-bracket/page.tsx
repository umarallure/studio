
"use client"

import type { ReactNode } from "react";
import { useState, useEffect, useCallback } from "react";
import { Bracket, Seed, SeedItem, type RoundProps as ReactBracketsRoundProps } from "react-brackets";
import { Card } from "@/components/ui/card";
import "@/app/styles/bracket.css"; // Ensure styles are applied

import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, getDocs, doc, type DocumentData } from 'firebase/firestore';
import { mapFirestoreDocToMatchup, mapDocToTournamentSettings } from '@/lib/tournament-config';
import type { TournamentSettings, Matchup as MatchupType } from '@/lib/types';
import { Loader2, AlertTriangle, Info } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

// Define types for the AdvancedBracket's specific data structure
interface AdvancedTeam {
  name: string | null; // Allow null for TBD
  score?: number;
}

interface AdvancedSeedProps {
  id: number | string;
  date: string;
  teams: AdvancedTeam[];
  // Winner is derived from scores in CustomSeedInternal
}

interface AdvancedRound extends ReactBracketsRoundProps {
  title: string; // Ensure title is always string
  seeds: AdvancedSeedProps[];
}


// --- Static Data (will be replaced by dynamic data later) ---
const staticRoundsData: AdvancedRound[] = [
    // Left side - Quarter Finals
    {
      title: "Quarter Finals",
      seeds: [
        { id: 1, date: "Wed Jul 05 2023", teams: [{ name: "Team 1", score: 4 }, { name: "Team 2", score: 2 }] },
        { id: 2, date: "Wed Jul 05 2023", teams: [{ name: "Team 3", score: 5 }, { name: "Team 4", score: 1 }] },
        { id: 3, date: "Wed Jul 05 2023", teams: [{ name: "Team 5", score: 3 }, { name: "Team 6", score: 2 }] },
        { id: 4, date: "Wed Jul 05 2023", teams: [{ name: "Team 7", score: 2 }, { name: "Team 8", score: 3 }] },
      ],
    },
    // Left side - Semi Finals
    {
      title: "Semi Finals",
      seeds: [
        { id: 5, date: "Wed Jul 08 2023", teams: [{ name: "Team 1", score: 2 }, { name: "Team 3", score: 3 }] },
        { id: 6, date: "Wed Jul 08 2023", teams: [{ name: "Team 5", score: 4 }, { name: "Team 8", score: 1 }] },
      ],
    },
    // Left side - Finals
    {
      title: "Finals (Left Path)",
      seeds: [
        { id: 7, date: "Wed Jul 12 2023", teams: [{ name: "Team 3", score: 2 }, { name: "Team 5", score: 3 }] },
      ],
    },
    // Championship
    {
      title: "Championship",
      seeds: [
        { id: 8, date: "Wed Jul 15 2023", teams: [{ name: "Team 5" /*Winner L*/, score: 4 }, { name: "Team 9" /*Winner R*/, score: 3 }] },
      ],
    },
    // Right side - Finals
    {
      title: "Finals (Right Path)",
      seeds: [
        { id: 9, date: "Wed Jul 12 2023", teams: [{ name: "Team 9", score: 5 }, { name: "Team 15", score: 3 }] },
      ],
    },
    // Right side - Semi Finals
    {
      title: "Semi Finals",
      seeds: [
        { id: 10, date: "Wed Jul 08 2023", teams: [{ name: "Team 15", score: 2 }, { name: "Team 13", score: 1 } ] }, // Note: Original data had team 13 winning then losing. Corrected for progression.
        { id: 11, date: "Wed Jul 08 2023", teams: [{ name: "Team 9", score: 5 }, { name: "Team 11", score: 3 } ] },
      ],
    },
    // Right side - Quarter Finals
    {
      title: "Quarter Finals",
      seeds: [
        { id: 12, date: "Wed Jul 05 2023", teams: [{ name: "Team 15", score: 3 }, { name: "Team 16", score: 1 }] },
        { id: 13, date: "Wed Jul 05 2023", teams: [{ name: "Team 13", score: 5 }, { name: "Team 14", score: 4 }] },
        { id: 14, date: "Wed Jul 05 2023", teams: [{ name: "Team 11", score: 3 }, { name: "Team 12", score: 2 }] },
        { id: 15, date: "Wed Jul 05 2023", teams: [{ name: "Team 9", score: 4 }, { name: "Team 10", score: 1 }] },
      ],
    },
];
// --- End Static Data ---


export default function AdvancedTournamentBracket() {
  const [activeTournament, setActiveTournament] = useState<TournamentSettings | null>(null);
  const [isLoadingTournament, setIsLoadingTournament] = useState(true);
  const [isLoadingBracketData, setIsLoadingBracketData] = useState(false); // Initially false until tournament is loaded
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // State to hold raw fetched match data by round, before transformation
  const [rawMatchDataByRound, setRawMatchDataByRound] = useState<{ [roundId: string]: MatchupType[] }>({});

  // State to hold the transformed rounds data for the bracket display
  // For now, it will use static data. Later, it will be populated from rawMatchDataByRound
  const [displayRounds, setDisplayRounds] = useState<AdvancedRound[]>(staticRoundsData);

  // Effect 1: Fetch latest tournament settings
  useEffect(() => {
    console.log("[AdvancedBracket Effect 1] Initializing: Fetching latest tournament settings.");
    setIsLoadingTournament(true);
    setCriticalError(null);
    const fetchLatestTournament = async () => {
      try {
        const tournamentsRef = collection(db, "tournaments");
        const q = query(tournamentsRef, orderBy("createdAt", "desc"), limit(1));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setCriticalError("No tournaments found. Please create a tournament first.");
          setActiveTournament(null);
        } else {
          const tournamentDoc = querySnapshot.docs[0];
          const settings = mapDocToTournamentSettings(tournamentDoc.data(), tournamentDoc.id);
          
          if (!settings || !settings.id || typeof settings.numberOfRounds !== 'number' || settings.numberOfRounds < 0) {
            setCriticalError(`Fetched tournament "${settings?.name || 'Unknown'}" has invalid configuration.`);
            setActiveTournament(null);
          } else {
            setActiveTournament(settings);
            console.log("[AdvancedBracket Effect 1] Active tournament set:", settings.name, "ID:", settings.id, "Rounds:", settings.numberOfRounds);
          }
        }
      } catch (error) {
        console.error("[AdvancedBracket Effect 1] Error fetching latest tournament:", error);
        setCriticalError("Failed to load tournament settings.");
        setActiveTournament(null);
      } finally {
        setIsLoadingTournament(false);
      }
    };
    fetchLatestTournament();
  }, []);

  // Effect 2: Fetch match data when activeTournament is set
  useEffect(() => {
    if (!activeTournament || !activeTournament.id || typeof activeTournament.numberOfRounds !== 'number' || activeTournament.numberOfRounds <= 0) {
      if (!isLoadingTournament && !criticalError && activeTournament && activeTournament.numberOfRounds === 0) {
        console.log(`[AdvancedBracket Effect 2] Tournament "${activeTournament.name}" has 0 rounds. No bracket data to fetch.`);
        // TODO: Handle 0-round tournament display (e.g., show a message)
        // For now, we'll let it fall through to static or empty display.
        setIsLoadingBracketData(false);
      }
      return;
    }

    console.log(`[AdvancedBracket Effect 2] Active tournament: "${activeTournament.name}". Setting up listeners for ${activeTournament.numberOfRounds} rounds.`);
    setIsLoadingBracketData(true);
    setCriticalError(null); // Clear previous bracket data errors
    setRawMatchDataByRound({}); // Reset raw data

    const unsubscribes: (() => void)[] = [];
    let roundsProcessedCount = 0;
    const totalListenersExpected = activeTournament.numberOfRounds;

    const checkAllInitialLoadsComplete = () => {
      roundsProcessedCount++;
      console.log(`[AdvancedBracket Effect 2] Round initial data/error (${roundsProcessedCount}/${totalListenersExpected}).`);
      if (roundsProcessedCount >= totalListenersExpected) {
        console.log(`[AdvancedBracket Effect 2] All ${totalListenersExpected} rounds processed initial data. Setting isLoadingBracketData to false.`);
        setIsLoadingBracketData(false);
        // TODO: Trigger data transformation here
        console.log("[AdvancedBracket Effect 2] Placeholder: Data transformation would occur now with all raw data.");
      }
    };

    for (let i = 1; i <= activeTournament.numberOfRounds; i++) {
      const roundIdStr = String(i);
      const matchesCollectionRef = collection(db, "tournaments", activeTournament.id, "rounds", roundIdStr, 'matches');
      const qMatches = query(matchesCollectionRef, orderBy('__name__'));
      console.log(`[AdvancedBracket Effect 2] Setting up listener for Round ${roundIdStr}`);

      const unsubscribeRound = onSnapshot(qMatches, (snapshot) => {
        const matchupsForRound: MatchupType[] = [];
        snapshot.forEach((matchDoc) => {
          const matchup = mapFirestoreDocToMatchup(matchDoc.id, roundIdStr, matchDoc.data());
          if (matchup) {
            matchupsForRound.push(matchup);
          }
        });
        
        setRawMatchDataByRound(prev => {
          const updatedRawData = { ...prev, [roundIdStr]: matchupsForRound };
          console.log(`[AdvancedBracket Effect 2] Raw data updated for Round ${roundIdStr}:`, matchupsForRound);
          console.log(`[AdvancedBracket Effect 2] Current full rawMatchDataByRound:`, updatedRawData);
          // TODO: Data transformation and setDisplayRounds will happen based on updatedRawData
          // For now, this log confirms data is being fetched.
          return updatedRawData;
        });

        if (!unsubscribes.find(u => u === unsubscribeRound && (roundsProcessedCount < totalListenersExpected))) { // Check if this is the initial load for this listener
            // This check might be tricky with onSnapshot. A better way is to track if initial load for this round completed.
            // For simplicity, we'll use the overall roundsProcessedCount for now.
        }
        checkAllInitialLoadsComplete(); // Call this on every update for now to ensure loading state is handled

      }, (error) => {
        console.error(`[AdvancedBracket Effect 2] Error fetching matchups for Round ${roundIdStr}:`, error);
        toast({
          title: `Error Loading Round ${roundIdStr}`,
          description: "Could not load data for this round.",
          variant: "destructive",
        });
        setCriticalError(prev => prev || `Failed to load Round ${roundIdStr} data.`);
        checkAllInitialLoadsComplete(); // Also call on error to ensure loading state progresses
      });
      unsubscribes.push(unsubscribeRound);
    }

    return () => {
      console.log("[AdvancedBracket Effect 2] Cleanup: Unsubscribing from Firestore listeners.");
      unsubscribes.forEach(unsub => unsub());
    };
  }, [activeTournament, isLoadingTournament, toast]); // Dependencies for fetching bracket data


  // --- Rendering Logic (using displayRounds, which is static for now) ---
  const leftPathRounds = displayRounds.slice(0, 3);
  const championshipRound = displayRounds.slice(3, 4);
  const rightPathRounds = displayRounds.slice(4).map(round => ({
    ...round,
    // Reverse seeds for correct visual rendering order in mirrored bracket
    seeds: [...round.seeds].reverse(),
  }));


  if (isLoadingTournament) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-foreground font-headline">Loading Tournament Info...</p>
      </div>
    );
  }

  if (criticalError && !activeTournament) {
     return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h2 className="text-3xl font-headline text-destructive mt-4">Error</h2>
        <p className="text-muted-foreground max-w-lg">{criticalError}</p>
      </div>
    );
  }
  
  if (!activeTournament && !isLoadingTournament) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <Info className="h-16 w-16 text-primary" />
        <h2 className="text-3xl font-headline text-primary mt-4">No Tournament Active</h2>
        <p className="text-muted-foreground max-w-lg">Please create or select a tournament.</p>
      </div>
    );
  }
  
  // TODO: Add a specific message or UI for when activeTournament.numberOfRounds === 0

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-2 text-center font-headline text-primary">
        {activeTournament?.name || "Tournament Bracket"} (Advanced View)
      </h1>
      {isLoadingBracketData && activeTournament && activeTournament.numberOfRounds > 0 && (
         <p className="text-center text-sm text-muted-foreground mb-4 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading live bracket data...
        </p>
      )}
      {!isLoadingBracketData && criticalError && (
         <p className="text-center text-sm text-destructive mb-4 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 mr-2" /> Error loading some bracket data: {criticalError}
        </p>
      )}
       <p className="text-center text-muted-foreground mb-6 text-xs">
        This is an advanced bracket view. For detailed daily results, see the main <a href="/bracket" className="underline text-primary hover:text-primary/80">Bracket Page</a>.
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
            <div className="flex-initial mx-2 pt-[calc(3*6rem+1.5rem)]"> {/* Adjust pt for vertical alignment */}
              {championshipRound.length > 0 ? (
                <Bracket
                  rounds={championshipRound}
                  renderSeedComponent={CustomSeedInternal}
                  roundTitleComponent={RoundTitleInternal}
                />
              ) : (
                <div className="w-[220px] text-center text-muted-foreground">Championship TBD</div>
              )}
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
  return <div className="text-center text-lg font-semibold text-muted-foreground mb-3 mt-2 py-1 px-3 bg-muted/50 rounded-md">{String(title)}</div>;
}

function CustomSeedInternal({
  seed,
  breakpoint,
  roundIndex,
  seedIndex,
  isRightSide = false,
}: { seed: AdvancedSeedProps; breakpoint: string; roundIndex: number; seedIndex: number; isRightSide?: boolean }) {
  
  const team1 = seed.teams[0];
  const team2 = seed.teams[1];

  let winnerName: string | null = null; // Changed from undefined to null
  let winnerIndex: 0 | 1 | undefined = undefined;

  if (team1?.score !== undefined && team2?.score !== undefined) {
    if (team1.score > team2.score) {
      winnerIndex = 0;
      winnerName = team1.name;
    } else if (team2.score > team1.score) {
      winnerIndex = 1;
      winnerName = team2.name;
    }
  } else if (team1?.name && team1.name.toLowerCase() !== "tbd" && team1.score !== undefined && (!team2?.name || team2.name.toLowerCase() === "tbd")) {
      // If team1 exists, has a score, and team2 is TBD
      winnerIndex = 0;
      winnerName = team1.name;
  } else if (team2?.name && team2.name.toLowerCase() !== "tbd" && team2.score !== undefined && (!team1?.name || team1.name.toLowerCase() === "tbd")) {
      // If team2 exists, has a score, and team1 is TBD
      winnerIndex = 1;
      winnerName = team2.name;
  }
  
  const seedWrapperStyle = isRightSide ? { transform: "scaleX(-1)" } : {};
  const seedContentStyle = isRightSide ? { transform: "scaleX(-1)" } : {};

  return (
    <Seed mobileBreakpoint={breakpoint} style={seedWrapperStyle}>
      <SeedItem className="bg-transparent border-none shadow-none">
        <div className="flex flex-col items-center" style={seedContentStyle}>
          <Card className="w-[220px] rounded-md overflow-hidden shadow-md border-border">
            <div className="flex flex-col">
              <TeamItemInternal team={team1} isWinner={winnerIndex === 0} />
              <div className="border-t border-border/50"></div>
              <TeamItemInternal team={team2} isWinner={winnerIndex === 1} />
            </div>
            {winnerName && (
              <div className="text-xs font-bold py-1 px-3 text-center bg-primary text-primary-foreground">
                Winner: {winnerName}
              </div>
            )}
             {!winnerName && team1?.name && team1.name.toLowerCase() !== "tbd" && team2?.name && team2.name.toLowerCase() !== "tbd" && (
                <div className="text-xs py-1 px-3 text-center bg-muted text-muted-foreground">
                    Match Pending
                </div>
            )}
          </Card>
          {seed.date && <div className="text-xs text-muted-foreground mt-1.5 text-center">{seed.date}</div>}
        </div>
      </SeedItem>
    </Seed>
  )
}

function TeamItemInternal({ team, isWinner }: { team: AdvancedTeam | undefined; isWinner?: boolean }) {
  if (!team || !team.name || team.name.toLowerCase() === "tbd") return (
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
      <span className="text-sm text-black">{team.name}</span> {/* Ensured text-black as per previous request */}
      {team.score !== undefined && <span className="text-sm font-mono">{team.score}</span>}
    </div>
  );
}
    