/**
 * Follow-up batters for deep-hole legendary rewrites.
 * After the scripted AB, these teammates step up until the lead
 * flips or the third out is recorded.
 */
export type RewriteBatter = {
  name: string;
  number: number;
  bats: "L" | "R" | "S";
};

export const REWRITE_LINEUPS: Record<string, RewriteBatter[]> = {
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
