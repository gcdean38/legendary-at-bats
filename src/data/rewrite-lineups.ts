/**
 * Follow-up batters for legendary rewrites (losing-team moments).
 * After the scripted AB, these teammates step up until the lead
 * flips or the third out is recorded.
 */
export type RewriteBatter = {
  name: string;
  number: number;
  bats: "L" | "R" | "S";
};

export const REWRITE_LINEUPS: Record<string, RewriteBatter[]> = {
  /** 1975 WS G7 — Yaz last out, Red Sox trailing by one */
  "1975-ws7-boston-8": [
    { name: "Carlton Fisk", number: 27, bats: "R" },
    { name: "Fred Lynn", number: 19, bats: "L" },
    { name: "Rico Petrocelli", number: 6, bats: "R" },
    { name: "Dwight Evans", number: 24, bats: "R" },
    { name: "Rick Burleson", number: 7, bats: "R" },
    { name: "Denny Doyle", number: 5, bats: "L" },
    { name: "Bernie Carbo", number: 1, bats: "L" },
    { name: "Cecil Cooper", number: 17, bats: "L" },
  ],
  /** 2005 WS G1 — Bagwell K, Astros trailing with traffic on */
  "2005-ws1-houston-5": [
    { name: "Jason Lane", number: 16, bats: "R" },
    { name: "Brad Ausmus", number: 11, bats: "R" },
    { name: "Adam Everett", number: 28, bats: "R" },
    { name: "Craig Biggio", number: 7, bats: "R" },
    { name: "Willy Taveras", number: 1, bats: "R" },
    { name: "Lance Berkman", number: 17, bats: "S" },
    { name: "Morgan Ensberg", number: 14, bats: "R" },
    { name: "Mike Lamb", number: 25, bats: "L" },
  ],
  /** 2025 WS G7 — Kirk GIDP, Blue Jays trailing late */
  "2025-ws7-toronto-30": [
    { name: "Vladimir Guerrero Jr.", number: 27, bats: "R" },
    { name: "Bo Bichette", number: 11, bats: "R" },
    { name: "George Springer", number: 4, bats: "R" },
    { name: "Daulton Varsho", number: 25, bats: "L" },
    { name: "Ernie Clement", number: 22, bats: "R" },
    { name: "Andrés Giménez", number: 0, bats: "L" },
    { name: "Addison Barger", number: 47, bats: "L" },
    { name: "Nathan Lukes", number: 38, bats: "L" },
  ],
  /** 2024 WS G5 — Judge last chance, Yankees trailing */
  "2024-ws5-newyork-99": [
    { name: "Juan Soto", number: 22, bats: "L" },
    { name: "Jazz Chisholm Jr.", number: 13, bats: "L" },
    { name: "Giancarlo Stanton", number: 27, bats: "R" },
    { name: "Gleyber Torres", number: 25, bats: "R" },
    { name: "Anthony Volpe", number: 11, bats: "R" },
    { name: "Austin Wells", number: 55, bats: "L" },
    { name: "Alex Verdugo", number: 12, bats: "L" },
    { name: "Anthony Rizzo", number: 48, bats: "L" },
  ],
  /** 2003 NLCS G6 — Gonzalez, Cubs unraveling at Wrigley */
  "2003-nlcs6-chicago-8": [
    { name: "Sammy Sosa", number: 21, bats: "R" },
    { name: "Moises Alou", number: 18, bats: "R" },
    { name: "Aramis Ramirez", number: 16, bats: "R" },
    { name: "Kenny Lofton", number: 7, bats: "L" },
    { name: "Mark Grudzielanek", number: 5, bats: "R" },
    { name: "Randall Simon", number: 35, bats: "L" },
    { name: "Damian Miller", number: 20, bats: "R" },
    { name: "Paul Bako", number: 9, bats: "L" },
  ],
  /** 2016 WS G7 — Martinez last chance, Indians trailing */
  "2016-ws7-cleveland-1": [
    { name: "Carlos Santana", number: 41, bats: "S" },
    { name: "Jason Kipnis", number: 22, bats: "L" },
    { name: "Francisco Lindor", number: 12, bats: "S" },
    { name: "Mike Napoli", number: 26, bats: "R" },
    { name: "Jose Ramirez", number: 11, bats: "S" },
    { name: "Lonnie Chisenhall", number: 8, bats: "L" },
    { name: "Tyler Naquin", number: 30, bats: "L" },
    { name: "Roberto Perez", number: 55, bats: "R" },
  ],
  /** 2023 WS G5 — Arizona down 5, Marte last chance */
  "2023-ws5-arizona-4": [
    { name: "Corbin Carroll", number: 7, bats: "L" },
    { name: "Lourdes Gurriel Jr.", number: 12, bats: "R" },
    { name: "Christian Walker", number: 53, bats: "R" },
    { name: "Tommy Pham", number: 28, bats: "R" },
    { name: "Evan Longoria", number: 3, bats: "R" },
    { name: "Gabriel Moreno", number: 14, bats: "R" },
    { name: "Alek Thomas", number: 5, bats: "L" },
    { name: "Geraldo Perdomo", number: 2, bats: "S" },
  ],
  /** 2022 WS G5 — Castellanos last out, Phillies trailing by one */
  "2022-ws5-castellanos": [
    { name: "Bryce Harper", number: 3, bats: "L" },
    { name: "J.T. Realmuto", number: 10, bats: "R" },
    { name: "Rhys Hoskins", number: 17, bats: "R" },
    { name: "Kyle Schwarber", number: 12, bats: "L" },
    { name: "Alec Bohm", number: 28, bats: "R" },
    { name: "Brandon Marsh", number: 16, bats: "L" },
    { name: "Jean Segura", number: 2, bats: "R" },
    { name: "Bryson Stott", number: 5, bats: "L" },
  ],
  /** 2022 WS G6 — Phillies trailing late */
  "2022-ws6-philadelphia-3": [
    { name: "Nick Castellanos", number: 8, bats: "R" },
    { name: "J.T. Realmuto", number: 10, bats: "R" },
    { name: "Rhys Hoskins", number: 17, bats: "R" },
    { name: "Kyle Schwarber", number: 12, bats: "L" },
    { name: "Alec Bohm", number: 28, bats: "R" },
    { name: "Brandon Marsh", number: 16, bats: "L" },
    { name: "Jean Segura", number: 2, bats: "R" },
    { name: "Edmundo Sosa", number: 33, bats: "R" },
  ],
  /** 2010 NLCS G6 — Howard K looking, Phillies season over */
  "2010-nlcs6-howard": [
    { name: "Jayson Werth", number: 28, bats: "R" },
    { name: "Shane Victorino", number: 8, bats: "S" },
    { name: "Raul Ibanez", number: 29, bats: "L" },
    { name: "Carlos Ruiz", number: 51, bats: "R" },
    { name: "Jimmy Rollins", number: 11, bats: "S" },
    { name: "Placido Polanco", number: 27, bats: "R" },
    { name: "Chase Utley", number: 26, bats: "L" },
    { name: "Ben Francisco", number: 10, bats: "R" },
  ],
  /** 2019 WS G7 — Astros down 4, Brantley last chance */
  "2019-ws7-houston-4": [
    { name: "George Springer", number: 4, bats: "R" },
    { name: "Jose Altuve", number: 27, bats: "R" },
    { name: "Alex Bregman", number: 2, bats: "R" },
    { name: "Yordan Alvarez", number: 44, bats: "L" },
    { name: "Yuli Gurriel", number: 10, bats: "R" },
    { name: "Carlos Correa", number: 1, bats: "R" },
    { name: "Josh Reddick", number: 22, bats: "L" },
    { name: "Martin Maldonado", number: 15, bats: "R" },
  ],
  /** 2021 WS G6 — Astros down 7, Altuve last chance */
  "2021-ws6-houston-27": [
    { name: "Michael Brantley", number: 23, bats: "L" },
    { name: "Alex Bregman", number: 2, bats: "R" },
    { name: "Yordan Alvarez", number: 44, bats: "L" },
    { name: "Carlos Correa", number: 1, bats: "R" },
    { name: "Kyle Tucker", number: 30, bats: "L" },
    { name: "Yuli Gurriel", number: 10, bats: "R" },
    { name: "Chas McCormick", number: 20, bats: "R" },
    { name: "Martin Maldonado", number: 15, bats: "R" },
  ],
  /** 2017 ALCS G7 — Yankees down 4, Judge last chance */
  "2017-alcs7-newyork-99": [
    { name: "Didi Gregorius", number: 18, bats: "L" },
    { name: "Gary Sanchez", number: 24, bats: "R" },
    { name: "Starlin Castro", number: 14, bats: "R" },
    { name: "Greg Bird", number: 33, bats: "L" },
    { name: "Aaron Hicks", number: 31, bats: "S" },
    { name: "Brett Gardner", number: 11, bats: "L" },
    { name: "Chase Headley", number: 12, bats: "S" },
    { name: "Jacoby Ellsbury", number: 22, bats: "L" },
  ],
};
