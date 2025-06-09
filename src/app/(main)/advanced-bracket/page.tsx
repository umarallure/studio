
"use client"

import type { ReactNode } from "react";
import { useState, useEffect, useCallback } from "react";
import { Bracket, Seed, SeedItem, type RoundProps as ReactBracketsRoundProps } from "react-brackets";
import { Card, CardContent } from "@/components/ui/card";
import "@/app/styles/bracket.css"; // Ensure this is imported if not globally

import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, getDocs, doc, type DocumentData, where } from 'firebase/firestore';
import { mapFirestoreDocToMatchup, mapDocToTournamentSettings } from '@/lib/tournament-config';
import type { TournamentSettings, Matchup as MatchupType } from '@/lib/types';
import MatchDetailPanel from '@/components/bracket/MatchDetailPanel';
import { Loader2, AlertTriangle, Info, Trophy } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format as formatDate, addDays, parseISO } from 'date-fns';

// Define types for the AdvancedBracket's specific data structure
interface AdvancedTeam {
  name: string | null;
  score?: number;
}

interface AdvancedSeedProps {
  id: string; // Match ID from Firestore
  date: string; // Formatted date for display
  teams: [AdvancedTeam, AdvancedTeam];
  // Winner can be implicitly determined by scores for highlighting in TeamItemInternal
}

interface AdvancedRound extends ReactBracketsRoundProps {
  title: string;
  seeds: AdvancedSeedProps[];
}

// --- Helper Function for Round Titles ---
const getDisplayRoundTitle = (displayRoundIndex: number, teamCount: number): string => {
  // This function assumes a standard single elimination bracket progression.
  // Titles are based on a 16-team (4-round) tournament progressing to the 7-part display.
  if (teamCount === 16) {
    switch (displayRoundIndex) {
      case 0: return "Quarter Finals"; // Left QF (Real Round 2 if Round 1 was Round-of-16) - this needs adjustment if we have a Round-of-16
      case 1: return "Semi Finals";  // Left SF
      case 2: return "Finals";       // Left F (Effectively a semi-final for the whole tournament)
      case 3: return "Championship"; // Grand Final
      case 4: return "Finals";       // Right F (Effectively other semi-final)
      case 5: return "Semi Finals";  // Right SF
      case 6: return "Quarter Finals"; // Right QF
      default: return `Round ${displayRoundIndex + 1}`;
    }
  } else if (teamCount === 8) { // 3 real rounds, 5 display rounds (QF, SF, Champ, SF, QF)
     switch (displayRoundIndex) {
      case 0: return "Semi Finals"; // Left SF (Real Round 2)
      case 1: return "Finals";    // Left F (Real Round 3 part 1)
      case 2: return "Championship"; // (Real Round 3 part 2 or actual Final) - logic might need specific team count handling for structure
      case 3: return "Finals";    // Right F
      case 4: return "Semi Finals"; // Right SF
      default: return `Round ${displayRoundIndex + 1}`;
    }
  }
  // Default for other team counts or if logic isn't exhaustive
  return `Display Round ${displayRoundIndex + 1}`;
};

// --- Helper Function to map Firestore Matchup to AdvancedSeedProps ---
const mapMatchupToAdvancedSeed = (matchup: MatchupType, tournamentStartDate: Date): AdvancedSeedProps => {
  const roundNum = parseInt(matchup.roundId, 10);
  // For display, use the start of the week for that round.
  // The actual match days within that week are handled by the dailyResults.
  const matchWeekStartDate = addDays(tournamentStartDate, (roundNum - 1) * 7);

  return {
    id: matchup.id,
    date: formatDate(matchWeekStartDate, "MMM d, yyyy"), // Displaying start of the week for simplicity
    teams: [
      { name: matchup.team1Name, score: matchup.team1DailyWins },
      { name: matchup.team2Name, score: matchup.team2DailyWins },
    ],
  };
};

export default function AdvancedTournamentBracket() {
  const [activeTournament, setActiveTournament] = useState<TournamentSettings | null>(null);
  const [isLoadingTournament, setIsLoadingTournament] = useState(true);
  const [isLoadingBracketData, setIsLoadingBracketData] = useState(false);
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const { toast } = useToast();

  const [rawMatchDataByRound, setRawMatchDataByRound] = useState<{ [roundId: string]: MatchupType[] }>({});
  const [dynamicDisplayRounds, setDynamicDisplayRounds] = useState<AdvancedRound[] | null>(null);

  const [isMatchDetailPanelOpen, setIsMatchDetailPanelOpen] = useState(false);
  const [selectedMatchupForPanel, setSelectedMatchupForPanel] = useState<MatchupType | null>(null);

  // Effect 1: Fetch latest tournament settings
  useEffect(() => {
    setIsLoadingTournament(true);
    setCriticalError(null);
    const fetchLatestTournament = async () => {
      try {
        const tournamentsRef = collection(db, "tournaments");
        // Fetch the tournament that is not "Completed", or the latest one if all are completed.
        let q = query(tournamentsRef, where("status", "!=", "Completed"), orderBy("status"), orderBy("createdAt", "desc"), limit(1));
        let querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          // If no non-completed tournament, fetch the absolute latest one
          q = query(tournamentsRef, orderBy("createdAt", "desc"), limit(1));
          querySnapshot = await getDocs(q);
        }
        
        if (querySnapshot.empty) {
          setCriticalError("No tournaments found. Please create one first.");
          setActiveTournament(null);
        } else {
          const tournamentDoc = querySnapshot.docs[0];
          const settings = mapDocToTournamentSettings(tournamentDoc.data(), tournamentDoc.id);
          if (!settings || !settings.id || typeof settings.numberOfRounds !== 'number' || settings.numberOfRounds < 0) {
            setCriticalError(`Fetched tournament "${settings?.name || 'Unknown'}" has invalid configuration (ID or numberOfRounds missing/invalid).`);
            setActiveTournament(null);
          } else {
            setActiveTournament(settings);
          }
        }
      } catch (error) {
        console.error("Error fetching latest tournament:", error);
        setCriticalError("Failed to load tournament settings. Check console for details.");
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
      if (!isLoadingTournament && activeTournament && activeTournament.numberOfRounds === 0) {
        // Handle 0-round tournaments (set empty bracket)
        setIsLoadingBracketData(false);
        setDynamicDisplayRounds([]); // Explicitly set to empty array for 0 rounds
        setRawMatchDataByRound({});
      } else if (!isLoadingTournament && !activeTournament && !criticalError) {
        // No active tournament found and not already in an error state
        setIsLoadingBracketData(false);
      }
      return;
    }

    setIsLoadingBracketData(true);
    setRawMatchDataByRound({}); // Reset raw data
    setDynamicDisplayRounds(null); // Reset display data

    const unsubscribes: (() => void)[] = [];
    let roundsDataCollectedCount = 0;
    const totalListenersExpected = activeTournament.numberOfRounds;

    const allRoundsData: { [key: string]: MatchupType[] } = {};

    for (let i = 1; i <= activeTournament.numberOfRounds; i++) {
      const roundIdStr = String(i);
      const matchesCollectionRef = collection(db, "tournaments", activeTournament.id, "rounds", roundIdStr, 'matches');
      const qMatches = query(matchesCollectionRef, orderBy('__name__')); // Order by match ID (e.g., match1, match2)

      const unsubscribeRound = onSnapshot(qMatches, (snapshot) => {
        console.log(`[AdvBracket Effect 2] Data received for Tournament ${activeTournament.id}, Round ${roundIdStr}. Processing ${snapshot.docs.length} matches.`);
        const matchupsForRound: MatchupType[] = [];
        snapshot.forEach((matchDoc) => {
          const matchup = mapFirestoreDocToMatchup(matchDoc.id, roundIdStr, matchDoc.data());
          if (matchup) {
            matchupsForRound.push(matchup);
          }
        });
        
        allRoundsData[roundIdStr] = matchupsForRound;
        
        // Check if this is the first time data for this round is collected
        // This logic is simplified; a better check might involve tracking initial load completion per round
        if (!rawMatchDataByRound[roundIdStr] || rawMatchDataByRound[roundIdStr].length === 0 && matchupsForRound.length > 0) {
            roundsDataCollectedCount++; // Increment when a round provides data for the first time
        }

        // Check if all expected rounds have at least been attempted (even if some are empty initially)
        const currentCollectedRoundKeys = Object.keys(allRoundsData);
        let allExpectedRoundsPresent = true;
        for(let r = 1; r <= totalListenersExpected; r++){
            if(!currentCollectedRoundKeys.includes(String(r))){
                allExpectedRoundsPresent = false;
                break;
            }
        }

        if (allExpectedRoundsPresent) {
          console.log("[AdvBracket Effect 2] All expected rounds have data (or attempted fetch). Updating rawMatchDataByRound.");
          setRawMatchDataByRound({...allRoundsData}); // Update with the latest snapshot of all rounds
        }

      }, (error) => {
        console.error(`Error fetching matchups for Tournament ${activeTournament.id}, Round ${roundIdStr}:`, error);
        toast({
          title: `Error Loading Round ${roundIdStr}`,
          description: "Could not load data for this round.",
          variant: "destructive",
        });
         allRoundsData[roundIdStr] = []; // Ensure round exists in keys even on error
         const currentCollectedRoundKeys = Object.keys(allRoundsData);
         let allExpectedRoundsPresentOnError = true;
         for(let r = 1; r <= totalListenersExpected; r++){
            if(!currentCollectedRoundKeys.includes(String(r))){
                allExpectedRoundsPresentOnError = false;
                break;
            }
        }
        if(allExpectedRoundsPresentOnError){
            setRawMatchDataByRound({...allRoundsData});
        }
      });
      unsubscribes.push(unsubscribeRound);
    }

    // setIsLoadingBracketData(false) will be handled by the transformation effect
    return () => {
      console.log("[AdvBracket Effect 2] Cleanup: Unsubscribing from Firestore listeners.");
      unsubscribes.forEach(unsub => unsub());
    };
  }, [activeTournament, isLoadingTournament, toast]); // Removed rawMatchDataByRound from deps to avoid re-subscribing on its own update


  // Effect 3: Transform rawMatchDataByRound into dynamicDisplayRounds
  useEffect(() => {
    if (!activeTournament || !activeTournament.startDate || Object.keys(rawMatchDataByRound).length === 0) {
      // If tournament expects rounds but raw data is empty or not fully loaded yet
      if (activeTournament && activeTournament.numberOfRounds > 0 && Object.keys(rawMatchDataByRound).length < activeTournament.numberOfRounds) {
        console.log("[AdvBracket Effect 3] Waiting for all raw round data before transforming...");
        setIsLoadingBracketData(true); // Keep loading if not all raw rounds are ready
      } else if (activeTournament && activeTournament.numberOfRounds === 0) {
         setDynamicDisplayRounds([]); // Handle 0-round tournament
         setIsLoadingBracketData(false);
      }
      return;
    }

    // Ensure all expected rounds are present in rawMatchDataByRound before transforming
    let allRawRoundsAvailable = true;
    for (let i = 1; i <= activeTournament.numberOfRounds; i++) {
        if (!rawMatchDataByRound[String(i)]) {
            allRawRoundsAvailable = false;
            break;
        }
    }

    if (!allRawRoundsAvailable) {
        console.log("[AdvBracket Effect 3] Still waiting for all raw round data to become available before transforming...");
        setIsLoadingBracketData(true); // Keep loading
        return;
    }
    
    console.log("[AdvBracket Effect 3] All raw data available. Transforming rawMatchDataByRound for display.", rawMatchDataByRound);

    const newDisplayRounds: AdvancedRound[] = [];
    const { numberOfRounds, teamCount, startDate } = activeTournament;

    // This transformation logic is for a 16-TEAM (4 real rounds) tournament
    // leading to a 7-part display structure.
    if (teamCount === 16 && numberOfRounds === 4) {
      const realRound1 = rawMatchDataByRound['1'] || []; // 8 matches
      const realRound2 = rawMatchDataByRound['2'] || []; // 4 matches
      const realRound3 = rawMatchDataByRound['3'] || []; // 2 matches
      const realRound4 = rawMatchDataByRound['4'] || []; // 1 match

      // Helper to create placeholder seeds if data is missing
      const createPlaceholderSeeds = (count: number, roundNumForDate: number): AdvancedSeedProps[] => {
        return Array.from({ length: count }, (_, i) => ({
          id: `placeholder-r${roundNumForDate}-m${i}`,
          date: formatDate(addDays(startDate, (roundNumForDate - 1) * 7), "MMM d, yyyy"),
          teams: [{ name: "TBD", score: 0 }, { name: "TBD", score: 0 }],
        }));
      };
      
      // Expected number of matches for each real round in a 16-team bracket
      const expectedMatchesR1 = 8, expectedMatchesR2 = 4, expectedMatchesR3 = 2, expectedMatchesR4 = 1;

      // Left Quarter Finals (Display Round 0) - from Real Round 1, first 4 matches
      newDisplayRounds.push({
        title: getDisplayRoundTitle(0, teamCount),
        seeds: realRound1.slice(0, expectedMatchesR1 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate))
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR1 / 2) - realRound1.slice(0, expectedMatchesR1 / 2).length), 1)),
      });
      // Left Semi Finals (Display Round 1) - from Real Round 2, first 2 matches
      newDisplayRounds.push({
        title: getDisplayRoundTitle(1, teamCount),
        seeds: realRound2.slice(0, expectedMatchesR2 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate))
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR2 / 2) - realRound2.slice(0, expectedMatchesR2 / 2).length), 2)),
      });
      // Left Finals (Display Round 2) - from Real Round 3, first 1 match
      newDisplayRounds.push({
        title: getDisplayRoundTitle(2, teamCount),
        seeds: realRound3.slice(0, expectedMatchesR3 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate))
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR3 / 2) - realRound3.slice(0, expectedMatchesR3 / 2).length), 3)),
      });
      // Championship (Display Round 3) - from Real Round 4, 1 match
      newDisplayRounds.push({
        title: getDisplayRoundTitle(3, teamCount),
        seeds: realRound4.map(m => mapMatchupToAdvancedSeed(m, startDate))
               .concat(createPlaceholderSeeds(Math.max(0, expectedMatchesR4 - realRound4.length), 4)),
      });
      // Right Finals (Display Round 4) - from Real Round 3, second 1 match (seeds reversed for mirror)
      newDisplayRounds.push({
        title: getDisplayRoundTitle(4, teamCount),
        seeds: realRound3.slice(expectedMatchesR3 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate)).reverse() // .reverse() is for display
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR3 / 2) - realRound3.slice(expectedMatchesR3 / 2).length), 3)),
      });
      // Right Semi Finals (Display Round 5) - from Real Round 2, second 2 matches (seeds reversed for mirror)
      newDisplayRounds.push({
        title: getDisplayRoundTitle(5, teamCount),
        seeds: realRound2.slice(expectedMatchesR2 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate)).reverse()
                .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR2 / 2) - realRound2.slice(expectedMatchesR2 / 2).length), 2)),
      });
      // Right Quarter Finals (Display Round 6) - from Real Round 1, second 4 matches (seeds reversed for mirror)
      newDisplayRounds.push({
        title: getDisplayRoundTitle(6, teamCount),
        seeds: realRound1.slice(expectedMatchesR1 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate)).reverse()
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR1 / 2) - realRound1.slice(expectedMatchesR1 / 2).length), 1)),
      });
    } else {
      // Basic handling for other team counts or if data is not as expected for 16 teams.
      // This part would need more robust logic for different tournament sizes (8-team, 4-team).
      setCriticalError(`Bracket display logic currently optimized for 16-team tournaments. This tournament ("${activeTournament.name}") has ${teamCount} teams and ${numberOfRounds} rounds. Data transformation not applied.`);
      setDynamicDisplayRounds([]); // Show an empty bracket
      setIsLoadingBracketData(false);
      return;
    }

    setDynamicDisplayRounds(newDisplayRounds);
    setIsLoadingBracketData(false); // Transformation complete
  }, [rawMatchDataByRound, activeTournament]);


  const handleMatchupCardClick = useCallback((seedId: string) => {
    console.log("[AdvBracket] Matchup card clicked, seedId:", seedId);
    let foundMatchup: MatchupType | null = null;
    // Find the matchup in rawMatchDataByRound using the seedId
    for (const roundKey in rawMatchDataByRound) {
      const match = rawMatchDataByRound[roundKey].find(m => m.id === seedId);
      if (match) {
        foundMatchup = match;
        break;
      }
    }

    if (foundMatchup) {
        if (!foundMatchup.team1Name || foundMatchup.team1Name.toLowerCase() === "tbd" ||
            !foundMatchup.team2Name || foundMatchup.team2Name.toLowerCase() === "tbd") {
            toast({
                title: "Matchup Not Ready",
                description: "Detailed stats are available once both teams are determined for this match.",
                variant: "default",
            });
            return;
        }
      setSelectedMatchupForPanel(foundMatchup);
      setIsMatchDetailPanelOpen(true);
    } else {
      toast({
        title: "Error",
        description: "Could not find details for the selected match. Raw data may be missing or ID mismatch.",
        variant: "destructive",
      });
      console.error("Could not find matchup in rawMatchDataByRound for seedId:", seedId, "Raw data:", rawMatchDataByRound);
    }
  }, [rawMatchDataByRound, toast]);


  // --- Rendering Logic ---
  if (isLoadingTournament) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-foreground font-headline">Loading Tournament Info...</p>
      </div>
    );
  }

  if (criticalError) {
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
        <p className="text-muted-foreground max-w-lg">Please create or select a tournament. Or check Firestore for data.</p>
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

  if (isLoadingBracketData || !dynamicDisplayRounds) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-foreground font-headline">Loading Bracket Data for {activeTournament?.name || 'tournament'}...</p>
         <p className="text-sm text-muted-foreground">Fetched {Object.keys(rawMatchDataByRound).length} / {activeTournament?.numberOfRounds} rounds from Firestore so far.</p>
      </div>
    );
  }
  
  if (dynamicDisplayRounds.length === 0 && activeTournament && activeTournament.numberOfRounds > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 min-h-[calc(100vh-200px)]">
        <Info className="h-16 w-16 text-primary" />
        <p className="text-lg text-foreground font-headline">No match data found for "{activeTournament.name}".</p>
        <p className="text-muted-foreground max-w-lg">Ensure matches are populated in Firestore under the rounds for this tournament, or check transformation logic if data exists but isn't appearing.</p>
      </div>
    );
  }
  
  // For 16-team (7 display parts)
  const leftPathRounds = dynamicDisplayRounds.slice(0, 3);      // QF-L, SF-L, F-L
  const championshipRound = dynamicDisplayRounds.slice(3, 4);  // Championship
  const rightPathRounds = dynamicDisplayRounds.slice(4);       // F-R, SF-R, QF-R (will be mirrored)

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-2 text-center font-headline text-primary flex items-center justify-center gap-3">
        <Trophy /> {activeTournament?.name || "Tournament Bracket"} ({activeTournament?.teamCount}-Team Advanced View)
      </h1>
       <p className="text-center text-muted-foreground mb-6 text-sm">
        Displaying series scores (daily wins). Click on a match to see daily breakdown.
      </p>
      
      <div className="overflow-x-auto bg-card p-2 rounded-lg shadow-lg">
        <div className="min-w-[1600px] p-4"> {/* Adjust min-width as needed */}
          <div className="flex justify-center items-start">
            {leftPathRounds.length > 0 && (
              <div className="flex-initial mx-2">
                <Bracket
                  rounds={leftPathRounds}
                  renderSeedComponent={(props: any) => <CustomSeedInternal {...props} onMatchClick={handleMatchupCardClick} />}
                  roundTitleComponent={RoundTitleInternal}
                />
              </div>
            )}

            {championshipRound.length > 0 && (
              // Adjust pt for vertical alignment based on seed height of QF seeds and number of seeds in QF
              // QF has 4 seeds. SF has 2. Final has 1. Champ has 1.
              // Approximate height of a seed card + date is around 6rem. QF height ~ 4 * 6rem.
              // Championship round needs to align with the output of the "Finals" rounds on either side.
              // If Finals has 1 seed, its vertical center is roughly (1 seed * height / 2).
              // If QF has 4 seeds, its vertical spread is larger.
              // Let's try to align the championship round relative to the single "Finals" seed output.
              // A simpler approach might be to roughly center it based on the largest round.
              // For 16-team: QF (4 seeds) -> SF (2 seeds) -> F (1 seed) -> Champ (1 seed)
              // Visual center of F is desired for Champ.
              // Roughly, if a seed is ~6rem tall: QF ~24rem, SF ~12rem, F ~6rem.
              // To center Champ with F: (height of SF - height of F) / 2 + some base.
              // Or, more simply, try pt-[calc(2*6rem+1rem)] to align with center of 2-seed round (SF).
              <div className="flex-initial mx-2 pt-[calc(3*6rem+1.5rem)]"> 
                <Bracket
                  rounds={championshipRound}
                  renderSeedComponent={(props: any) => <CustomSeedInternal {...props} onMatchClick={handleMatchupCardClick} />}
                  roundTitleComponent={RoundTitleInternal}
                />
              </div>
            )}
            
            {rightPathRounds.length > 0 && (
              <div className="flex-initial mx-2">
                <div className="mirror-bracket">
                  <Bracket
                    rounds={rightPathRounds}
                    renderSeedComponent={(props: any) => <CustomSeedInternal {...props} isRightSide={true} onMatchClick={handleMatchupCardClick} />}
                    roundTitleComponent={RoundTitleInternal}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {activeTournament && selectedMatchupForPanel && (
        <MatchDetailPanel
            isOpen={isMatchDetailPanelOpen}
            onOpenChange={setIsMatchDetailPanelOpen}
            matchup={selectedMatchupForPanel}
            tournamentId={activeTournament.id}
        />
      )}
    </div>
  )
}

// --- Internal Components for Rendering ---

function RoundTitleInternal({ title, roundIndex }: { title: ReactNode; roundIndex: number }) {
  return <div className="text-center text-lg font-semibold text-muted-foreground mb-3 mt-2 py-1 px-3 bg-muted/50 rounded-md">{String(title)}</div>;
}

interface CustomSeedInternalProps {
  seed: AdvancedSeedProps;
  breakpoint: string; // This prop comes from react-brackets
  roundIndex: number;
  seedIndex: number;
  isRightSide?: boolean;
  onMatchClick?: (seedId: string) => void;
}

function CustomSeedInternal({ seed, breakpoint, roundIndex, seedIndex, isRightSide = false, onMatchClick }: CustomSeedInternalProps) {
  const team1 = seed.teams[0];
  const team2 = seed.teams[1];

  let winnerName: string | null = null;
  let winnerIndex: 0 | 1 | undefined = undefined;

  // Logic to determine series winner (first to 3 daily wins)
  if (team1?.score !== undefined && team1.score >= 3) {
    winnerIndex = 0;
    winnerName = team1.name;
  } else if (team2?.score !== undefined && team2.score >= 3) {
    winnerIndex = 1;
    winnerName = team2.name;
  }
  
  const seedWrapperStyle = isRightSide ? { transform: "scaleX(-1)" } : {};
  const seedContentStyle = isRightSide ? { transform: "scaleX(-1)" } : {};

  const canOpenDetails = onMatchClick && team1?.name && team1.name.toLowerCase() !== "tbd" && team2?.name && team2.name.toLowerCase() !== "tbd";
  const cardCursorClass = canOpenDetails ? 'cursor-pointer hover:shadow-xl hover:border-primary/50' : 'cursor-default';
  const cardTitle = canOpenDetails ? "Click for daily match details" : "Daily details available when both teams are set";


  return (
    <Seed mobileBreakpoint={breakpoint} style={seedWrapperStyle}>
      <SeedItem className="bg-transparent border-none shadow-none">
        <div 
            className={`flex flex-col items-center ${cardCursorClass}`} 
            style={seedContentStyle}
            onClick={() => canOpenDetails && onMatchClick?.(seed.id)}
            title={cardTitle}
        >
          <Card className="w-[220px] rounded-md overflow-hidden shadow-md border-border">
            <CardContent className="p-0"> {/* Remove CardContent's default padding */}
              <div className="flex flex-col">
                <TeamItemInternal team={team1} isWinner={winnerIndex === 0} />
                <div className="border-t border-border/50"></div>
                <TeamItemInternal team={team2} isWinner={winnerIndex === 1} />
              </div>
              {winnerName && (
                <div className="text-xs font-bold py-1 px-3 text-center bg-primary text-primary-foreground">
                  Series Winner: {winnerName}
                </div>
              )}
              {!winnerName && team1?.name && team1.name.toLowerCase() !== "tbd" && team2?.name && team2.name.toLowerCase() !== "tbd" && (
                  <div className="text-xs py-1 px-3 text-center bg-muted text-muted-foreground">
                      Series Pending
                  </div>
              )}
              {(!team1?.name || team1.name.toLowerCase() === "tbd" || !team2?.name || team2.name.toLowerCase() === "tbd") && !winnerName && (
                  <div className="text-xs py-1 px-3 text-center bg-muted text-muted-foreground">
                      Awaiting Teams
                  </div>
              )}
            </CardContent>
          </Card>
          {seed.date && <div className="text-xs text-muted-foreground mt-1.5 text-center">{seed.date}</div>}
        </div>
      </SeedItem>
    </Seed>
  )
}

function TeamItemInternal({ team, isWinner }: { team: AdvancedTeam | undefined; isWinner?: boolean }) {
  if (!team || !team.name || team.name.toLowerCase() === "tbd") return (
    <div className="py-2 px-3 flex justify-between items-center bg-card text-muted-foreground min-h-[36px]">
        <span className="text-sm italic">TBD</span>
        <span className="text-sm font-mono text-muted-foreground">0</span>
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
      

    
