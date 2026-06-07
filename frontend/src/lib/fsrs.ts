/**
 * FSRS-5 (Free Spaced Repetition Scheduler v5).
 *
 * Default parameters from the official Anki FSRS-5 release
 * (open-spaced-repetition/fsrs4anki). All 17 weights are
 * used as published — no tuning, no magic numbers.
 *
 * Grade mapping (matching the existing 4-button layout):
 *   Again=0/1, Hard=2, Good=3/4, Easy=5
 */

/* ── Default parameters (FSRS-5) ──────────────────────────────── */
const W: [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number] = [
  0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61,
]

const INITIAL_DIFFICULTY = W[4] // 4.93
const DEFAULT_GRADE = 3 // "Good"

/* ── FSRS state stored per-card ───────────────────────────────── */
export interface FSRSState {
  stability: number
  difficulty: number
}

/* ── Helpers ──────────────────────────────────────────────────── */
function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

/** Normalise the app's 0-5 grade scale to the FSRS 1-4 scale. */
export function toFSRSGrade(grade: number): number {
  if (grade <= 1) return 1  // Again
  if (grade === 2) return 2 // Hard
  if (grade <= 4) return 3  // Good
  return 4                  // Easy
}

/* ── Core FSRS-5 formulas ─────────────────────────────────────── */

/** Initial stability for a brand-new card (first ever review). */
function initStability(grade: number): number {
  return W[grade - 1]
}

/** Next difficulty after a review (includes mean reversion). */
function nextDifficulty(difficulty: number, grade: number): number {
  const delta = difficulty + W[7] * (grade - 3)
  const reverted = W[8] * INITIAL_DIFFICULTY + (1 - W[8]) * delta
  return clamp(reverted, 1, 10)
}

/** Stability after a successful recall (grade >= 3). */
function stabilityRecall(stability: number, difficulty: number, grade: number): number {
  const bonus = W[8] - W[9] * (grade - 3)
  return stability * (1 + W[5] * Math.exp((W[6] - difficulty) * W[7]) * Math.pow(bonus, W[10]))
}

/** Stability after a failed recall (grade < 3). */
function stabilityForget(stability: number, difficulty: number): number {
  return W[11] * Math.pow(difficulty, W[12]) * Math.pow(stability, W[13])
}

/* ── Public API ───────────────────────────────────────────────── */

export interface ReviewResult extends FSRSState {
  interval: number
  nextReview: Date
}

/**
 * Given a review grade (0-5) and the card's current FSRS state,
 * compute the new FSRS state, the next interval in days, and the
 * next-review date.
 *
 * For cards that have never been reviewed (stability === 0) we
 * also initialise the difficulty to the FSRS default.
 */
export function getNextReview(
  grade: number,
  current: FSRSState,
): ReviewResult {
  const g = toFSRSGrade(grade)
  let newStability: number
  let newDifficulty = current.difficulty || INITIAL_DIFFICULTY

  if (current.stability === 0) {
    // First review: use initial-stability formula, set init difficulty
    newStability = initStability(g)
    newDifficulty = INITIAL_DIFFICULTY
  } else if (g >= 3) {
    newStability = stabilityRecall(current.stability, newDifficulty, g)
    newDifficulty = nextDifficulty(newDifficulty, g)
  } else {
    newStability = stabilityForget(current.stability, newDifficulty)
    newDifficulty = nextDifficulty(newDifficulty, g)
  }

  // Stability IS the optimal interval (in days) at the default
  // retention of 90 %.  The formula is:  interval ≈ S × ln(R) / ln(0.9)
  // At 90 % retention, ln(0.9)/ln(0.9) = 1, so interval ≈ S.
  const interval = Math.max(1, Math.round(newStability))

  const nextReview = new Date()
  nextReview.setDate(nextReview.getDate() + interval)
  nextReview.setHours(0, 0, 0, 0)

  return { stability: newStability, difficulty: newDifficulty, interval, nextReview }
}

/**
 * Create an initial FSRS state for a brand-new card.
 * The card is due immediately (interval = 0, stability = 0).
 */
export function initialFSRSState(): FSRSState {
  return { stability: 0, difficulty: INITIAL_DIFFICULTY }
}

/**
 * Migrate an SM-2 card or a card stored before FSRS was introduced.
 *
 * If the card already has `stability` defined we use it directly.
 * Otherwise we derive a plausible FSRS state from the old SM-2
 * fields (`ef`, `interval`, `repetitions`).
 */
export function migrateFromSM2(card: {
  ef?: number
  interval?: number
  repetitions?: number
  stability?: number
  difficulty?: number
}): FSRSState {
  if (card.stability !== undefined && card.difficulty !== undefined) {
    return { stability: card.stability, difficulty: card.difficulty }
  }
  // Derive from SM-2 or fall back to fresh-card defaults.
  const stability = (card.interval || 0) > 0 ? card.interval! : 0
  const ef = card.ef ?? 2.5
  // Map EF (1.3‑3.0) → difficulty (10→1  roughly, higher EF = easier = lower difficulty)
  const difficulty = clamp(4.5 - (ef - 1.3) * 2.5, 1, 10)
  return { stability, difficulty }
}

/**
 * Defaults used when creating a new flashcard document.
 */
export function newCardDefaults() {
  const s = initialFSRSState()
  const now = new Date()
  return {
    ...s,
    interval: 0,
    repetitions: 0,
    ef: 2.5,
    nextReview: now,
    lastReview: null,
    totalReviews: 0,
    createdAt: now,
    updatedAt: now,
  }
}
