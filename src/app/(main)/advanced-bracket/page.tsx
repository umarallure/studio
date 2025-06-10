"use client"

import type { ReactNode } from "react"
import { useState, useEffect, useCallback } from "react"
import { Bracket, Seed, SeedItem, type RoundProps as ReactBracketsRoundProps } from "react-brackets"
import { Badge } from "@/components/ui/badge"
import "@/app/styles/bracket.css"

import { db } from "@/lib/firebase"
import { collection, onSnapshot, query, orderBy, limit, getDocs, where } from "firebase/firestore"
import { mapFirestoreDocToMatchup, mapDocToTournamentSettings } from "@/lib/tournament-config"
import type { Matchup as MatchupType, TournamentSettings } from "@/lib/types"
import SeriesDetailPopup from "@/components/bracket/SeriesDetailPopup"
import { Loader2, AlertTriangle, Info, Trophy, Calendar, Users, Target, Crown, Star } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format as formatDate, addDays, isValid as isValidDate } from "date-fns"

interface AdvancedTeam {
  name: string | null
  score?: number
}

interface AdvancedSeedProps {
  id: string
  date: string
  teams: [AdvancedTeam, AdvancedTeam]
}

interface AdvancedRound extends ReactBracketsRoundProps {
  title: string
  seeds: AdvancedSeedProps[]
}

const getRoundTitle = (roundIndex: number, teamCount: number | undefined): string => {
  if (teamCount === 16) {
    switch (roundIndex) {
      case 0:
        return "ROUND 1\nJUNE 16TH-20TH"
      case 1:
        return "ROUND 2\nJUNE 23RD-27TH"
      case 2:
        return "ROUND 3\nJUNE 30TH-JULY 4TH"
      case 3:
        return "CHAMPIONSHIP\nTOURNAMENT\nJULY 14TH"
      case 4:
        return "ROUND 3\nJUNE 30TH-JULY 4TH"
      case 5:
        return "ROUND 2\nJUNE 23RD-27TH"
      case 6:
        return "ROUND 1\nJUNE 16TH-20TH"
      default:
        return `Round ${roundIndex + 1}`
    }
  } else if (teamCount === 8) {
    switch (roundIndex) {
      case 0:
        return "ROUND 1\nJUNE 16TH-20TH"
      case 1:
        return "SEMIFINALS\nJULY 7TH-11TH"
      case 2:
        return "CHAMPIONSHIP\nTOURNAMENT\nJULY 14TH"
      case 3:
        return "SEMIFINALS\nJULY 7TH-11TH"
      case 4:
        return "ROUND 1\nJUNE 16TH-20TH"
      default:
        return `Round ${roundIndex + 1}`
    }
  }
  return `Round ${roundIndex + 1}`
}

const mapMatchupToAdvancedSeed = (matchup: MatchupType, tournamentStartDate: Date): AdvancedSeedProps => {
  const roundNum = Number.parseInt(matchup.roundId, 10)
  const matchWeekStartDate = isValidDate(tournamentStartDate)
    ? addDays(tournamentStartDate, (roundNum - 1) * 7)
    : new Date()

  return {
    id: `${matchup.roundId}_${matchup.id}`,
    date: formatDate(matchWeekStartDate, "MMM d, yyyy"),
    teams: [
      { name: matchup.team1Name, score: matchup.team1DailyWins },
      { name: matchup.team2Name, score: matchup.team2DailyWins },
    ],
  }
}

const getInferredMatch = (
  baseMatch: MatchupType | undefined,
  roundId: string,
  matchIndexInRound: number,
  winner1FeederMatch: MatchupType | undefined,
  winner2FeederMatch: MatchupType | undefined,
): MatchupType => {
  const defaultMatchId = `placeholder-r${roundId}-m${matchIndexInRound}`
  if (!baseMatch) {
    return {
      id: defaultMatchId,
      roundId: roundId,
      team1Name: winner1FeederMatch?.seriesWinnerName || "TBD",
      team2Name: winner2FeederMatch?.seriesWinnerName || "TBD",
      team1DailyWins: 0,
      team2DailyWins: 0,
      seriesWinnerName: null,
    }
  }
  const inferred = { ...baseMatch }
  const w1Name = winner1FeederMatch?.seriesWinnerName
  const w2Name = winner2FeederMatch?.seriesWinnerName

  if ((inferred.team1Name === "TBD" || !inferred.team1Name) && w1Name) {
    inferred.team1Name = w1Name
  }
  if ((inferred.team2Name === "TBD" || !inferred.team2Name) && w2Name) {
    inferred.team2Name = w2Name
  }
  return inferred
}

export default function AdvancedTournamentBracket() {
  const [activeTournament, setActiveTournament] = useState<TournamentSettings | null>(null)
  const [isLoadingTournament, setIsLoadingTournament] = useState(true)
  const [isLoadingBracketData, setIsLoadingBracketData] = useState(false)
  const [criticalError, setCriticalError] = useState<string | null>(null)
  const { toast } = useToast()

  const [isSeriesDetailPopupOpen, setIsSeriesDetailPopupOpen] = useState(false)
  const [selectedMatchupForPopup, setSelectedMatchupForPopup] = useState<{
    matchupId: string
    roundId: string
    team1Name: string
    team2Name: string
  } | null>(null)

  const [rawMatchDataByRound, setRawMatchDataByRound] = useState<{ [roundId: string]: MatchupType[] }>({})
  const [dynamicDisplayRounds, setDynamicDisplayRounds] = useState<AdvancedRound[] | null>(null)

  // ... (keeping all the existing useEffect hooks and logic the same)
  useEffect(() => {
    setIsLoadingTournament(true)
    setCriticalError(null)
    const fetchLatestTournament = async () => {
      try {
        const tournamentsRef = collection(db, "tournaments")
        let q = query(
          tournamentsRef,
          where("status", "!=", "Completed"),
          orderBy("status"),
          orderBy("createdAt", "desc"),
          limit(1),
        )
        let querySnapshot = await getDocs(q)

        if (querySnapshot.empty) {
          q = query(tournamentsRef, orderBy("createdAt", "desc"), limit(1))
          querySnapshot = await getDocs(q)
        }

        if (querySnapshot.empty) {
          setCriticalError("No tournaments found. Please create one first.")
          setActiveTournament(null)
        } else {
          const tournamentDoc = querySnapshot.docs[0]
          const settings = mapDocToTournamentSettings(tournamentDoc.data(), tournamentDoc.id)
          if (
            !settings ||
            !settings.id ||
            typeof settings.numberOfRounds !== "number" ||
            settings.numberOfRounds < 0 ||
            !isValidDate(settings.startDate)
          ) {
            setCriticalError(
              `Fetched tournament "${settings?.name || "Unknown"}" has invalid configuration (ID, numberOfRounds, or startDate missing/invalid).`,
            )
            setActiveTournament(null)
          } else {
            setActiveTournament(settings)
          }
        }
      } catch (error) {
        console.error("Error fetching latest tournament:", error)
        setCriticalError("Failed to load tournament settings. Check console.")
        setActiveTournament(null)
      } finally {
        setIsLoadingTournament(false)
      }
    }
    fetchLatestTournament()
  }, [])

  useEffect(() => {
    if (
      !activeTournament ||
      !activeTournament.id ||
      typeof activeTournament.numberOfRounds !== "number" ||
      activeTournament.numberOfRounds < 0 ||
      !isValidDate(activeTournament.startDate)
    ) {
      if (!isLoadingTournament && activeTournament && activeTournament.numberOfRounds === 0) {
        setIsLoadingBracketData(false)
        setDynamicDisplayRounds([])
        setRawMatchDataByRound({})
      } else if (!isLoadingTournament && !activeTournament && !criticalError) {
        setIsLoadingBracketData(false)
      }
      return
    }

    console.log(
      `[AdvBracket Effect 2] Active tournament: "${activeTournament.name}". Setting up listeners for ${activeTournament.numberOfRounds} rounds.`,
    )
    setIsLoadingBracketData(true)
    setRawMatchDataByRound({})
    setDynamicDisplayRounds(null)

    const unsubscribes: (() => void)[] = []
    const allRoundsData: { [key: string]: MatchupType[] } = {}

    for (let i = 1; i <= activeTournament.numberOfRounds; i++) {
      const roundIdStr = String(i)
      const matchesCollectionRef = collection(db, "tournaments", activeTournament.id, "rounds", roundIdStr, "matches")
      const qMatches = query(matchesCollectionRef, orderBy("__name__"))

      const unsubscribeRound = onSnapshot(
        qMatches,
        (snapshot) => {
          console.log(
            `[AdvBracket Effect 2] Data received for T ${activeTournament.id}, R ${roundIdStr}. Docs: ${snapshot.docs.length}`,
          )
          const matchupsForRound: MatchupType[] = snapshot.docs
            .map((matchDoc) => mapFirestoreDocToMatchup(matchDoc.id, roundIdStr, matchDoc.data()))
            .filter((m): m is MatchupType => m !== null)

          allRoundsData[roundIdStr] = matchupsForRound

          const currentCollectedRoundKeys = Object.keys(allRoundsData)
          let allExpectedRoundsPresent = true
          for (let r = 1; r <= (activeTournament?.numberOfRounds || 0); r++) {
            if (!currentCollectedRoundKeys.includes(String(r))) {
              allExpectedRoundsPresent = false
              break
            }
          }

          if (allExpectedRoundsPresent) {
            console.log("[AdvBracket Effect 2] All expected raw round data complete. Updating rawMatchDataByRound.")
            setRawMatchDataByRound({ ...allRoundsData })
          }
        },
        (error) => {
          console.error(`Error fetching matchups for T ${activeTournament.id}, R ${roundIdStr}:`, error)
          toast({
            title: `Error Loading Round ${roundIdStr}`,
            description: "Could not load data for this round.",
            variant: "destructive",
          })
          allRoundsData[roundIdStr] = []
          const currentCollectedRoundKeysOnError = Object.keys(allRoundsData)
          let allExpectedRoundsPresentOnError = true
          for (let r = 1; r <= (activeTournament?.numberOfRounds || 0); r++) {
            if (!currentCollectedRoundKeysOnError.includes(String(r))) {
              allExpectedRoundsPresentOnError = false
              break
            }
          }
          if (allExpectedRoundsPresentOnError) {
            setRawMatchDataByRound({ ...allRoundsData })
          }
        },
      )
      unsubscribes.push(unsubscribeRound)
    }

    return () => {
      console.log("[AdvBracket Effect 2] Cleanup: Unsubscribing from Firestore listeners.")
      unsubscribes.forEach((unsub) => unsub())
    }
  }, [activeTournament, isLoadingTournament, toast])

  useEffect(() => {
    if (
      !activeTournament ||
      !activeTournament.startDate ||
      !isValidDate(activeTournament.startDate) ||
      typeof activeTournament.teamCount !== "number" ||
      activeTournament.teamCount <= 0
    ) {
      if (activeTournament && activeTournament.numberOfRounds === 0) {
        setIsLoadingBracketData(false)
        setDynamicDisplayRounds([])
      } else {
        setIsLoadingBracketData(true)
      }
      return
    }

    let allRawRoundsAvailable = true
    for (let i = 1; i <= activeTournament.numberOfRounds; i++) {
      if (!rawMatchDataByRound[String(i)]) {
        allRawRoundsAvailable = false
        break
      }
    }

    if (!allRawRoundsAvailable) {
      console.log("[AdvBracket Effect 3] Waiting for all raw round data before transformation.")
      setIsLoadingBracketData(true)
      return
    }

    const { numberOfRounds, teamCount, startDate } = activeTournament
    console.log(
      "[AdvBracket Effect 3] Transforming raw data. Active Tournament:",
      activeTournament.name,
      "Team Count:",
      teamCount,
      "Start Date:",
      startDate,
    )

    const newDisplayRounds: AdvancedRound[] = []

    if (teamCount === 16 && numberOfRounds === 4) {
      const realRound1 = rawMatchDataByRound["1"] || []
      const realRound2Raw = rawMatchDataByRound["2"] || []
      const realRound3Raw = rawMatchDataByRound["3"] || []
      const realRound4Raw = rawMatchDataByRound["4"] || []

      const processedRound2: MatchupType[] = []
      for (let i = 0; i < 4; i++) {
        processedRound2.push(getInferredMatch(realRound2Raw[i], "2", i, realRound1[i * 2], realRound1[i * 2 + 1]))
      }

      const processedRound3: MatchupType[] = []
      for (let i = 0; i < 2; i++) {
        processedRound3.push(
          getInferredMatch(realRound3Raw[i], "3", i, processedRound2[i * 2], processedRound2[i * 2 + 1]),
        )
      }

      const processedRound4: MatchupType[] = []
      processedRound4.push(getInferredMatch(realRound4Raw[0], "4", 0, processedRound3[0], processedRound3[1]))

      const createPlaceholderSeeds = (count: number, roundNumForDate: number): AdvancedSeedProps[] =>
        Array.from({ length: count }, (_, i) => ({
          id: `placeholder-r${roundNumForDate}-m${i}_display_placeholder`,
          date: formatDate(addDays(startDate, (roundNumForDate - 1) * 7), "MMM d, yyyy"),
          teams: [
            { name: "TBD", score: 0 },
            { name: "TBD", score: 0 },
          ],
        }))

      const expectedMatchesR1 = 8,
        expectedMatchesR2 = 4,
        expectedMatchesR3 = 2,
        expectedMatchesR4 = 1

      newDisplayRounds.push({
        title: getRoundTitle(0, teamCount),
        seeds: realRound1
          .slice(0, expectedMatchesR1 / 2)
          .map((m) => mapMatchupToAdvancedSeed(m, startDate))
          .concat(
            createPlaceholderSeeds(
              Math.max(0, expectedMatchesR1 / 2 - realRound1.slice(0, expectedMatchesR1 / 2).length),
              1,
            ),
          ),
      })
      newDisplayRounds.push({
        title: getRoundTitle(1, teamCount),
        seeds: processedRound2
          .slice(0, expectedMatchesR2 / 2)
          .map((m) => mapMatchupToAdvancedSeed(m, startDate))
          .concat(
            createPlaceholderSeeds(
              Math.max(0, expectedMatchesR2 / 2 - processedRound2.slice(0, expectedMatchesR2 / 2).length),
              2,
            ),
          ),
      })
      newDisplayRounds.push({
        title: getRoundTitle(2, teamCount),
        seeds: processedRound3
          .slice(0, expectedMatchesR3 / 2)
          .map((m) => mapMatchupToAdvancedSeed(m, startDate))
          .concat(
            createPlaceholderSeeds(
              Math.max(0, expectedMatchesR3 / 2 - processedRound3.slice(0, expectedMatchesR3 / 2).length),
              3,
            ),
          ),
      })
      newDisplayRounds.push({
        title: getRoundTitle(3, teamCount),
        seeds: processedRound4
          .map((m) => mapMatchupToAdvancedSeed(m, startDate))
          .concat(createPlaceholderSeeds(Math.max(0, expectedMatchesR4 - processedRound4.length), 4)),
      })
      newDisplayRounds.push({
        title: getRoundTitle(4, teamCount),
        seeds: processedRound3
          .slice(expectedMatchesR3 / 2)
          .map((m) => mapMatchupToAdvancedSeed(m, startDate))
          .reverse()
          .concat(
            createPlaceholderSeeds(
              Math.max(0, expectedMatchesR3 / 2 - processedRound3.slice(expectedMatchesR3 / 2).length),
              3,
            ),
          ),
      })
      newDisplayRounds.push({
        title: getRoundTitle(5, teamCount),
        seeds: processedRound2
          .slice(expectedMatchesR2 / 2)
          .map((m) => mapMatchupToAdvancedSeed(m, startDate))
          .reverse()
          .concat(
            createPlaceholderSeeds(
              Math.max(0, expectedMatchesR2 / 2 - processedRound2.slice(expectedMatchesR2 / 2).length),
              2,
            ),
          ),
      })
      newDisplayRounds.push({
        title: getRoundTitle(6, teamCount),
        seeds: realRound1
          .slice(expectedMatchesR1 / 2)
          .map((m) => mapMatchupToAdvancedSeed(m, startDate))
          .reverse()
          .concat(
            createPlaceholderSeeds(
              Math.max(0, expectedMatchesR1 / 2 - realRound1.slice(expectedMatchesR1 / 2).length),
              1,
            ),
          ),
      })
    } else if (teamCount === 8 && numberOfRounds === 3) {
      const realRound1 = rawMatchDataByRound["1"] || []
      const realRound2Raw = rawMatchDataByRound["2"] || []
      const realRound3Raw = rawMatchDataByRound["3"] || []

      const processedRound2: MatchupType[] = []
      for (let i = 0; i < 2; i++) {
        processedRound2.push(getInferredMatch(realRound2Raw[i], "2", i, realRound1[i * 2], realRound1[i * 2 + 1]))
      }

      const processedRound3: MatchupType[] = []
      processedRound3.push(getInferredMatch(realRound3Raw[0], "3", 0, processedRound2[0], processedRound2[1]))

      const createPlaceholderSeeds = (count: number, roundNumForDate: number): AdvancedSeedProps[] =>
        Array.from({ length: count }, (_, i) => ({
          id: `placeholder-r${roundNumForDate}-m${i}_display_placeholder_8team`,
          date: formatDate(addDays(startDate, (roundNumForDate - 1) * 7), "MMM d, yyyy"),
          teams: [
            { name: "TBD", score: 0 },
            { name: "TBD", score: 0 },
          ],
        }))

      const expectedMatchesR1 = 4,
        expectedMatchesR2 = 2,
        expectedMatchesR3 = 1

      newDisplayRounds.push({
        title: getRoundTitle(0, teamCount),
        seeds: realRound1
          .slice(0, expectedMatchesR1 / 2)
          .map((m) => mapMatchupToAdvancedSeed(m, startDate))
          .concat(
            createPlaceholderSeeds(
              Math.max(0, expectedMatchesR1 / 2 - realRound1.slice(0, expectedMatchesR1 / 2).length),
              1,
            ),
          ),
      })
      newDisplayRounds.push({
        title: getRoundTitle(1, teamCount),
        seeds: processedRound2
          .slice(0, expectedMatchesR2 / 2)
          .map((m) => mapMatchupToAdvancedSeed(m, startDate))
          .concat(
            createPlaceholderSeeds(
              Math.max(0, expectedMatchesR2 / 2 - processedRound2.slice(0, expectedMatchesR2 / 2).length),
              2,
            ),
          ),
      })
      newDisplayRounds.push({
        title: getRoundTitle(2, teamCount),
        seeds: processedRound3
          .map((m) => mapMatchupToAdvancedSeed(m, startDate))
          .concat(createPlaceholderSeeds(Math.max(0, expectedMatchesR3 - processedRound3.length), 3)),
      })
      newDisplayRounds.push({
        title: getRoundTitle(3, teamCount),
        seeds: processedRound2
          .slice(expectedMatchesR2 / 2)
          .map((m) => mapMatchupToAdvancedSeed(m, startDate))
          .reverse()
          .concat(
            createPlaceholderSeeds(
              Math.max(0, expectedMatchesR2 / 2 - processedRound2.slice(expectedMatchesR2 / 2).length),
              2,
            ),
          ),
      })
      newDisplayRounds.push({
        title: getRoundTitle(4, teamCount),
        seeds: realRound1
          .slice(expectedMatchesR1 / 2)
          .map((m) => mapMatchupToAdvancedSeed(m, startDate))
          .reverse()
          .concat(
            createPlaceholderSeeds(
              Math.max(0, expectedMatchesR1 / 2 - realRound1.slice(expectedMatchesR1 / 2).length),
              1,
            ),
          ),
      })
    } else {
      setCriticalError(
        `Bracket display logic configured for 16 or 8-team tournaments. This one ("${activeTournament.name}") has ${teamCount} teams / ${numberOfRounds} rounds.`,
      )
      setDynamicDisplayRounds([])
      setIsLoadingBracketData(false)
      return
    }
    setDynamicDisplayRounds(newDisplayRounds)
    setIsLoadingBracketData(false)
  }, [rawMatchDataByRound, activeTournament])

  const handleMatchupCardClick = useCallback(
    (compositeId: string) => {
      console.log("[AdvBracket] Matchup card clicked, compositeId:", compositeId)

      const parts = compositeId.split("_")
      if (parts.length !== 2) {
        if (compositeId.startsWith("placeholder-")) {
          toast({
            title: "Matchup Not Finalized",
            description: "This is a placeholder for a future match.",
            variant: "default",
          })
        } else {
          toast({
            title: "Invalid Match Identifier",
            description: "Could not identify the clicked match.",
            variant: "destructive",
          })
        }
        return
      }

      const targetRoundId = parts[0]
      const targetMatchId = parts[1]

      const roundData = rawMatchDataByRound[targetRoundId]
      if (!roundData) {
        toast({
          title: "Round Data Not Found",
          description: `Could not find data for round ${targetRoundId}.`,
          variant: "destructive",
        })
        return
      }

      const foundMatchup = roundData.find((m) => m.id === targetMatchId)

      if (
        !foundMatchup ||
        (foundMatchup.team1Name || "").toLowerCase() === "tbd" ||
        (foundMatchup.team2Name || "").toLowerCase() === "tbd"
      ) {
        toast({
          title: "Matchup Not Ready",
          description: "Stats available once teams are determined or if the match is fully initialized.",
          variant: "default",
        })
        return
      }

      const team1Name = foundMatchup.team1Name || "TBD"
      const team2Name = foundMatchup.team2Name || "TBD"

      setSelectedMatchupForPopup({
        matchupId: foundMatchup.id,
        roundId: targetRoundId,
        team1Name,
        team2Name,
      })
      setIsSeriesDetailPopupOpen(true)
      console.log(
        "[AdvBracket] Opening SeriesDetailPopup for matchup:",
        foundMatchup.id,
        "in round:",
        targetRoundId,
        "Teams:",
        team1Name,
        "vs",
        team2Name,
      )
    },
    [rawMatchDataByRound, toast],
  )

  if (isLoadingTournament) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6 min-h-[calc(100vh-200px)]">
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-r from-[#0a7578] to-[#b17e1e] rounded-2xl flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-white" />
          </div>
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#b17e1e] rounded-full flex items-center justify-center">
            <Trophy className="h-3 w-3 text-white" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-[#0a7578] to-[#b17e1e] bg-clip-text text-transparent">
            Loading Tournament
          </h2>
          <p className="text-muted-foreground">Fetching tournament information...</p>
        </div>
      </div>
    )
  }

  if (!activeTournament && !isLoadingTournament) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center min-h-[calc(100vh-200px)]">
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-r from-[#0a7578]/10 to-[#b17e1e]/10 rounded-2xl flex items-center justify-center border-2 border-dashed border-[#0a7578]/30">
            <Info className="h-10 w-10 text-[#0a7578]" />
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-[#0a7578] to-[#b17e1e] bg-clip-text text-transparent">
            No Tournament Active
          </h2>
          <p className="text-muted-foreground max-w-lg">
            Please create or select a tournament to view the advanced bracket visualization.
          </p>
        </div>
      </div>
    )
  }

  if (activeTournament && activeTournament.numberOfRounds === 0 && !isLoadingBracketData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center min-h-[calc(100vh-200px)]">
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-r from-[#0a7578]/10 to-[#b17e1e]/10 rounded-2xl flex items-center justify-center border-2 border-dashed border-[#0a7578]/30">
            <Target className="h-10 w-10 text-[#0a7578]" />
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-[#0a7578] to-[#b17e1e] bg-clip-text text-transparent">
            Tournament Has No Rounds
          </h2>
          <p className="text-muted-foreground max-w-lg">
            Tournament "{activeTournament.name}" is configured with 0 rounds. No bracket to display.
          </p>
        </div>
      </div>
    )
  }

  if (criticalError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center min-h-[calc(100vh-200px)]">
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-2xl flex items-center justify-center border-2 border-dashed border-red-500/30">
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-3xl font-bold text-red-600">Bracket Error</h2>
          <p className="text-muted-foreground max-w-lg">{criticalError}</p>
        </div>
      </div>
    )
  }

  if (isLoadingBracketData || !dynamicDisplayRounds) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6 min-h-[calc(100vh-200px)]">
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-r from-[#0a7578] to-[#b17e1e] rounded-2xl flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-white" />
          </div>
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#b17e1e] rounded-full flex items-center justify-center">
            <Users className="h-3 w-3 text-white" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-[#0a7578] to-[#b17e1e] bg-clip-text text-transparent">
            Loading Bracket Data
          </h2>
          <p className="text-muted-foreground">Loading data for {activeTournament?.name || "tournament"}...</p>
          <Badge variant="outline" className="text-xs">
            Fetched {Object.keys(rawMatchDataByRound).length} / {activeTournament?.numberOfRounds || "N/A"} rounds
          </Badge>
        </div>
      </div>
    )
  }

  if (dynamicDisplayRounds.length === 0 && activeTournament && activeTournament.numberOfRounds > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6 min-h-[calc(100vh-200px)]">
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-r from-[#0a7578]/10 to-[#b17e1e]/10 rounded-2xl flex items-center justify-center border-2 border-dashed border-[#0a7578]/30">
            <Info className="h-10 w-10 text-[#0a7578]" />
          </div>
        </div>
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-[#0a7578] to-[#b17e1e] bg-clip-text text-transparent">
            No Match Data Found
          </h2>
          <p className="text-muted-foreground max-w-lg">
            No match data found for "{activeTournament.name}". Ensure matches are populated in Firestore for all rounds.
          </p>
        </div>
      </div>
    )
  }

  // Before rendering brackets, log dynamicDisplayRounds for debugging
  console.log("[AdvancedBracket] dynamicDisplayRounds:", dynamicDisplayRounds)

  let leftPathRounds: AdvancedRound[] = []
  let championshipRound: AdvancedRound[] = []
  let rightPathRounds: AdvancedRound[] = []

  if (activeTournament.teamCount === 16) {
    leftPathRounds = dynamicDisplayRounds.slice(0, 3)
    championshipRound = dynamicDisplayRounds.slice(3, 4)
    rightPathRounds = dynamicDisplayRounds.slice(4)
  } else if (activeTournament.teamCount === 8) {
    leftPathRounds = dynamicDisplayRounds.slice(0, 2)
    championshipRound = dynamicDisplayRounds.slice(2, 3)
    rightPathRounds = dynamicDisplayRounds.slice(3)
  }

  let championshipPaddingTop = "pt-[calc(3*6rem+1.5rem)]"
  if (activeTournament.teamCount === 8) {
    championshipPaddingTop = "pt-[calc(1*6rem+1.5rem)]"
  }

  return (
    <div className="space-y-8">
      {/* Tournament Header Badge */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-r from-[#0a7578] to-[#b17e1e] rounded-xl flex items-center justify-center">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#0a7578] to-[#b17e1e] bg-clip-text text-transparent">
              {activeTournament?.name || "Tournament Bracket"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTournament?.teamCount || "N/A"}-Team Advanced Bracket View
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0a7578]" />
            <span className="text-muted-foreground">
              <span className="font-semibold text-[#0a7578]">{activeTournament?.teamCount}</span> Teams
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#b17e1e]" />
            <span className="text-muted-foreground">
              <span className="font-semibold text-[#b17e1e]">{activeTournament?.numberOfRounds}</span> Rounds
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-600" />
            <span className="text-muted-foreground">
              Started{" "}
              <span className="font-semibold text-green-600">
                {activeTournament?.startDate ? formatDate(activeTournament.startDate, "MMM d, yyyy") : "N/A"}
              </span>
            </span>
          </div>
        </div>

        <Badge variant="secondary" className="bg-[#0a7578]/10 text-[#0a7578] border-[#0a7578]/20">
          Click on matches to view daily breakdown and statistics
        </Badge>
      </div>

      {/* Bracket */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-2 sm:p-4 md:p-8 shadow-xl border border-slate-200">
        <div className="overflow-x-auto">
          <div className="w-full min-w-[350px] sm:min-w-[900px] md:min-w-[1400px] lg:min-w-[1800px] xl:min-w-[2200px] max-w-full mx-auto">
            <div className="flex flex-col md:flex-row justify-center items-start gap-4 md:gap-8">
              {leftPathRounds.length > 0 && (
                <div className="flex-initial">
                  <Bracket
                    rounds={leftPathRounds}
                    renderSeedComponent={(props: any) => (
                      <TournamentMatchBox {...props} onMatchClick={handleMatchupCardClick} />
                    )}
                    roundTitleComponent={TournamentRoundTitle}
                  />
                </div>
              )}

              {championshipRound.length > 0 && (
                <div className={`flex-initial ${championshipPaddingTop}`}>
                  {/* Championship Section */}
                  <div className="flex flex-col items-center mb-6">
                    <div className="bg-gradient-to-r from-[#0a7578] to-[#0b1821] rounded-2xl px-4 md:px-6 py-2 md:py-3 shadow-lg border-2 border-[#b17e1e]">
                      <div className="text-center text-white">
                        <div className="text-xs font-bold tracking-wider text-[#b17e1e]">NATIONAL</div>
                        <div className="text-lg font-black">CHAMPION</div>
                      </div>
                    </div>
                  </div>

                  <Bracket
                    rounds={championshipRound}
                    renderSeedComponent={(props: any) => (
                      <TournamentMatchBox {...props} onMatchClick={handleMatchupCardClick} isChampionship={true} />
                    )}
                    roundTitleComponent={TournamentRoundTitle}
                  />
                </div>
              )}

              {rightPathRounds.length > 0 && (
                <div className="flex-initial">
                  <div className="mirror-bracket">
                    <Bracket
                      rounds={rightPathRounds}
                      renderSeedComponent={(props: any) => (
                        <TournamentMatchBox {...props} isRightSide={true} onMatchClick={handleMatchupCardClick} />
                      )}
                      roundTitleComponent={TournamentRoundTitle}
                    />
                  </div>
                </div>
              )}
            </div>
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
    </div>
  )
}

function TournamentRoundTitle(title: ReactNode, roundIndex: number) {
  // Only show 'Round 1', 'Round 2', ...
  if (!title) {
    console.warn("[TournamentRoundTitle] Missing title prop, using fallback label.")
    return (
      <div className="text-center mb-6 mt-4">
        <div className="inline-block rounded-xl px-4 py-3 shadow-lg border-2 bg-white border-[#0a7578] text-[#0a7578]">
          <div className="text-sm font-bold tracking-wider">Round</div>
        </div>
      </div>
    )
  }
  const lines = String(title || "").split("\n").filter(Boolean)

  // Debug logs for troubleshooting round title rendering
  console.log("[TournamentRoundTitle] Raw title prop:", title)
  console.log("[TournamentRoundTitle] Lines after split:", lines)

  // Try to extract round number from the first line
  let roundNumberLabel = null
  const roundMatch = lines[0]?.match(/ROUND\s*(\d+)/i)
  console.log("[TournamentRoundTitle] Regex match result:", roundMatch)
  if (roundMatch) {
    roundNumberLabel = `Round ${roundMatch[1]}`
  } else {
    // fallback: if not found, just show the first line as is
    roundNumberLabel = lines[0] || ""
  }
  console.log("[TournamentRoundTitle] Final label to render:", roundNumberLabel)

  return (
    <div className="text-center mb-6 mt-4">
      <div className="inline-block rounded-xl px-4 py-3 shadow-lg border-2 bg-white border-[#0a7578] text-[#0a7578]">
        <div className="text-sm font-bold tracking-wider">{roundNumberLabel}</div>
      </div>
    </div>
  )
}

interface TournamentMatchBoxProps {
  seed: AdvancedSeedProps
  breakpoint: string
  roundIndex: number
  seedIndex: number
  isRightSide?: boolean
  isChampionship?: boolean
  onMatchClick?: (compositeId: string) => void
}

function TournamentMatchBox({
  seed,
  breakpoint,
  roundIndex,
  seedIndex,
  isRightSide = false,
  isChampionship = false,
  onMatchClick,
}: TournamentMatchBoxProps) {
  const team1 = seed.teams[0]
  const team2 = seed.teams[1]

  let seriesWinnerName: string | null = null
  let winnerIndex: 0 | 1 | undefined = undefined

  if (team1?.score !== undefined && team1.score >= 3) {
    winnerIndex = 0
    seriesWinnerName = team1.name
  } else if (team2?.score !== undefined && team2.score >= 3) {
    winnerIndex = 1
    seriesWinnerName = team2.name
  }

  const seedWrapperStyle = isRightSide ? { transform: "scaleX(-1)" } : {}
  const seedContentStyle = isRightSide ? { transform: "scaleX(-1)" } : {}

  const canOpenDetails =
    onMatchClick &&
    team1?.name &&
    team1.name.toLowerCase() !== "tbd" &&
    team2?.name &&
    team2.name.toLowerCase() !== "tbd"

  const matchBoxClass = `
    relative bg-white border-2 rounded-lg shadow-lg transition-all duration-200
    ${isChampionship ? "border-[#b17e1e] shadow-[#b17e1e]/20" : "border-[#0a7578]"}
    ${canOpenDetails ? "cursor-pointer hover:shadow-xl hover:scale-105" : "cursor-default"}
    ${seriesWinnerName ? "ring-2 ring-[#b17e1e] ring-opacity-50" : ""}
  `

  return (
    <Seed mobileBreakpoint={breakpoint} style={seedWrapperStyle}>
      <SeedItem className="bg-transparent border-none shadow-none">
        <div className="flex flex-col items-center" style={seedContentStyle}>
          <div
            className={matchBoxClass}
            onClick={() => canOpenDetails && onMatchClick?.(seed.id)}
            title={canOpenDetails ? "Click for daily match details" : "Details available when teams are set"}
          >
            {/* Match Header */}
            {isChampionship && (
              <div className="bg-gradient-to-r from-[#b17e1e] to-[#0a7578] text-white text-xs font-bold py-1 px-3 text-center rounded-t-md">
                🏆 CHAMPIONSHIP MATCH
              </div>
            )}

            {/* Teams */}
            <div className="w-[200px]">
              <TournamentTeamSlot team={team1} isWinner={winnerIndex === 0} position="top" />
              <div className="border-t border-gray-200"></div>
              <TournamentTeamSlot team={team2} isWinner={winnerIndex === 1} position="bottom" />
            </div>

            {/* Match Status */}
            {seriesWinnerName && (
              <div className="bg-gradient-to-r from-[#0a7578] to-[#b17e1e] text-white text-xs font-bold py-1 px-3 text-center rounded-b-md">
                Winner: {seriesWinnerName}
              </div>
            )}

            {/* Series indicator for active matches */}
            {!seriesWinnerName &&
              team1?.name &&
              team1.name.toLowerCase() !== "tbd" &&
              team2?.name &&
              team2.name.toLowerCase() !== "tbd" && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              )}
          </div>

          {/* Date */}
          {seed.date && (
            <div className="mt-2 text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">{seed.date}</div>
          )}
        </div>
      </SeedItem>
    </Seed>
  )
}

function TournamentTeamSlot({
  team,
  isWinner,
  position,
}: {
  team: AdvancedTeam | undefined
  isWinner?: boolean
  position: "top" | "bottom"
}) {
  if (!team || !team.name || team.name.toLowerCase() === "tbd") {
    return (
      <div className="py-2 px-3 flex justify-between items-center text-gray-400 min-h-[36px]">
        <span className="text-sm italic">TBD</span>
        <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">0</span>
      </div>
    )
  }

  return (
    <div
      className={`py-2 px-3 flex justify-between items-center min-h-[36px] transition-all duration-200 ${
        isWinner
          ? "bg-gradient-to-r from-[#0a7578]/10 to-[#b17e1e]/10 text-[#0a7578] font-semibold"
          : "bg-white text-gray-700 hover:bg-gray-50"
      } ${position === "top" ? "rounded-t-md" : "rounded-b-md"}`}
    >
      <div className="flex items-center gap-2">
        {isWinner && <Star className="w-3 h-3 text-[#b17e1e] fill-current" />}
        <span className="text-sm font-medium truncate max-w-[120px]" title={team.name}>
          {team.name}
        </span>
      </div>
      {team.score !== undefined && (
        <span
          className={`text-xs font-bold px-2 py-1 rounded ${
            isWinner ? "bg-gradient-to-r from-[#0a7578] to-[#b17e1e] text-white" : "bg-gray-100 text-gray-600"
          }`}
        >
          {team.score}
        </span>
      )}
    </div>
  )
}
