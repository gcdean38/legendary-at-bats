export type PitchType = "FF" | "SI" | "SL" | "CH" | "CU" | "CT";

export type PitchDecision = "take" | "swing";

export type ZoneCoord = {
  /** 0 = glove-side / inside for RHH view left, 1 = arm-side */
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
  /** Short cue shown just before recognition */
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

export type LegendaryAtBat = {
  id: string;
  /** Short tag for share text, no names */
  codename: string;
  /** Approximate calendar year of the moment */
  year: number;
  series: string;
  gameLabel: string;
  inning: string;
  outs: number;
  scoreText: string;
  runners: string;
  batter: { team: string; number: number; bats: "L" | "R" | "S" };
  pitcher: { team: string; number: number; throws: "L" | "R" };
  situationBlurb: string;
  stakes: string;
  pitches: SeedPitch[];
  historical: {
    outcome: HistoricalOutcome;
    summary: string;
    /** True if the real batter came through in that moment */
    batterSucceeded: boolean;
  };
};

export type PitchResultGrade = {
  pitchId: string;
  recognizedType: PitchType | null;
  typeCorrect: boolean;
  decision: PitchDecision;
  decisionCorrect: boolean;
  swung: boolean;
  aim?: ZoneCoord;
  aimDistance?: number;
  timingMs?: number;
  timingScore: number;
  pitchScore: number;
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
};

export type GamePhase =
  | "loading"
  | "error"
  | "intro"
  | "situation"
  | "pitch_cue"
  | "pitch_recognize"
  | "pitch_decide"
  | "pitch_aim"
  | "pitch_feedback"
  | "result";
