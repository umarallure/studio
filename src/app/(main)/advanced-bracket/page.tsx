
"use client"

import type { ReactNode } from "react";
import { useState, useEffect, useCallback } from "react";
import { Bracket, Seed, SeedItem, type RoundProps as ReactBracketsRoundProps } from "react-brackets";
import { Card, CardContent } from "@/components/ui/card";
import "@/app/styles/bracket.css"; 

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
  score?: number; // Represents series score (daily wins)
}

interface AdvancedSeedProps {
  id: string; // Match ID from Firestore
  date: string; // Formatted date for display (round start date)
  teams: [AdvancedTeam, AdvancedTeam];
}

interface AdvancedRound extends ReactBracketsRoundProps {
  title: string;
  seeds: AdvancedSeedProps[];
}

// Updated to handle 16-team structure (4 real rounds -> 7 display parts)
const getDisplayRoundTitle = (displayRoundIndex: number, teamCount: number): string => {
  if (teamCount === 16) { // 4 real rounds, results in 7 display parts
    switch (displayRoundIndex) {
      case 0: return "Quarter Finals"; // Left QF (4 matches)
      case 1: return "Semi Finals";  // Left SF (2 matches)
      case 2: return "Finals";       // Left F (1 match, leads to Champ)
      case 3: return "Championship"; // Grand Final (1 match)
      case 4: return "Finals";       // Right F (1 match, leads to Champ) - this is display index 4
      case 5: return "Semi Finals";  // Right SF (2 matches) - display index 5
      case 6: return "Quarter Finals"; // Right QF (4 matches) - display index 6
      default: return `Round ${displayRoundIndex + 1}`;
    }
  } else if (teamCount === 8) { // 3 real rounds, results in 5 display parts (SF-L, F-L, Champ, F-R, SF-R)
     switch (displayRoundIndex) {
      case 0: return "Semi Finals"; // Left SF
      case 1: return "Finals";    // Left F
      case 2: return "Championship";
      case 3: return "Finals";    // Right F
      case 4: return "Semi Finals"; // Right SF
      default: return `Round ${displayRoundIndex + 1}`;
    }
  }
  // Add more cases for other team counts if needed
  return `Display Round ${displayRoundIndex + 1}`;
};


const mapMatchupToAdvancedSeed = (matchup: MatchupType, tournamentStartDate: Date): AdvancedSeedProps => {
  const roundNum = parseInt(matchup.roundId, 10);
  // Match date calculation: Round 1 starts on tournamentStartDate, Round 2 starts 7 days after, etc.
  const matchWeekStartDate = addDays(tournamentStartDate, (roundNum - 1) * 7);

  return {
    id: matchup.id,
    date: formatDate(matchWeekStartDate, "MMM d, yyyy"),
    teams: [
      { name: matchup.team1Name, score: matchup.team1DailyWins },
      { name: matchup.team2Name, score: matchup.team2DailyWins },
    ],
  };
};

// Helper function to get an inferred match, updating TBD names if winners are known
const getInferredMatch = (
  baseMatch: MatchupType | undefined,
  roundId: string, // The round ID for the baseMatch
  matchIndexInRound: number, // 0-based index of the baseMatch within its original Firestore round
  winner1FeederMatch: MatchupType | undefined,
  winner2FeederMatch: MatchupType | undefined
): MatchupType => {
  const defaultMatchId = `placeholder-r${roundId}-m${matchIndexInRound}`;
  if (!baseMatch) {
    return {
      id: defaultMatchId,
      roundId: roundId,
      team1Name: winner1FeederMatch?.seriesWinnerName || "TBD",
      team2Name: winner2FeederMatch?.seriesWinnerName || "TBD",
      team1DailyWins: 0,
      team2DailyWins: 0,
      seriesWinnerName: null,
    };
  }
  const inferred = { ...baseMatch }; // Shallow copy
  const w1Name = winner1FeederMatch?.seriesWinnerName;
  const w2Name = winner2FeederMatch?.seriesWinnerName;

  if ((inferred.team1Name === "TBD" || !inferred.team1Name) && w1Name) {
    inferred.team1Name = w1Name;
  }
  if ((inferred.team2Name === "TBD" || !inferred.team2Name) && w2Name) {
    inferred.team2Name = w2Name;
  }
  return inferred;
};


export default function AdvancedTournamentBracket() {
  const [activeTournament, setActiveTournament] = useState<TournamentSettings | null>(null);
  const [isLoadingTournament, setIsLoadingTournament] = useState(true);
  const [isLoadingBracketData, setIsLoadingBracketData] = useState(false);
  const [criticalError, setCriticalError] = useState<string | null>(null);
  const { toast } = useToast();

  // Stores raw data: { "1": [Matchup, ...], "2": [Matchup, ...] }
  const [rawMatchDataByRound, setRawMatchDataByRound] = useState<{ [roundId: string]: MatchupType[] }>({});
  // Stores transformed data for react-brackets (7 display rounds for 16 teams)
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
          // No non-completed tournaments, fetch the absolute latest one regardless of status
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
        setCriticalError("Failed to load tournament settings. Check console.");
        setActiveTournament(null);
      } finally {
        setIsLoadingTournament(false);
      }
    };
    fetchLatestTournament();
  }, []);

  // Effect 2: Fetch match data when activeTournament changes
  useEffect(() => {
    if (!activeTournament || !activeTournament.id || typeof activeTournament.numberOfRounds !== 'number' || activeTournament.numberOfRounds <= 0) {
      if (!isLoadingTournament && activeTournament && activeTournament.numberOfRounds === 0) {
        // Tournament has 0 rounds, valid state, not an error for data fetching itself.
        setIsLoadingBracketData(false);
        setDynamicDisplayRounds([]); // Set to empty to avoid "no data" message for 0-round tourneys
        setRawMatchDataByRound({});
      } else if (!isLoadingTournament && !activeTournament && !criticalError) {
        // No active tournament and no critical error yet, might be initial state or no tournaments found.
        setIsLoadingBracketData(false);
      }
      return;
    }

    console.log(`[AdvBracket Effect 2] Active tournament: "${activeTournament.name}". Setting up listeners for ${activeTournament.numberOfRounds} rounds.`);
    setIsLoadingBracketData(true);
    setRawMatchDataByRound({}); // Clear previous data
    setDynamicDisplayRounds(null); // Clear display rounds

    const unsubscribes: (() => void)[] = [];
    const allRoundsData: { [key: string]: MatchupType[] } = {};
    let initialLoadsPending = activeTournament.numberOfRounds;

    for (let i = 1; i <= activeTournament.numberOfRounds; i++) {
      const roundIdStr = String(i);
      const matchesCollectionRef = collection(db, "tournaments", activeTournament.id, "rounds", roundIdStr, 'matches');
      const qMatches = query(matchesCollectionRef, orderBy('__name__')); // Order by match ID string 'match1', 'match2'

      const unsubscribeRound = onSnapshot(qMatches, (snapshot) => {
        console.log(`[AdvBracket Effect 2] Data received for T ${activeTournament.id}, R ${roundIdStr}. Docs: ${snapshot.docs.length}`);
        const matchupsForRound: MatchupType[] = snapshot.docs.map(matchDoc => 
          mapFirestoreDocToMatchup(matchDoc.id, roundIdStr, matchDoc.data())
        ).filter((m): m is MatchupType => m !== null);
        
        allRoundsData[roundIdStr] = matchupsForRound;
        
        // Check if all expected rounds have at least attempted to load
        const currentCollectedRoundKeys = Object.keys(allRoundsData);
        let allExpectedRoundsPresent = true;
        for(let r = 1; r <= activeTournament.numberOfRounds; r++){
            if(!currentCollectedRoundKeys.includes(String(r))){
                allExpectedRoundsPresent = false;
                break;
            }
        }

        if (allExpectedRoundsPresent) {
          console.log("[AdvBracket Effect 2] All expected raw round data (or attempts) complete. Updating rawMatchDataByRound with current snapshot:", allRoundsData);
          setRawMatchDataByRound({...allRoundsData}); // Trigger transformation effect
        }

      }, (error) => {
        console.error(`Error fetching matchups for T ${activeTournament.id}, R ${roundIdStr}:`, error);
        toast({ title: `Error Loading Round ${roundIdStr}`, description: "Could not load data for this round.", variant: "destructive" });
         allRoundsData[roundIdStr] = []; // Ensure round key exists even on error to complete "allExpectedRoundsPresent" check
         const currentCollectedRoundKeysOnError = Object.keys(allRoundsData);
         let allExpectedRoundsPresentOnError = true;
         for(let r = 1; r <= activeTournament.numberOfRounds; r++){
            if(!currentCollectedRoundKeysOnError.includes(String(r))){
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

    return () => {
      console.log("[AdvBracket Effect 2] Cleanup: Unsubscribing from Firestore listeners.");
      unsubscribes.forEach(unsub => unsub());
    };
  }, [activeTournament, isLoadingTournament, toast]);


  // Effect 3: Transform raw data into display rounds
  useEffect(() => {
    if (!activeTournament || !activeTournament.startDate || Object.keys(rawMatchDataByRound).length === 0) {
      if (activeTournament && activeTournament.numberOfRounds > 0 && Object.keys(rawMatchDataByRound).length < activeTournament.numberOfRounds) {
        // Still waiting for all raw round data
        setIsLoadingBracketData(true);
      } else if (activeTournament && activeTournament.numberOfRounds === 0) {
         // Handled by Effect 2: sets dynamicDisplayRounds to [] and isLoadingBracketData to false
      }
      return;
    }
    
    // Ensure all raw round data is available before transforming
    let allRawRoundsAvailable = true;
    for (let i = 1; i <= activeTournament.numberOfRounds; i++) {
        if (!rawMatchDataByRound[String(i)]) {
            allRawRoundsAvailable = false;
            break;
        }
    }

    if (!allRawRoundsAvailable) {
        console.log("[AdvBracket Effect 3] Waiting for all raw round data before transformation.");
        setIsLoadingBracketData(true); // Keep loading true if not all rounds fetched
        return;
    }
    
    console.log("[AdvBracket Effect 3] Transforming raw data:", rawMatchDataByRound, "for tournament:", activeTournament.name);
    const newDisplayRounds: AdvancedRound[] = [];
    const { numberOfRounds, teamCount, startDate } = activeTournament;

    // This transformation is specifically for a 16-team (4 real rounds) tournament.
    if (teamCount === 16 && numberOfRounds === 4) {
      const realRound1 = rawMatchDataByRound['1'] || []; // 8 matches
      const realRound2Raw = rawMatchDataByRound['2'] || []; // 4 matches
      const realRound3Raw = rawMatchDataByRound['3'] || []; // 2 matches
      const realRound4Raw = rawMatchDataByRound['4'] || []; // 1 match

      // --- Infer teams for Round 2 ---
      const processedRound2: MatchupType[] = [];
      for (let i = 0; i < 4; i++) { // Iterate 4 times for 4 potential R2 matches
        processedRound2.push(getInferredMatch(realRound2Raw[i], '2', i, realRound1[i * 2], realRound1[i * 2 + 1]));
      }
      
      // --- Infer teams for Round 3 ---
      const processedRound3: MatchupType[] = [];
      for (let i = 0; i < 2; i++) { // Iterate 2 times for 2 potential R3 matches
         processedRound3.push(getInferredMatch(realRound3Raw[i], '3', i, processedRound2[i * 2], processedRound2[i * 2 + 1]));
      }

      // --- Infer teams for Round 4 (Championship) ---
      const processedRound4: MatchupType[] = [];
      processedRound4.push(getInferredMatch(realRound4Raw[0], '4', 0, processedRound3[0], processedRound3[1]));


      const createPlaceholderSeeds = (count: number, roundNumForDate: number): AdvancedSeedProps[] => 
        Array.from({ length: count }, (_, i) => ({
          id: `placeholder-r${roundNumForDate}-m${i}_display_placeholder`, // make ID more specific
          date: formatDate(addDays(startDate, (roundNumForDate - 1) * 7), "MMM d, yyyy"),
          teams: [{ name: "TBD", score: 0 }, { name: "TBD", score: 0 }],
        }));
      
      const expectedMatchesR1 = 8, expectedMatchesR2 = 4, expectedMatchesR3 = 2, expectedMatchesR4 = 1;

      // Display Round 0: Left Quarter Finals (4 matches from realRound1[0-3])
      newDisplayRounds.push({
        title: getDisplayRoundTitle(0, teamCount),
        seeds: realRound1.slice(0, expectedMatchesR1 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate))
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR1 / 2) - realRound1.slice(0, expectedMatchesR1 / 2).length), 1)),
      });
      // Display Round 1: Left Semi Finals (2 matches from processedRound2[0-1])
      newDisplayRounds.push({
        title: getDisplayRoundTitle(1, teamCount),
        seeds: processedRound2.slice(0, expectedMatchesR2 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate))
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR2 / 2) - processedRound2.slice(0, expectedMatchesR2 / 2).length), 2)),
      });
      // Display Round 2: Left Finals (1 match from processedRound3[0])
      newDisplayRounds.push({
        title: getDisplayRoundTitle(2, teamCount),
        seeds: processedRound3.slice(0, expectedMatchesR3 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate))
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR3 / 2) - processedRound3.slice(0, expectedMatchesR3 / 2).length), 3)),
      });
      // Display Round 3: Championship (1 match from processedRound4[0])
      newDisplayRounds.push({
        title: getDisplayRoundTitle(3, teamCount),
        seeds: processedRound4.map(m => mapMatchupToAdvancedSeed(m, startDate)) // Should be only 1 match
               .concat(createPlaceholderSeeds(Math.max(0, expectedMatchesR4 - processedRound4.length), 4)),
      });
      // Display Round 4: Right Finals (1 match from processedRound3[1], reversed for display)
      newDisplayRounds.push({
        title: getDisplayRoundTitle(4, teamCount),
        seeds: processedRound3.slice(expectedMatchesR3 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate)).reverse()
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR3 / 2) - processedRound3.slice(expectedMatchesR3 / 2).length), 3)),
      });
      // Display Round 5: Right Semi Finals (2 matches from processedRound2[2-3], reversed for display)
      newDisplayRounds.push({
        title: getDisplayRoundTitle(5, teamCount),
        seeds: processedRound2.slice(expectedMatchesR2 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate)).reverse()
                .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR2 / 2) - processedRound2.slice(expectedMatchesR2 / 2).length), 2)),
      });
      // Display Round 6: Right Quarter Finals (4 matches from realRound1[4-7], reversed for display)
      newDisplayRounds.push({
        title: getDisplayRoundTitle(6, teamCount),
        seeds: realRound1.slice(expectedMatchesR1 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate)).reverse()
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR1 / 2) - realRound1.slice(expectedMatchesR1 / 2).length), 1)),
      });
    } else {
      // Handle other tournament sizes or if numberOfRounds doesn't match 16-team expectation.
      setCriticalError(`Bracket display logic currently optimized for 16-team/4-round tournaments. This one ("${activeTournament.name}") has ${teamCount} teams / ${numberOfRounds} rounds.`);
      setDynamicDisplayRounds([]); // Set empty to stop loading and show error
      setIsLoadingBracketData(false);
      return;
    }
    setDynamicDisplayRounds(newDisplayRounds);
    setIsLoadingBracketData(false);
  }, [rawMatchDataByRound, activeTournament]);


  const handleMatchupCardClick = useCallback((seedId: string) => {
    console.log("[AdvBracket] Matchup card clicked, seedId:", seedId);
    let foundMatchup: MatchupType | null = null;
    // Search in the raw data, as this is the source of truth for matchup details
    for (const roundKey in rawMatchDataByRound) {
      const match = rawMatchDataByRound[roundKey].find(m => m.id === seedId);
      if (match) {
        foundMatchup = match;
        break;
      }
    }

    if (foundMatchup) {
        // Use the (potentially inferred) names from dynamicDisplayRounds for the check,
        // but pass the raw foundMatchup to the panel.
        let displayMatchupTeamsCheck: { team1Name?: string | null, team2Name?: string | null } = {};
        
        outerLoop:
        for (const round of dynamicDisplayRounds || []) {
            for (const seed of round.seeds) {
                if (seed.id === seedId) {
                    displayMatchupTeamsCheck = { team1Name: seed.teams[0]?.name, team2Name: seed.teams[1]?.name };
                    break outerLoop;
                }
            }
        }

        if (!displayMatchupTeamsCheck.team1Name || displayMatchupTeamsCheck.team1Name.toLowerCase() === "tbd" ||
            !displayMatchupTeamsCheck.team2Name || displayMatchupTeamsCheck.team2Name.toLowerCase() === "tbd") {
            toast({ title: "Matchup Not Ready", description: "Stats available once teams are determined.", variant: "default" });
            return;
        }
      setSelectedMatchupForPanel(foundMatchup); // Pass the original raw data to panel
      setIsMatchDetailPanelOpen(true);
      console.log("[AdvBracket] Opening MatchDetailPanel for matchup:", foundMatchup.id);
    } else {
      toast({ title: "Error", description: `Could not find details for this match (ID: ${seedId}). Raw data might be incomplete.`, variant: "destructive" });
      console.warn("Could not find matchup for ID:", seedId, "in rawMatchDataByRound:", rawMatchDataByRound);
    }
  }, [rawMatchDataByRound, dynamicDisplayRounds, toast]);


  // --- Render Logic ---
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

  if (!activeTournament && !isLoadingTournament) { // No tournament found at all
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <Info className="h-16 w-16 text-primary" />
        <h2 className="text-3xl font-headline text-primary mt-4">No Tournament Active</h2>
        <p className="text-muted-foreground max-w-lg">Please create or select a tournament to view the advanced bracket.</p>
      </div>
    );
  }
  
  // Tournament exists but has 0 rounds
  if (activeTournament && activeTournament.numberOfRounds === 0 && !isLoadingBracketData) {
     return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <Info className="h-16 w-16 text-primary" />
        <h2 className="text-3xl font-headline text-primary mt-4">Tournament Has No Rounds</h2>
        <p className="text-muted-foreground max-w-lg">Tournament "{activeTournament.name}" is configured with 0 rounds. No bracket to display.</p>
      </div>
    );
  }

  // Loading bracket data or dynamicDisplayRounds not yet populated
  if (isLoadingBracketData || !dynamicDisplayRounds) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-foreground font-headline">Loading Bracket Data for {activeTournament?.name || 'tournament'}...</p>
        <p className="text-sm text-muted-foreground">Fetched {Object.keys(rawMatchDataByRound).length} / {activeTournament?.numberOfRounds || 'N/A'} rounds from database.</p>
      </div>
    );
  }
  
  // Data is loaded, but dynamicDisplayRounds is empty (and not a 0-round tournament)
  // This could happen if transformation failed or no matches found for a >0 round tournament.
  if (dynamicDisplayRounds.length === 0 && activeTournament && activeTournament.numberOfRounds > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 min-h-[calc(100vh-200px)]">
        <Info className="h-16 w-16 text-primary" />
        <p className="text-lg text-foreground font-headline">No match data found for "{activeTournament.name}".</p>
        <p className="text-muted-foreground max-w-lg">Ensure matches are populated in Firestore for all rounds or check data transformation logic if this is unexpected.</p>
      </div>
    );
  }
  
  // Slicing for the 7-part display (specific to 16-team)
  const leftPathRounds = dynamicDisplayRounds.slice(0, 3); // QF-L, SF-L, F-L
  const championshipRound = dynamicDisplayRounds.slice(3, 4); // Championship
  const rightPathRounds = dynamicDisplayRounds.slice(4); // F-R, SF-R, QF-R

  return (
    <>
      <h1 className="text-2xl font-bold mb-2 text-center font-headline text-primary flex items-center justify-center gap-3">
        <Trophy /> {activeTournament?.name || "Tournament Bracket"} ({activeTournament?.teamCount || 'N/A'}-Team Advanced View)
      </h1>
       <p className="text-center text-muted-foreground mb-6 text-sm">
        Displaying series scores (daily wins). Click on a match to see daily breakdown.
      </p>
      
      <div className="overflow-x-auto bg-card p-2 rounded-lg shadow-lg">
        <div className="min-w-[2200px] p-4"> {/* Ensure this width accommodates the 7 display rounds */}
          <div className="flex justify-center items-start">
            {/* Left side of the bracket */}
            {leftPathRounds.length > 0 && (
              <div className="flex-initial mx-2">
                <Bracket
                  rounds={leftPathRounds}
                  renderSeedComponent={(props: any) => <CustomSeedInternal {...props} onMatchClick={handleMatchupCardClick} />}
                  roundTitleComponent={RoundTitleInternal}
                />
              </div>
            )}

            {/* Championship */}
            {championshipRound.length > 0 && (
              // Adjust pt (padding-top) to vertically align championship with finals from side paths
              <div className="flex-initial mx-2 pt-[calc(3*6rem+1.5rem)]"> {/* Heuristic padding, adjust as needed */}
                <Bracket
                  rounds={championshipRound}
                  renderSeedComponent={(props: any) => <CustomSeedInternal {...props} onMatchClick={handleMatchupCardClick} />}
                  roundTitleComponent={RoundTitleInternal}
                />
              </div>
            )}
            
            {/* Right side of the bracket (mirrored) */}
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
            matchup={selectedMatchupForPanel} // This is the raw matchup data
            tournamentId={activeTournament.id}
        />
      )}
    </>
  )
}


function RoundTitleInternal({ title, roundIndex }: { title: ReactNode; roundIndex: number }) {
  return <div className="text-center text-lg font-semibold text-muted-foreground mb-3 mt-2 py-1 px-3 bg-muted/50 rounded-md">{String(title)}</div>;
}

interface CustomSeedInternalProps {
  seed: AdvancedSeedProps;
  breakpoint: string; // from react-brackets
  roundIndex: number;
  seedIndex: number;
  isRightSide?: boolean;
  onMatchClick?: (seedId: string) => void;
}

function CustomSeedInternal({ seed, breakpoint, roundIndex, seedIndex, isRightSide = false, onMatchClick }: CustomSeedInternalProps) {
  const team1 = seed.teams[0];
  const team2 = seed.teams[1];

  let seriesWinnerName: string | null = null;
  let winnerIndex: 0 | 1 | undefined = undefined;

  // Determine series winner based on scores (assuming first to 3 daily wins)
  if (team1?.score !== undefined && team1.score >= 3) {
    winnerIndex = 0;
    seriesWinnerName = team1.name;
  } else if (team2?.score !== undefined && team2.score >= 3) {
    winnerIndex = 1;
    seriesWinnerName = team2.name;
  }
  
  const seedWrapperStyle = isRightSide ? { transform: "scaleX(-1)" } : {};
  const seedContentStyle = isRightSide ? { transform: "scaleX(-1)" } : {};

  const canOpenDetails = onMatchClick && team1?.name && team1.name.toLowerCase() !== "tbd" && team2?.name && team2.name.toLowerCase() !== "tbd";
  const cardCursorClass = canOpenDetails ? 'cursor-pointer hover:shadow-xl hover:border-primary/50' : 'cursor-default';
  const cardTitle = canOpenDetails ? "Click for daily match details" : "Details available when teams are set";

  return (
    <Seed mobileBreakpoint={breakpoint} style={seedWrapperStyle}>
      <SeedItem className="bg-transparent border-none shadow-none">
        <div 
            className={`flex flex-col items-center ${cardCursorClass}`} 
            style={seedContentStyle}
            onClick={() => canOpenDetails && onMatchClick?.(seed.id)} // seed.id is the matchupId
            title={cardTitle}
        >
          <Card className="w-[220px] rounded-md overflow-hidden shadow-md border-border"> {/* Use theme border */}
            <CardContent className="p-0">
              <div className="flex flex-col">
                <TeamItemInternal team={team1} isWinner={winnerIndex === 0} />
                <div className="border-t border-border/50"></div> {/* Use theme border */}
                <TeamItemInternal team={team2} isWinner={winnerIndex === 1} />
              </div>
              {seriesWinnerName && (
                <div className="text-xs font-bold py-1 px-3 text-center bg-primary text-primary-foreground">
                  Series Winner: {seriesWinnerName}
                </div>
              )}
              {!seriesWinnerName && team1?.name && team1.name.toLowerCase() !== "tbd" && team2?.name && team2.name.toLowerCase() !== "tbd" && (
                  <div className="text-xs py-1 px-3 text-center bg-muted text-muted-foreground">
                      Series Pending
                  </div>
              )}
              {(!team1?.name || team1.name.toLowerCase() === "tbd" || !team2?.name || team2.name.toLowerCase() === "tbd") && !seriesWinnerName && (
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
    <div className="py-2 px-3 flex justify-between items-center bg-card text-muted-foreground min-h-[36px]"> {/* Use theme card bg */}
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
      
    

    