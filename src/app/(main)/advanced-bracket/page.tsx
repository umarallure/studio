
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

// Define types for the AdvancedBracket's specific data structure (for static data initially)
interface AdvancedTeam {
  name: string | null; 
  score?: number;
}

interface AdvancedSeedProps {
  id: number | string;
  date: string;
  teams: AdvancedTeam[];
}

interface AdvancedRound extends ReactBracketsRoundProps {
  title: string; 
  seeds: AdvancedSeedProps[];
}

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
        { id: 8, date: "Wed Jul 15 2023", teams: [{ name: "Team 5", score: 4 }, { name: "Team 9", score: 3 }] },
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
        { id: 10, date: "Wed Jul 08 2023", teams: [{ name: "Team 13", score: 1 }, { name: "Team 15", score: 2 }] },
        { id: 11, date: "Wed Jul 08 2023", teams: [{ name: "Team 9", score: 5 }, { name: "Team 11", score: 3 }] },
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
        setIsLoadingBracketData(false); // Ensure loading is false for 0-round tournaments
      } else if (!isLoadingTournament && !activeTournament && !criticalError) {
        // If no tournament was found or there was an error handled by criticalError already.
        setIsLoadingBracketData(false);
      }
      return;
    }

    console.log(`[AdvancedBracket Effect 2] Active tournament: "${activeTournament.name}". Setting up listeners for ${activeTournament.numberOfRounds} rounds.`);
    setIsLoadingBracketData(true);
    // No criticalError reset here, as it might come from tournament fetching.
    // We only set specific bracket data errors if they occur.
    setRawMatchDataByRound({}); // Reset raw data

    const unsubscribes: (() => void)[] = [];
    let roundsProcessedCount = 0;
    const totalListenersExpected = activeTournament.numberOfRounds;
    const initialLoadTracker: { [roundId: string]: boolean } = {};


    const checkAllInitialLoadsComplete = () => {
      if (Object.keys(initialLoadTracker).length === totalListenersExpected) {
        console.log(`[AdvancedBracket Effect 2] All ${totalListenersExpected} rounds processed initial data/error. Setting isLoadingBracketData to false.`);
        setIsLoadingBracketData(false);
         // In the future, data transformation logic would go here.
        console.log("[AdvancedBracket Effect 2] Placeholder: All raw data fetched. Current rawMatchDataByRound:", rawMatchDataByRound);
      }
    };

    for (let i = 1; i <= activeTournament.numberOfRounds; i++) {
      const roundIdStr = String(i);
      initialLoadTracker[roundIdStr] = false; // Mark as not yet loaded

      const matchesCollectionRef = collection(db, "tournaments", activeTournament.id, "rounds", roundIdStr, 'matches');
      const qMatches = query(matchesCollectionRef, orderBy('__name__')); // Order by match ID (e.g., match1, match2)
      console.log(`[AdvancedBracket Effect 2] Setting up listener for Round ${roundIdStr}`);

      const unsubscribeRound = onSnapshot(qMatches, (snapshot) => {
        const matchupsForRound: MatchupType[] = [];
        snapshot.forEach((matchDoc) => {
          // Using mapFirestoreDocToMatchup for consistency, assuming it handles the 'fields' structure.
          const matchup = mapFirestoreDocToMatchup(matchDoc.id, roundIdStr, matchDoc.data());
          if (matchup) {
            matchupsForRound.push(matchup);
          } else {
            console.warn(`[AdvancedBracket Effect 2] Failed to map matchDoc ${matchDoc.id} in Round ${roundIdStr}`);
          }
        });
        
        setRawMatchDataByRound(prev => {
          const updatedRawData = { ...prev, [roundIdStr]: matchupsForRound };
          // console.log(`[AdvancedBracket Effect 2] Raw data updated for Round ${roundIdStr}. Current full rawMatchDataByRound:`, updatedRawData);
          return updatedRawData;
        });

        if (!initialLoadTracker[roundIdStr]) {
            initialLoadTracker[roundIdStr] = true;
            roundsProcessedCount++;
            console.log(`[AdvancedBracket Effect 2] Initial data loaded for Round ${roundIdStr} (${roundsProcessedCount}/${totalListenersExpected}).`);
            checkAllInitialLoadsComplete();
        }

      }, (error) => {
        console.error(`[AdvancedBracket Effect 2] Error fetching matchups for Round ${roundIdStr}:`, error);
        toast({
          title: `Error Loading Round ${roundIdStr}`,
          description: "Could not load data for this round. Display may be incomplete.",
          variant: "destructive",
        });
        if (!initialLoadTracker[roundIdStr]) {
            initialLoadTracker[roundIdStr] = true; // Mark as processed even on error for loading state
            roundsProcessedCount++;
            console.log(`[AdvancedBracket Effect 2] Error on initial load for Round ${roundIdStr} (${roundsProcessedCount}/${totalListenersExpected}).`);
            checkAllInitialLoadsComplete();
        }
        // Optionally set a partial error state for the UI if needed
      });
      unsubscribes.push(unsubscribeRound);
    }

    return () => {
      console.log("[AdvancedBracket Effect 2] Cleanup: Unsubscribing from Firestore listeners.");
      unsubscribes.forEach(unsub => unsub());
    };
  }, [activeTournament, isLoadingTournament, toast]); // Removed rawMatchDataByRound to avoid re-triggering on its own update


  // --- Rendering Logic (using displayRounds, which is static for now) ---
  const leftPathRounds = displayRounds.slice(0, 3);
  const championshipRound = displayRounds.slice(3, 4);
  const rightPathRoundsData = displayRounds.slice(4);
  
  // Ensure right path seeds are reversed for correct visual order when mirrored
  const rightPathRounds = rightPathRoundsData.map(round => ({
    ...round,
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

  if (criticalError && !activeTournament) { // Only show critical error if no tournament could be loaded at all
     return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h2 className="text-3xl font-headline text-destructive mt-4">Error</h2>
        <p className="text-muted-foreground max-w-lg">{criticalError}</p>
      </div>
    );
  }
  
  if (!activeTournament && !isLoadingTournament) { // Handles case where no tournaments exist but no fetch error
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <Info className="h-16 w-16 text-primary" />
        <h2 className="text-3xl font-headline text-primary mt-4">No Tournament Active</h2>
        <p className="text-muted-foreground max-w-lg">Please create or select a tournament.</p>
      </div>
    );
  }
  
  if (activeTournament && activeTournament.numberOfRounds === 0 && !isLoadingBracketData) {
     return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <Info className="h-16 w-16 text-primary" />
        <h2 className="text-3xl font-headline text-primary mt-4">Tournament Has No Rounds</h2>
        <p className="text-muted-foreground max-w-lg">"{activeTournament.name}" is configured with 0 rounds. No bracket to display.</p>
      </div>
    );
  }


  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-2 text-center font-headline text-primary">
        {activeTournament?.name || "Tournament Bracket"} (Advanced View)
      </h1>
      {isLoadingBracketData && activeTournament && activeTournament.numberOfRounds > 0 && (
         <p className="text-center text-sm text-muted-foreground mb-4 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading live bracket data... ({Object.values(rawMatchDataByRound).flat().length} matches fetched so far)
        </p>
      )}
       <p className="text-center text-muted-foreground mb-6 text-xs">
        This is an advanced bracket view. For detailed daily results, see the main <a href="/bracket" className="underline text-primary hover:text-primary/80">Bracket Page</a>.
        <br/>Currently displaying static sample data. Dynamic data is being fetched in the background (check console).
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
            <div className="flex-initial mx-2 pt-[calc(3*6rem+1.5rem)]"> {/* Adjust pt for vertical alignment based on seed height */}
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

// Internal components for rendering the bracket - using theme colors

function RoundTitleInternal({ title, roundIndex }: { title: ReactNode; roundIndex: number }) {
  return <div className="text-center text-lg font-semibold text-muted-foreground mb-3 mt-2 py-1 px-3 bg-muted/50 rounded-md">{String(title)}</div>;
}

function CustomSeedInternal({
  seed,
  breakpoint, // This prop comes from react-brackets
  roundIndex,
  seedIndex,
  isRightSide = false,
}: { seed: AdvancedSeedProps; breakpoint: string; roundIndex: number; seedIndex: number; isRightSide?: boolean }) {
  
  const team1 = seed.teams[0];
  const team2 = seed.teams[1];

  let winnerName: string | null = null;
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
      winnerIndex = 0;
      winnerName = team1.name;
  } else if (team2?.name && team2.name.toLowerCase() !== "tbd" && team2.score !== undefined && (!team1?.name || team1.name.toLowerCase() === "tbd")) {
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
             {(!team1?.name || team1.name.toLowerCase() === "tbd" || !team2?.name || team2.name.toLowerCase() === "tbd") && !winnerName && (
                 <div className="text-xs py-1 px-3 text-center bg-muted text-muted-foreground">
                    Awaiting Teams
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
      <span className="text-sm">{team.name}</span>
      {team.score !== undefined && <span className="text-sm font-mono">{team.score}</span>}
    </div>
  );
}
    

      