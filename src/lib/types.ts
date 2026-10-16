export type PitchType = "FF" | "SI" | "SL" | "CH" | "CU" | "CT";

export type PitchDecision = "take" | "swing";

export type ZoneCoord = {
  /**
   * Full-plate coords (0–1 over the chase frame).
   * The drawn 3×3 strike zone is an inset — see `isInStrikeZone`.
   * x: 0 = glove-side left, 1 = arm-side right
   */
  x: number;
  /** 0 = high, 1 = low */
  y: number;
};

export type SeedPitch = {
  id: string;
  type: PitchType;
  /** MPH cue shown to the player */
  speedMph: number;
  location: ZoneCoord;
  inZone: boolean;
  /** What a smart batter should do in this spot */
  expectedDecision: PitchDecision;
  /** Short cue shown as the pitch starts */
  approachCue: string;
};

export type HistoricalOutcome =
  | "home_run"
  | "grand_slam"
  | "single"
  | "double"
  | "walk"
  | "strikeout"
  | "gidp"
  | "flyout"
  | "groundout"
  | "lineout";

/** How the player's session compares to the real moment */
export type HistoryVerdict =
  | "changed_history"
  | "matched_legend"
  | "history_held"
  | "fell_short";

export type ScoreSide = {
  /** Three-letter location abbr, e.g. ARI / TEX */
  abbr: string;
  runs: number;
};

export type CountState = {
  balls: number;
  strikes: number;
};

/** Occupied bases when the AB begins */
export type BasesState = {
  first: boolean;
  second: boolean;
  third: boolean;
};

export type LegendaryAtBat = {
  id: string;
  /** Display title: "Home City vs Away City" */
  codename: string;
  /** Calendar year of the moment */
  year: number;
  series: string;
  gameLabel: string;
  inning: string;
  /** Ballpark as [City] [Noun], e.g. Toronto Centre, Arlington Field */
  venue: string;
  /** Outs when the AB begins (score-bug O) */
  outs: number;
  away: ScoreSide;
  home: ScoreSide;
  bases: BasesState;
  /** Human label for situation copy */
  runners: string;
  /** City identity only — never real player names */
  batter: { team: string; number: number; bats: "L" | "R" | "S" };
  pitcher: { team: string; number: number; throws: "L" | "R" };
  situationBlurb: string;
  stakes: string;
  /**
   * Scripted pitch sequence for the legendary moment.
   * If the AB is still alive after these, later pitches are drawn from
   * the pitcher's arsenal (unique types here) with fresh locations.
   */
  pitches: SeedPitch[];
  historical: {
    outcome: HistoricalOutcome;
    summary: string;
    /** True if the real batter came through in that moment */
    batterSucceeded: boolean;
  };
};

export type ExitKind = "crush" | "line" | "ground" | "whiff" | "take";

export type PitchEvent = "ball" | "strike" | "foul" | "hit" | "out";

export type PlayResult =
  | "home_run"
  | "double"
  | "single"
  | "walk"
  | "sac_fly"
  | "fly_out"
  | "ground_out"
  | "double_play"
  | "line_out"
  | "strikeout"
  | "foul"
  | "ball"
  | "strike_looking"
  | "whiff";

export type AtBatEndReason =
  | "walk"
  | "strikeout"
  | "hit"
  | "out"
  | "max_pitches";

/** Situation-aware ending tone for the result screen */
export type EndingTone =
  | "won_game"
  | "took_lead"
  | "tied_game"
  | "scored_continue"
  | "pass_the_baton"
  | "failed_hope"
  | "failed_lost";

export type PitchResultGrade = {
  pitchId: string;
  /** Pitch type (FF, SL, …) for the sequence log */
  pitchType: PitchType;
  /** Release speed cue shown in the sequence log */
  speedMph: number;
  /** Count when this pitch was thrown (before the outcome) */
  countBefore: CountState;
  decision: PitchDecision;
  decisionCorrect: boolean;
  swung: boolean;
  aim?: ZoneCoord;
  aimDistance?: number;
  timingMs?: number;
  timingScore: number;
  pitchScore: number;
  exitKind: ExitKind;
  event: PitchEvent;
  play: PlayResult;
  launchDeg?: number;
  /** Stylized exit velo (mph) from contact quality */
  exitVeloMph?: number;
  contactQuality?: number;
};

export type AtBatSessionResult = {
  atBatId: string;
  dateKey: string;
  grades: PitchResultGrade[];
  totalScore: number;
  maxScore: number;
  stars: number;
  historyVerdict: HistoryVerdict;
  playerCameThrough: boolean;
  endReason: AtBatEndReason;
  finalCount: CountState;
  finalPlay: PlayResult;
  endingTone: EndingTone;
  endingTitle: string;
  endingBlurb: string;
  runsScored: number;
  /** Score bug after the play resolves */
  board: {
    away: ScoreSide;
    home: ScoreSide;
    bases: BasesState;
    outs: number;
    /** Count clears after the AB; kept for pitch-log context separately */
    count: CountState;
  };
};

export type GamePhase =
  | "loading"
  | "error"
  | "intro"
  | "catalog"
  | "situation"
  | "pitch_windup"
  | "pitch_live"
  | "pitch_result"
  | "rewrite_offer"
  | "result";
