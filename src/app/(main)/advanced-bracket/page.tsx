"use client"

import type { ReactNode } from "react";
import { useState, useEffect, useCallback } from "react";
import { Bracket, Seed, SeedItem, type RoundProps as ReactBracketsRoundProps } from "react-brackets";
import { Card, CardContent } from "@/components/ui/card";
import "@/app/styles/bracket.css"; 

import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, getDocs, doc, type DocumentData, where } from 'firebase/firestore';
import { mapFirestoreDocToMatchup, mapDocToTournamentSettings } from '@/lib/tournament-config';
import type { Matchup as MatchupType, TournamentSettings } from '@/lib/types';
import SeriesDetailPopup from '@/components/bracket/SeriesDetailPopup';
import { Loader2, AlertTriangle, Info, Trophy } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format as formatDate, addDays, parseISO, isValid as isValidDate } from 'date-fns';

interface AdvancedTeam {
  name: string | null;
  score?: number; 
}

interface AdvancedSeedProps {
  id: string; 
  date: string; 
  teams: [AdvancedTeam, AdvancedTeam];
}

interface AdvancedRound extends ReactBracketsRoundProps {
  title: string;
  seeds: AdvancedSeedProps[];
}

const getRoundTitle = (roundIndex: number, teamCount: number | undefined): string => {
  if (teamCount === 16) {
    switch (roundIndex) {
      case 0: return "ROUND 1\nJUNE 16TH-20TH";
      case 1: return "ROUND 2\nJUNE 23RD-27TH";
      case 2: return "ROUND 3\nJUNE 30TH-JULY 4TH";
      case 3: return "CHAMPIONSHIP\nTOURNAMENT\nJULY 14TH";
      case 4: return "ROUND 3\nJUNE 30TH-JULY 4TH";
      case 5: return "ROUND 2\nJUNE 23RD-27TH";
      case 6: return "ROUND 1\nJUNE 16TH-20TH";
      default: return `Round ${roundIndex + 1}`;
    }
  } else if (teamCount === 8) {
    switch (roundIndex) {
      case 0: return "ROUND 1\nJUNE 16TH-20TH";
      case 1: return "SEMIFINALS\nJULY 7TH-11TH";
      case 2: return "CHAMPIONSHIP\nTOURNAMENT\nJULY 14TH";
      case 3: return "SEMIFINALS\nJULY 7TH-11TH";
      case 4: return "ROUND 1\nJUNE 16TH-20TH";
      default: return `Round ${roundIndex + 1}`;
    }
  }
  return `Round ${roundIndex + 1}`;
};


const mapMatchupToAdvancedSeed = (matchup: MatchupType, tournamentStartDate: Date): AdvancedSeedProps => {
  const roundNum = parseInt(matchup.roundId, 10);
  const matchWeekStartDate = isValidDate(tournamentStartDate) ? addDays(tournamentStartDate, (roundNum - 1) * 7) : new Date();

  return {
    id: `${matchup.roundId}_${matchup.id}`, // Composite ID: "ROUNDID_MATCHID"
    date: formatDate(matchWeekStartDate, "MMM d, yyyy"),
    teams: [
      { name: matchup.team1Name, score: matchup.team1DailyWins },
      { name: matchup.team2Name, score: matchup.team2DailyWins },
    ],
  };
};

const getInferredMatch = (
  baseMatch: MatchupType | undefined,
  roundId: string, 
  matchIndexInRound: number, 
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
  const inferred = { ...baseMatch }; 
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

  const [isSeriesDetailPopupOpen, setIsSeriesDetailPopupOpen] = useState(false);
  const [selectedMatchupForPopup, setSelectedMatchupForPopup] = useState<{ matchupId: string; roundId: string; team1Name: string; team2Name: string } | null>(null);

  const [rawMatchDataByRound, setRawMatchDataByRound] = useState<{ [roundId: string]: MatchupType[] }>({});
  const [dynamicDisplayRounds, setDynamicDisplayRounds] = useState<AdvancedRound[] | null>(null);

  useEffect(() => {
    setIsLoadingTournament(true);
    setCriticalError(null);
    const fetchLatestTournament = async () => {
      try {
        const tournamentsRef = collection(db, "tournaments");
        let q = query(tournamentsRef, where("status", "!=", "Completed"), orderBy("status"), orderBy("createdAt", "desc"), limit(1));
        let querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          q = query(tournamentsRef, orderBy("createdAt", "desc"), limit(1));
          querySnapshot = await getDocs(q);
        }
        
        if (querySnapshot.empty) {
          setCriticalError("No tournaments found. Please create one first.");
          setActiveTournament(null);
        } else {
          const tournamentDoc = querySnapshot.docs[0];
          const settings = mapDocToTournamentSettings(tournamentDoc.data(), tournamentDoc.id);
          if (!settings || !settings.id || typeof settings.numberOfRounds !== 'number' || settings.numberOfRounds < 0 || !isValidDate(settings.startDate)) {
            setCriticalError(`Fetched tournament "${settings?.name || 'Unknown'}" has invalid configuration (ID, numberOfRounds, or startDate missing/invalid).`);
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

  useEffect(() => {
    if (!activeTournament || !activeTournament.id || typeof activeTournament.numberOfRounds !== 'number' || activeTournament.numberOfRounds < 0 || !isValidDate(activeTournament.startDate)) {
      if (!isLoadingTournament && activeTournament && activeTournament.numberOfRounds === 0) {
        setIsLoadingBracketData(false);
        setDynamicDisplayRounds([]); 
        setRawMatchDataByRound({});
      } else if (!isLoadingTournament && !activeTournament && !criticalError) {
        setIsLoadingBracketData(false);
      }
      return;
    }

    console.log(`[AdvBracket Effect 2] Active tournament: "${activeTournament.name}". Setting up listeners for ${activeTournament.numberOfRounds} rounds.`);
    setIsLoadingBracketData(true);
    setRawMatchDataByRound({}); 
    setDynamicDisplayRounds(null); 

    const unsubscribes: (() => void)[] = [];
    const allRoundsData: { [key: string]: MatchupType[] } = {};

    for (let i = 1; i <= activeTournament.numberOfRounds; i++) {
      const roundIdStr = String(i);
      const matchesCollectionRef = collection(db, "tournaments", activeTournament.id, "rounds", roundIdStr, 'matches');
      const qMatches = query(matchesCollectionRef, orderBy('__name__')); 

      const unsubscribeRound = onSnapshot(qMatches, (snapshot) => {
        console.log(`[AdvBracket Effect 2] Data received for T ${activeTournament.id}, R ${roundIdStr}. Docs: ${snapshot.docs.length}`);
        const matchupsForRound: MatchupType[] = snapshot.docs.map(matchDoc => 
          mapFirestoreDocToMatchup(matchDoc.id, roundIdStr, matchDoc.data())
        ).filter((m): m is MatchupType => m !== null);
        
        allRoundsData[roundIdStr] = matchupsForRound;
        
        const currentCollectedRoundKeys = Object.keys(allRoundsData);
        let allExpectedRoundsPresent = true;
        for(let r = 1; r <= (activeTournament?.numberOfRounds || 0); r++){
            if(!currentCollectedRoundKeys.includes(String(r))){
                allExpectedRoundsPresent = false;
                break;
            }
        }

        if (allExpectedRoundsPresent) {
          console.log("[AdvBracket Effect 2] All expected raw round data complete. Updating rawMatchDataByRound.");
          setRawMatchDataByRound({...allRoundsData}); 
        }

      }, (error) => {
        console.error(`Error fetching matchups for T ${activeTournament.id}, R ${roundIdStr}:`, error);
        toast({ title: `Error Loading Round ${roundIdStr}`, description: "Could not load data for this round.", variant: "destructive" });
         allRoundsData[roundIdStr] = []; 
         const currentCollectedRoundKeysOnError = Object.keys(allRoundsData);
         let allExpectedRoundsPresentOnError = true;
         for(let r = 1; r <= (activeTournament?.numberOfRounds || 0); r++){
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


  useEffect(() => {
    if (!activeTournament || !activeTournament.startDate || !isValidDate(activeTournament.startDate) || typeof activeTournament.teamCount !== 'number' || activeTournament.teamCount <= 0) {
      if (activeTournament && activeTournament.numberOfRounds === 0) {
         setIsLoadingBracketData(false);
         setDynamicDisplayRounds([]);
      } else {
        setIsLoadingBracketData(true); 
      }
      return;
    }
    
    let allRawRoundsAvailable = true;
    for (let i = 1; i <= activeTournament.numberOfRounds; i++) {
        if (!rawMatchDataByRound[String(i)]) {
            allRawRoundsAvailable = false;
            break;
        }
    }

    if (!allRawRoundsAvailable) {
        console.log("[AdvBracket Effect 3] Waiting for all raw round data before transformation.");
        setIsLoadingBracketData(true);
        return;
    }
    
    const { numberOfRounds, teamCount, startDate } = activeTournament;
    console.log("[AdvBracket Effect 3] Transforming raw data. Active Tournament:", activeTournament.name, "Team Count:", teamCount, "Start Date:", startDate);

    const newDisplayRounds: AdvancedRound[] = [];

    if (teamCount === 16 && numberOfRounds === 4) {
      const realRound1 = rawMatchDataByRound['1'] || []; 
      const realRound2Raw = rawMatchDataByRound['2'] || []; 
      const realRound3Raw = rawMatchDataByRound['3'] || []; 
      const realRound4Raw = rawMatchDataByRound['4'] || []; 

      const processedRound2: MatchupType[] = [];
      for (let i = 0; i < 4; i++) { 
        processedRound2.push(getInferredMatch(realRound2Raw[i], '2', i, realRound1[i * 2], realRound1[i * 2 + 1]));
      }
      
      const processedRound3: MatchupType[] = [];
      for (let i = 0; i < 2; i++) { 
         processedRound3.push(getInferredMatch(realRound3Raw[i], '3', i, processedRound2[i * 2], processedRound2[i * 2 + 1]));
      }

      const processedRound4: MatchupType[] = [];
      processedRound4.push(getInferredMatch(realRound4Raw[0], '4', 0, processedRound3[0], processedRound3[1]));


      const createPlaceholderSeeds = (count: number, roundNumForDate: number): AdvancedSeedProps[] => 
        Array.from({ length: count }, (_, i) => ({
          id: `placeholder-r${roundNumForDate}-m${i}_display_placeholder`, 
          date: formatDate(addDays(startDate, (roundNumForDate - 1) * 7), "MMM d, yyyy"),
          teams: [{ name: "TBD", score: 0 }, { name: "TBD", score: 0 }],
        }));
      
      const expectedMatchesR1 = 8, expectedMatchesR2 = 4, expectedMatchesR3 = 2, expectedMatchesR4 = 1;

      newDisplayRounds.push({
        title: getRoundTitle(0, teamCount),
        seeds: realRound1.slice(0, expectedMatchesR1 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate))
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR1 / 2) - realRound1.slice(0, expectedMatchesR1 / 2).length), 1)),
      });
      newDisplayRounds.push({
        title: getRoundTitle(1, teamCount),
        seeds: processedRound2.slice(0, expectedMatchesR2 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate))
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR2 / 2) - processedRound2.slice(0, expectedMatchesR2 / 2).length), 2)),
      });
      newDisplayRounds.push({
        title: getRoundTitle(2, teamCount),
        seeds: processedRound3.slice(0, expectedMatchesR3 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate))
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR3 / 2) - processedRound3.slice(0, expectedMatchesR3 / 2).length), 3)),
      });
      newDisplayRounds.push({
        title: getRoundTitle(3, teamCount),
        seeds: processedRound4.map(m => mapMatchupToAdvancedSeed(m, startDate)) 
               .concat(createPlaceholderSeeds(Math.max(0, expectedMatchesR4 - processedRound4.length), 4)),
      });
      newDisplayRounds.push({
        title: getRoundTitle(4, teamCount),
        seeds: processedRound3.slice(expectedMatchesR3 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate)).reverse()
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR3 / 2) - processedRound3.slice(expectedMatchesR3 / 2).length), 3)),
      });
      newDisplayRounds.push({
        title: getRoundTitle(5, teamCount),
        seeds: processedRound2.slice(expectedMatchesR2 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate)).reverse()
                .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR2 / 2) - processedRound2.slice(expectedMatchesR2 / 2).length), 2)),
      });
      newDisplayRounds.push({
        title: getRoundTitle(6, teamCount),
        seeds: realRound1.slice(expectedMatchesR1 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate)).reverse()
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR1 / 2) - realRound1.slice(expectedMatchesR1 / 2).length), 1)),
      });
    } else if (teamCount === 8 && numberOfRounds === 3) {
      const realRound1 = rawMatchDataByRound['1'] || []; 
      const realRound2Raw = rawMatchDataByRound['2'] || []; 
      const realRound3Raw = rawMatchDataByRound['3'] || []; 

      const processedRound2: MatchupType[] = [];
      for (let i = 0; i < 2; i++) { 
        processedRound2.push(getInferredMatch(realRound2Raw[i], '2', i, realRound1[i * 2], realRound1[i * 2 + 1]));
      }

      const processedRound3: MatchupType[] = []; 
      processedRound3.push(getInferredMatch(realRound3Raw[0], '3', 0, processedRound2[0], processedRound2[1]));

      const createPlaceholderSeeds = (count: number, roundNumForDate: number): AdvancedSeedProps[] => 
        Array.from({ length: count }, (_, i) => ({
          id: `placeholder-r${roundNumForDate}-m${i}_display_placeholder_8team`,
          date: formatDate(addDays(startDate, (roundNumForDate - 1) * 7), "MMM d, yyyy"),
          teams: [{ name: "TBD", score: 0 }, { name: "TBD", score: 0 }],
        }));

      const expectedMatchesR1 = 4, expectedMatchesR2 = 2, expectedMatchesR3 = 1;

      newDisplayRounds.push({
        title: getRoundTitle(0, teamCount),
        seeds: realRound1.slice(0, expectedMatchesR1 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate))
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR1 / 2) - realRound1.slice(0, expectedMatchesR1 / 2).length), 1)),
      });
      newDisplayRounds.push({
        title: getRoundTitle(1, teamCount),
        seeds: processedRound2.slice(0, expectedMatchesR2 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate))
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR2 / 2) - processedRound2.slice(0, expectedMatchesR2 / 2).length), 2)),
      });
      newDisplayRounds.push({
        title: getRoundTitle(2, teamCount),
        seeds: processedRound3.map(m => mapMatchupToAdvancedSeed(m, startDate))
               .concat(createPlaceholderSeeds(Math.max(0, expectedMatchesR3 - processedRound3.length), 3)),
      });
      newDisplayRounds.push({
        title: getRoundTitle(3, teamCount),
        seeds: processedRound2.slice(expectedMatchesR2 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate)).reverse()
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR2 / 2) - processedRound2.slice(expectedMatchesR2 / 2).length), 2)),
      });
      newDisplayRounds.push({
        title: getRoundTitle(4, teamCount),
        seeds: realRound1.slice(expectedMatchesR1 / 2).map(m => mapMatchupToAdvancedSeed(m, startDate)).reverse()
               .concat(createPlaceholderSeeds(Math.max(0, (expectedMatchesR1 / 2) - realRound1.slice(expectedMatchesR1 / 2).length), 1)),
      });
    } else {
      setCriticalError(`Bracket display logic configured for 16 or 8-team tournaments. This one ("${activeTournament.name}") has ${teamCount} teams / ${numberOfRounds} rounds.`);
      setDynamicDisplayRounds([]); 
      setIsLoadingBracketData(false);
      return;
    }
    setDynamicDisplayRounds(newDisplayRounds);
    setIsLoadingBracketData(false);
  }, [rawMatchDataByRound, activeTournament]);


  const handleMatchupCardClick = useCallback((compositeId: string) => {
    console.log("[AdvBracket] Matchup card clicked, compositeId:", compositeId);

    const parts = compositeId.split('_'); 
    if (parts.length !== 2) {
        if (compositeId.startsWith("placeholder-")) {
            toast({ title: "Matchup Not Finalized", description: "This is a placeholder for a future match.", variant: "default" });
        } else {
            toast({ title: "Invalid Match Identifier", description: "Could not identify the clicked match.", variant: "destructive" });
        }
        return;
    }

    const targetRoundId = parts[0];
    const targetMatchId = parts[1];
    
    const roundData = rawMatchDataByRound[targetRoundId];
    if (!roundData) {
        toast({ title: "Round Data Not Found", description: `Could not find data for round ${targetRoundId}.`, variant: "destructive" });
        return;
    }

    const foundMatchup = roundData.find(m => m.id === targetMatchId);

    if (!foundMatchup || (foundMatchup.team1Name || "").toLowerCase() === "tbd" || (foundMatchup.team2Name || "").toLowerCase() === "tbd") {
        toast({ title: "Matchup Not Ready", description: "Stats available once teams are determined or if the match is fully initialized.", variant: "default" });
        return;
    }

    const team1Name = foundMatchup.team1Name || "TBD";
    const team2Name = foundMatchup.team2Name || "TBD";
    
    setSelectedMatchupForPopup({ 
        matchupId: foundMatchup.id, 
        roundId: targetRoundId,    
        team1Name, 
        team2Name 
    });
    setIsSeriesDetailPopupOpen(true);
    console.log("[AdvBracket] Opening SeriesDetailPopup for matchup:", foundMatchup.id, "in round:", targetRoundId, "Teams:", team1Name, "vs", team2Name);

  }, [rawMatchDataByRound, toast]);


  if (isLoadingTournament) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-foreground font-headline">Loading Tournament Info...</p>
      </div>
    );
  }

  if (!activeTournament && !isLoadingTournament) { 
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <Info className="h-16 w-16 text-primary" />
        <h2 className="text-3xl font-headline text-primary mt-4">No Tournament Active</h2>
        <p className="text-muted-foreground max-w-lg">Please create or select a tournament to view the advanced bracket.</p>
      </div>
    );
  }
  
  if (activeTournament && activeTournament.numberOfRounds === 0 && !isLoadingBracketData) {
     return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <Info className="h-16 w-16 text-primary" />
        <h2 className="text-3xl font-headline text-primary mt-4">Tournament Has No Rounds</h2>
        <p className="text-muted-foreground max-w-lg">Tournament "{activeTournament.name}" is configured with 0 rounds. No bracket to display.</p>
      </div>
    );
  }

  if (criticalError) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center min-h-[calc(100vh-200px)]">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h2 className="text-3xl font-headline text-destructive mt-4">Bracket Error</h2>
        <p className="text-muted-foreground max-w-lg">{criticalError}</p>
      </div>
    );
  }
  
  if (isLoadingBracketData || !dynamicDisplayRounds) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-foreground font-headline">Loading Bracket Data for {activeTournament?.name || 'tournament'}...</p>
        <p className="text-sm text-muted-foreground">Fetched {Object.keys(rawMatchDataByRound).length} / {activeTournament?.numberOfRounds || 'N/A'} rounds from database.</p>
      </div>
    );
  }
  
  if (dynamicDisplayRounds.length === 0 && activeTournament && activeTournament.numberOfRounds > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4 min-h-[calc(100vh-200px)]">
        <Info className="h-16 w-16 text-primary" />
        <p className="text-lg text-foreground font-headline">No match data found for "{activeTournament.name}".</p>
        <p className="text-muted-foreground max-w-lg">Ensure matches are populated in Firestore for all rounds or check data transformation logic if this is unexpected.</p>
      </div>
    );
  }
  
  let leftPathRounds: AdvancedRound[] = [];
  let championshipRound: AdvancedRound[] = [];
  let rightPathRounds: AdvancedRound[] = [];

  if (activeTournament.teamCount === 16) {
    leftPathRounds = dynamicDisplayRounds.slice(0, 3); 
    championshipRound = dynamicDisplayRounds.slice(3, 4); 
    rightPathRounds = dynamicDisplayRounds.slice(4); 
  } else if (activeTournament.teamCount === 8) {
    leftPathRounds = dynamicDisplayRounds.slice(0, 2);
    championshipRound = dynamicDisplayRounds.slice(2, 3);
    rightPathRounds = dynamicDisplayRounds.slice(3);
  }

  let championshipPaddingTop = "pt-[calc(3*6rem+1.5rem)]"; 
  if (activeTournament.teamCount === 8) { 
    championshipPaddingTop = "pt-[calc(1*6rem+1.5rem)]"; 
  }


  return (
    <>
      <h1 className="text-2xl font-bold mb-2 text-center font-headline text-primary flex items-center justify-center gap-3">
        <Trophy /> {activeTournament?.name || "Tournament Bracket"} ({activeTournament?.teamCount || 'N/A'}-Team Advanced View)
      </h1>
       <p className="text-center text-muted-foreground mb-6 text-sm">
        Displaying series scores (daily wins). Click on a match to see daily breakdown.
      </p>
      
      <div className="overflow-x-auto bg-card p-2 rounded-lg shadow-lg">
        <div className="min-w-[2200px] p-4"> 
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
              <div className={`flex-initial mx-2 ${championshipPaddingTop}`}>
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

      {selectedMatchupForPopup && activeTournament && activeTournament.startDate && (
        <SeriesDetailPopup
            isOpen={isSeriesDetailPopupOpen}
            onOpenChange={setIsSeriesDetailPopupOpen}
            matchupId={selectedMatchupForPopup.matchupId}
            roundId={selectedMatchupForPopup.roundId}
            team1Name={selectedMatchupForPopup.team1Name}
            team2Name={selectedMatchupForPopup.team2Name}
            tournamentId={activeTournament.id}
            tournamentStartDate={activeTournament.startDate}
        />
      )}
    </>
  )
}


function RoundTitleInternal({ title }: { title: ReactNode }) {
  const lines = String(title || '').split('\n').filter(Boolean);
  return (
    <div className="text-center font-semibold text-primary mb-3 mt-2 py-2 px-4 bg-muted/50 rounded-md">
      {lines.length > 0 ? (
        <>
          <div className="text-lg font-bold">{lines[0]}</div>
          {lines.slice(1).map((line, i) => (
            <div key={i} className="text-sm mt-1 text-muted-foreground">
              {line}
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}

interface CustomSeedInternalProps {
  seed: AdvancedSeedProps;
  breakpoint: string; 
  roundIndex: number;
  seedIndex: number;
  isRightSide?: boolean;
  onMatchClick?: (compositeId: string) => void;
}

function CustomSeedInternal({ seed, breakpoint, roundIndex, seedIndex, isRightSide = false, onMatchClick }: CustomSeedInternalProps) {
  const team1 = seed.teams[0];
  const team2 = seed.teams[1];

  let seriesWinnerName: string | null = null;
  let winnerIndex: 0 | 1 | undefined = undefined;

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
            onClick={() => canOpenDetails && onMatchClick?.(seed.id)} // Pass composite ID (seed.id)
            title={cardTitle}
        >
          <Card className="w-[220px] rounded-md overflow-hidden shadow-md border-border"> 
            <CardContent className="p-0">
              <div className="flex flex-col">
                <TeamItemInternal team={team1} isWinner={winnerIndex === 0} />
                <div className="border-t border-border/50"></div> 
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
