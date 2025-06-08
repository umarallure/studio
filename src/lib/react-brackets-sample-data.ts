
import type { RoundProps } from 'react-brackets';

export const sampleRounds16Teams: RoundProps[] = [
  {
    title: 'Round 1 - Left',
    seeds: [
      { id: 1, teams: [{ name: 'Team A' }, { name: 'Team B' }] },
      { id: 2, teams: [{ name: 'Team C' }, { name: 'Team D' }] },
      { id: 3, teams: [{ name: 'Team E' }, { name: 'Team F' }] },
      { id: 4, teams: [{ name: 'Team G' }, { name: 'Team H' }] },
    ],
  },
  {
    title: 'Round 1 - Right',
    seeds: [
      { id: 5, teams: [{ name: 'Team I' }, { name: 'Team J' }] },
      { id: 6, teams: [{ name: 'Team K' }, { name: 'Team L' }] },
      { id: 7, teams: [{ name: 'Team M' }, { name: 'Team N' }] },
      { id: 8, teams: [{ name: 'Team O' }, { name: 'Team P' }] },
    ],
  },
  {
    title: 'Quarterfinals - Left',
    seeds: [
      { id: 9, teams: [{ name: 'Team A' }, { name: 'Team C' }] },
      { id: 10, teams: [{ name: 'Team E' }, { name: 'Team G' }] },
    ],
  },
  {
    title: 'Quarterfinals - Right',
    seeds: [
      { id: 11, teams: [{ name: 'Team I' }, { name: 'Team K' }] },
      { id: 12, teams: [{ name: 'Team M' }, { name: 'Team O' }] },
    ],
  },
  {
    title: 'Semifinals - Left',
    seeds: [{ id: 13, teams: [{ name: 'Team A' }, { name: 'Team E' }] }],
  },
  {
    title: 'Semifinals - Right',
    seeds: [{ id: 14, teams: [{ name: 'Team I' }, { name: 'Team M' }] }],
  },
  {
    title: 'Finals',
    seeds: [{ id: 15, teams: [{ name: 'Team A' }, { name: 'Team I' }] }],
  },
];

// More detailed example with scores and winners for the first few matches
export const sampleRoundsWithScores: RoundProps[] = [
  {
    title: 'Round 1',
    seeds: [
      // Left Side
      { id: 1, date: '2024-07-20', teams: [{ name: 'Team A', score: 3 }, { name: 'Team B', score: 1 }] },
      { id: 2, date: '2024-07-20', teams: [{ name: 'Team C', score: 0 }, { name: 'Team D', score: 3 }] },
      { id: 3, date: '2024-07-21', teams: [{ name: 'Team E', score: 3 }, { name: 'Team F', score: 2 }] },
      { id: 4, date: '2024-07-21', teams: [{ name: 'Team G', score: 2 }, { name: 'Team H', score: 3 }] },
      // Right Side
      { id: 5, date: '2024-07-20', teams: [{ name: 'Team I', score: 3 }, { name: 'Team J', score: 0 }] },
      { id: 6, date: '2024-07-20', teams: [{ name: 'Team K', score: 3 }, { name: 'Team L', score: 1 }] },
      { id: 7, date: '2024-07-21', teams: [{ name: 'Team M', score: 3 }, { name: 'Team N', score: 2 }] },
      { id: 8, date: '2024-07-21', teams: [{ name: 'Team O', score: 1 }, { name: 'Team P', score: 3 }] },
    ],
  },
  {
    title: 'Quarterfinals',
    seeds: [
      // Left Side
      { id: 9, date: '2024-07-27', teams: [{ name: 'Team A' }, { name: 'Team D' }] }, // Winner of 1 vs Winner of 2
      { id: 10, date: '2024-07-27', teams: [{ name: 'Team E' }, { name: 'Team H' }] }, // Winner of 3 vs Winner of 4
      // Right Side
      { id: 11, date: '2024-07-27', teams: [{ name: 'Team I' }, { name: 'Team K' }] }, // Winner of 5 vs Winner of 6
      { id: 12, date: '2024-07-27', teams: [{ name: 'Team M' }, { name: 'Team P' }] }, // Winner of 7 vs Winner of 8
    ],
  },
  {
    title: 'Semifinals',
    seeds: [
      // Combined from left and right winners of QF
      { id: 13, date: '2024-08-03', teams: [/* Winner of 9 */ {name: 'Team A'}, /* Winner of 10 */ {name: 'Team E'}] },
      { id: 14, date: '2024-08-03', teams: [/* Winner of 11 */ {name: 'Team I'}, /* Winner of 12 */ {name: 'Team M'}] },
    ],
  },
  {
    title: 'Finals',
    seeds: [
      { id: 15, date: '2024-08-10', teams: [/* Winner of 13 */ {name: 'Team A'}, /* Winner of 14 */ {name: 'Team I'}] },
    ],
  },
];
