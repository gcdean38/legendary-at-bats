/**
 * Actual calendar date of each legendary moment (local game date).
 * Used to schedule same-day dailies during the playoff window.
 */
export const HISTORIC_DATES: Record<string, string> = {
  // Pre-1980 icons
  "1975-ws6-boston-27": "1975-10-21", // Fisk WS G6 walk-off
  "1975-ws7-boston-8": "1975-10-22", // Yaz WS G7 final out
  "2005-ws1-houston-5": "2005-10-22", // Bagwell WS G1 K vs Jenks

  // 2020s
  "2025-alcs-toronto-4": "2025-10-20", // Springer ALCS G7
  "2025-ws7-toronto-30": "2025-11-01", // Kirk WS G7
  "2025-ws3-la-5-18": "2025-10-27", // Freeman 18-inning WS G3
  "2024-ws1-la-5": "2024-10-25", // Freeman WS G1 walk-off
  "2024-ws5-newyork-12": "2024-10-30", // Verdugo WS G5 final out
  "2024-alcs-cleveland-6": "2024-10-17", // Fry ALCS G3
  "2024-nlwc-newyork-20": "2024-10-03", // Alonso NLWC G3
  "2023-ws1-texas-53": "2023-10-27", // Adolis WS G1
  "2023-ws5-arizona-4": "2023-11-01", // Marte WS G5
  "2023-alcs-texas-5": "2023-10-15", // Seager ALCS G1
  "2022-ws6-philadelphia-3": "2022-11-05", // Harper WS G6
  "2022-ws5-castellanos": "2022-11-03", // Castellanos WS G5 final out
  "2022-alds-houston-44": "2022-10-11", // Alvarez ALDS G1
  "2021-ws6-houston-27": "2021-11-02", // Altuve WS G6
  "2021-alcs-boston-11": "2021-10-16", // Devers ALCS G2
  "2021-nlds-la-3": "2021-10-06", // Taylor NLWC
  "2021-alds-boston-7": "2021-10-10", // Hernández ALDS G3
  "2020-ws6-seager": "2020-10-27", // Seager WS G6

  // 2010s
  "2019-ws7-houston-4": "2019-10-30", // Brantley WS G7
  "2019-ws7-washington-47": "2019-10-30", // Kendrick WS G7
  "2019-alcs-houston-27": "2019-10-19", // Altuve ALCS G6
  "2019-nlds-washington-47": "2019-10-09", // Kendrick NLDS G5
  "2018-ws3-la-13": "2018-10-26", // Muncy WS G3
  "2018-ws4-pearce": "2018-10-27", // Pearce WS G4
  "2017-ws5-houston-2": "2017-10-29", // Bregman WS G5
  "2017-alcs7-newyork-99": "2017-10-21", // Judge ALCS G7
  "2016-ws7-cleveland-1": "2016-11-02", // Martinez WS G7
  "2016-ws7-chicago-18": "2016-11-02", // Zobrist WS G7
  "2016-ws7-davis": "2016-11-02", // Davis WS G7
  "2016-alwc-toronto-10": "2016-10-04", // Encarnación WC
  "2015-alds5-toronto-19": "2015-10-14", // Bautista ALDS G5
  "2014-nlcs5-ishikawa": "2014-10-16", // Ishikawa NLCS G5
  "2013-alcs2-boston-34": "2013-10-13", // Ortiz ALCS G2
  "2012-ws1-sandoval": "2012-10-24", // Sandoval WS G1
  "2011-ws6-stlouis-23": "2011-10-27", // Freese WS G6
  "2011-ws3-pujols": "2011-10-22", // Pujols WS G3
  "2010-ws5-renteria": "2010-11-01", // Rentería WS G5
  "2010-nlcs6-howard": "2010-10-23", // Howard NLCS G6 K looking vs Wilson

  // 2000s
  "2009-ws6-matsui": "2009-11-04", // Matsui WS G6
  "2006-nlcs7-stlouis-4": "2006-10-19", // Molina NLCS G7
  "2005-ws2-chicago-22": "2005-10-23", // Podsednik WS G2
  "2005-ws2-konerko": "2005-10-23", // Konerko WS G2
  "2005-alds2-pierzynski": "2005-10-05", // Pierzynski ALDS G2
  "2004-alcs4-boston-34": "2004-10-17", // Ortiz ALCS G4
  "2004-alcs5-ortiz": "2004-10-18", // Ortiz ALCS G5
  "2004-alcs7-damon": "2004-10-20", // Damon ALCS G7
  "2003-alcs7-newyork-17": "2003-10-16", // Boone ALCS G7
  "2003-nlcs6-chicago-8": "2003-10-14", // A. Gonzalez NLCS G6
  "2002-ws6-spiezio": "2002-10-26", // Spiezio WS G6
  "2001-ws7-arizona-20": "2001-11-04", // Gonzalez WS G7
  "2001-ws5-brosius": "2001-11-01", // Brosius WS G5
  "2001-ws4-newyork-2": "2001-10-31", // Jeter WS G4
  "2000-nlcs3-agbayani": "2000-10-14", // Agbayani NLCS G3

  // 1990s
  "1999-nlcs5-ventura": "1999-10-17", // Ventura NLCS G5
  "1997-ws7-renteria": "1997-10-26", // Rentería WS G7
  "1996-ws4-leyritz": "1996-10-23", // Leyritz WS G4
  "1995-ws6-justice": "1995-10-28", // Justice WS G6 clinching HR
  "1995-alds5-martinez": "1995-10-08", // Edgar ALDS G5
  "1993-ws6-carter": "1993-10-23", // Carter WS G6
  "1992-nlcs7-cabrera": "1992-10-14", // Cabrera NLCS G7
  "1991-ws6-puckett": "1991-10-26", // Puckett WS G6

  // 1980s
  "1988-ws1-gibson": "1988-10-15", // Gibson WS G1
  "1986-ws6-wilson": "1986-10-25", // Wilson WS G6
  "1986-alcs5-henderson": "1986-10-12", // Henderson ALCS G5
  "1985-nlcs5-smith": "1985-10-14", // Ozzie NLCS G5
  "1984-nlcs4-garvey": "1984-10-06", // Garvey NLCS G4
  "1981-nlcs5-monday": "1981-10-19", // Monday NLCS G5
};
