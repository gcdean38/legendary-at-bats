import type { ArsenalPitch } from "@/lib/arsenal";
import type { RewriteBatter } from "@/data/rewrite-lineups";
import type { ScoreSide } from "@/lib/types";

/** Bot 9 difficulty — fixed deficit (no random hole). */
export type Bot9Difficulty = "easy" | "medium" | "hard";

export const BOT9_DEFICIT: Record<Bot9Difficulty, 1 | 2 | 3> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

/**
 * Bottom of the 9th seeds — real playoff settings with a series closer
 * who works the full inning, plus a sized home batting order:
 * down 1 → 7, down 2 → 8, down 3 → 9.
 */
export type Bot9Scenario = {
  year: number;
  series: string;
  gameLabel: string;
  venue: string;
  /** Franchise nicknames (display + batter/pitcher team) */
  awayTeam: string;
  homeTeam: string;
  away: ScoreSide;
  home: ScoreSide;
  pitcher: {
    name: string;
    number: number;
    throws: "L" | "R";
    arsenal: ArsenalPitch[];
  };
  /** Home batting order for this rally (already sized to difficulty) */
  lineup: RewriteBatter[];
};

export const BOT9_MAX_BATTERS: Record<Bot9Difficulty, number> = {
  easy: 7,
  medium: 8,
  hard: 9,
};

export const BOT9_SCENARIOS: Record<Bot9Difficulty, Bot9Scenario[]> = {
  // Down 1 — 7 batters
  easy: [
    {
      year: 1993,
      series: "World Series",
      gameLabel: "Game 6",
      venue: "Rogers Centre",
      awayTeam: "Phillies",
      homeTeam: "Blue Jays",
      away: { abbr: "PHI", runs: 6 },
      home: { abbr: "TOR", runs: 5 },
      pitcher: {
        name: "Mitch Williams",
        number: 99,
        throws: "L",
        arsenal: [
          { type: "FF", speedMph: 93 },
          { type: "SL", speedMph: 84 },
          { type: "CU", speedMph: 76 },
          { type: "CH", speedMph: 82 },
        ],
      },
      lineup: [
        { name: "Rickey Henderson", number: 24, bats: "R" },
        { name: "Devon White", number: 22, bats: "S" },
        { name: "Paul Molitor", number: 4, bats: "R" },
        { name: "Joe Carter", number: 29, bats: "R" },
        { name: "John Olerud", number: 9, bats: "L" },
        { name: "Roberto Alomar", number: 12, bats: "S" },
        { name: "Tony Fernandez", number: 1, bats: "S" },
      ],
    },
    {
      year: 2001,
      series: "World Series",
      gameLabel: "Game 7",
      venue: "Bank One Ballpark",
      awayTeam: "Yankees",
      homeTeam: "Diamondbacks",
      away: { abbr: "NYY", runs: 2 },
      home: { abbr: "ARI", runs: 1 },
      pitcher: {
        name: "Mariano Rivera",
        number: 42,
        throws: "R",
        arsenal: [
          { type: "CT", speedMph: 91 },
          { type: "FF", speedMph: 94 },
          { type: "SL", speedMph: 84 },
        ],
      },
      lineup: [
        { name: "Tony Womack", number: 5, bats: "L" },
        { name: "Craig Counsell", number: 4, bats: "L" },
        { name: "Luis Gonzalez", number: 20, bats: "L" },
        { name: "Matt Williams", number: 9, bats: "R" },
        { name: "Steve Finley", number: 12, bats: "L" },
        { name: "Reggie Sanders", number: 18, bats: "R" },
        { name: "Mark Grace", number: 17, bats: "L" },
      ],
    },
    {
      year: 1979,
      series: "ALCS",
      gameLabel: "Game 3",
      venue: "Angel Stadium",
      awayTeam: "Orioles",
      homeTeam: "Angels",
      away: { abbr: "BAL", runs: 3 },
      home: { abbr: "ANA", runs: 2 },
      pitcher: {
        name: "Tippy Martinez",
        number: 42,
        throws: "L",
        arsenal: [
          { type: "FF", speedMph: 90 },
          { type: "CU", speedMph: 74 },
          { type: "SL", speedMph: 81 },
          { type: "CH", speedMph: 80 },
        ],
      },
      lineup: [
        { name: "Rod Carew", number: 29, bats: "L" },
        { name: "Carney Lansford", number: 4, bats: "R" },
        { name: "Dan Ford", number: 15, bats: "R" },
        { name: "Don Baylor", number: 25, bats: "R" },
        { name: "Bobby Grich", number: 3, bats: "R" },
        { name: "Brian Downing", number: 5, bats: "R" },
        { name: "Larry Harlow", number: 18, bats: "L" },
      ],
    },
  ],

  // Down 2 — 8 batters
  medium: [
    {
      year: 2011,
      series: "World Series",
      gameLabel: "Game 6",
      venue: "Busch Stadium",
      awayTeam: "Rangers",
      homeTeam: "Cardinals",
      away: { abbr: "TEX", runs: 7 },
      home: { abbr: "STL", runs: 5 },
      pitcher: {
        name: "Neftali Feliz",
        number: 30,
        throws: "R",
        arsenal: [
          { type: "FF", speedMph: 97 },
          { type: "SL", speedMph: 86 },
          { type: "CH", speedMph: 85 },
        ],
      },
      lineup: [
        { name: "Rafael Furcal", number: 15, bats: "S" },
        { name: "Jon Jay", number: 19, bats: "L" },
        { name: "Albert Pujols", number: 5, bats: "R" },
        { name: "Lance Berkman", number: 12, bats: "S" },
        { name: "Matt Holliday", number: 7, bats: "R" },
        { name: "David Freese", number: 23, bats: "R" },
        { name: "Yadier Molina", number: 4, bats: "R" },
        { name: "Nick Punto", number: 8, bats: "S" },
      ],
    },
    {
      year: 1992,
      series: "NLCS",
      gameLabel: "Game 7",
      venue: "Atlanta-Fulton County Stadium",
      awayTeam: "Pirates",
      homeTeam: "Braves",
      away: { abbr: "PIT", runs: 2 },
      home: { abbr: "ATL", runs: 0 },
      pitcher: {
        name: "Stan Belinda",
        number: 51,
        throws: "R",
        arsenal: [
          { type: "FF", speedMph: 92 },
          { type: "SL", speedMph: 83 },
          { type: "CU", speedMph: 76 },
          { type: "CH", speedMph: 81 },
        ],
      },
      lineup: [
        { name: "Otis Nixon", number: 1, bats: "S" },
        { name: "Jeff Blauser", number: 4, bats: "R" },
        { name: "Terry Pendleton", number: 9, bats: "S" },
        { name: "David Justice", number: 23, bats: "L" },
        { name: "Ron Gant", number: 5, bats: "R" },
        { name: "Sid Bream", number: 12, bats: "L" },
        { name: "Damon Berryhill", number: 15, bats: "S" },
        { name: "Francisco Cabrera", number: 20, bats: "R" },
      ],
    },
    {
      year: 2023,
      series: "ALCS",
      gameLabel: "Game 5",
      venue: "Minute Maid Park",
      awayTeam: "Rangers",
      homeTeam: "Astros",
      away: { abbr: "TEX", runs: 4 },
      home: { abbr: "HOU", runs: 2 },
      pitcher: {
        name: "Jose Leclerc",
        number: 25,
        throws: "R",
        arsenal: [
          { type: "FF", speedMph: 96 },
          { type: "SL", speedMph: 86 },
          { type: "CH", speedMph: 84 },
          { type: "CU", speedMph: 78 },
        ],
      },
      lineup: [
        { name: "Jose Altuve", number: 27, bats: "R" },
        { name: "Jeremy Pena", number: 3, bats: "R" },
        { name: "Yordan Alvarez", number: 44, bats: "L" },
        { name: "Alex Bregman", number: 2, bats: "R" },
        { name: "Kyle Tucker", number: 30, bats: "L" },
        { name: "Jose Abreu", number: 79, bats: "R" },
        { name: "Chas McCormick", number: 20, bats: "R" },
        { name: "Martin Maldonado", number: 15, bats: "R" },
      ],
    },
  ],

  // Down 3 — 9 batters
  hard: [
    {
      year: 2016,
      series: "NLDS",
      gameLabel: "Game 4",
      venue: "Wrigley Field",
      awayTeam: "Giants",
      homeTeam: "Cubs",
      away: { abbr: "SF", runs: 5 },
      home: { abbr: "CHC", runs: 2 },
      pitcher: {
        name: "Sergio Romo",
        number: 54,
        throws: "R",
        arsenal: [
          { type: "SL", speedMph: 82 },
          { type: "FF", speedMph: 89 },
          { type: "CH", speedMph: 80 },
          { type: "CU", speedMph: 74 },
        ],
      },
      lineup: [
        { name: "Dexter Fowler", number: 24, bats: "S" },
        { name: "Kris Bryant", number: 17, bats: "R" },
        { name: "Anthony Rizzo", number: 44, bats: "L" },
        { name: "Ben Zobrist", number: 18, bats: "S" },
        { name: "Addison Russell", number: 27, bats: "R" },
        { name: "Javier Baez", number: 9, bats: "R" },
        { name: "Jason Heyward", number: 22, bats: "L" },
        { name: "Willson Contreras", number: 40, bats: "R" },
        { name: "Jorge Soler", number: 68, bats: "R" },
      ],
    },
    {
      year: 2004,
      series: "ALCS",
      gameLabel: "Game 5",
      venue: "Fenway Park",
      awayTeam: "Yankees",
      homeTeam: "Red Sox",
      away: { abbr: "NYY", runs: 6 },
      home: { abbr: "BOS", runs: 3 },
      pitcher: {
        name: "Mariano Rivera",
        number: 42,
        throws: "R",
        arsenal: [
          { type: "CT", speedMph: 92 },
          { type: "FF", speedMph: 95 },
          { type: "SL", speedMph: 85 },
        ],
      },
      lineup: [
        { name: "Johnny Damon", number: 18, bats: "L" },
        { name: "Mark Bellhorn", number: 12, bats: "S" },
        { name: "Manny Ramirez", number: 24, bats: "R" },
        { name: "David Ortiz", number: 34, bats: "L" },
        { name: "Kevin Millar", number: 15, bats: "R" },
        { name: "Trot Nixon", number: 7, bats: "L" },
        { name: "Jason Varitek", number: 33, bats: "S" },
        { name: "Bill Mueller", number: 11, bats: "S" },
        { name: "Orlando Cabrera", number: 2, bats: "R" },
      ],
    },
    {
      year: 2019,
      series: "World Series",
      gameLabel: "Game 2",
      venue: "Minute Maid Park",
      awayTeam: "Nationals",
      homeTeam: "Astros",
      away: { abbr: "WSH", runs: 7 },
      home: { abbr: "HOU", runs: 4 },
      pitcher: {
        name: "Sean Doolittle",
        number: 63,
        throws: "L",
        arsenal: [
          { type: "FF", speedMph: 94 },
          { type: "SL", speedMph: 85 },
          { type: "CH", speedMph: 83 },
        ],
      },
      lineup: [
        { name: "George Springer", number: 4, bats: "R" },
        { name: "Jose Altuve", number: 27, bats: "R" },
        { name: "Michael Brantley", number: 23, bats: "L" },
        { name: "Alex Bregman", number: 2, bats: "R" },
        { name: "Yordan Alvarez", number: 44, bats: "L" },
        { name: "Yuli Gurriel", number: 10, bats: "R" },
        { name: "Carlos Correa", number: 1, bats: "R" },
        { name: "Robinson Chirinos", number: 28, bats: "R" },
        { name: "Josh Reddick", number: 22, bats: "L" },
      ],
    },
  ],
};
