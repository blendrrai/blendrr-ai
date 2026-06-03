// Glow Score — daily-routine gamification layer for BLENDRR Ai.
//
// Model:
//   • TASKS — checkable habits, each worth N points. Eight default tasks ship
//     with the app; users can add/remove/customise any of them.
//   • DAILY SCORE — sum of points from tasks ticked off TODAY (resets at
//     local midnight). Default tasks total ~100 pts so "above 90" is
//     achievable but not trivial.
//   • STREAK — consecutive days the user has ticked off at least one task,
//     counted up to and including today (or yesterday if today is fresh).
//   • ACHIEVEMENTS — 30 lifetime unlocks across try-ons, daily tasks,
//     streaks, quizzes, and misc. Each carries bonus points (currently
//     informational, not added to daily score).
//
// All state lives in AsyncStorage under `blendrr.glow.v1` — no server sync.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadHistory, loadWishlist, loadAnalyses } from './storage';
import { getCachedUser } from './user';

const STORAGE_KEY = 'blendrr.glow.v1';

// ============================================================================
// Types
// ============================================================================

export type GlowTask = {
  id: string;
  label: string;
  points: number;
  isDefault: boolean;
};

export type GlowDay = {
  /** ISO date string YYYY-MM-DD in the user's local timezone. */
  date: string;
  completedTaskIds: string[];
  /** Cached score for the day to avoid recomputing when tasks change. */
  score: number;
};

export type UnlockedAchievement = {
  id: AchievementId;
  unlockedAt: number;
};

export type GlowState = {
  tasks: GlowTask[];
  /** Sorted descending by date, capped at 365 entries. */
  history: GlowDay[];
  achievements: UnlockedAchievement[];
  streakLongest: number;
};

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_TASKS: GlowTask[] = [
  { id: 'water-2l', label: 'Drink 2L of water', points: 15, isDefault: true },
  { id: 'moisturise-am', label: 'Moisturise in the morning', points: 10, isDefault: true },
  { id: 'cleanse-pm', label: 'Cleanse your face at night', points: 10, isDefault: true },
  { id: 'spf', label: 'Apply SPF', points: 15, isDefault: true },
  { id: 'sleep-8h', label: 'Get 8 hours of sleep', points: 15, isDefault: true },
  { id: 'fruit-veg', label: 'Eat 5 servings of fruit / veg', points: 10, isDefault: true },
  { id: 'movement-30', label: '30 minutes of movement', points: 15, isDefault: true },
  { id: 'vitamins', label: 'Take your vitamins', points: 10, isDefault: true },
];

const DEFAULT_STATE: GlowState = {
  tasks: DEFAULT_TASKS,
  history: [],
  achievements: [],
  streakLongest: 0,
};

// ============================================================================
// Achievement catalog (30 total)
// ============================================================================

export type AchievementId =
  | 'first-tryon' | 'shade-five' | 'tryon-ten' | 'tryon-fifty' | 'tryon-hundred'
  | 'first-tick' | 'glow-50' | 'glow-90' | 'glow-100' | 'glow-90-seven'
  | 'streak-1' | 'streak-3' | 'streak-7' | 'streak-14' | 'streak-30' | 'streak-100'
  | 'quiz-skin' | 'quiz-hair' | 'quiz-fragrance' | 'quiz-acne' | 'quiz-all'
  | 'wishlist-first' | 'wishlist-ten' | 'scan-first' | 'scan-five'
  | 'task-custom' | 'task-ten-active' | 'pro-upgrade' | 'share-code' | 'all-star';

export type AchievementCategory = 'try-on' | 'glow' | 'streak' | 'routine' | 'misc';

export type Achievement = {
  id: AchievementId;
  title: string;
  desc: string;
  category: AchievementCategory;
  bonusPoints: number;
};

export const ACHIEVEMENTS: Achievement[] = [
  // Try-on (5)
  { id: 'first-tryon',   title: 'First Try-On',    desc: 'Complete your first try-on.',                         category: 'try-on', bonusPoints: 10 },
  { id: 'shade-five',    title: 'Shade Explorer',  desc: 'Try on 5 different products.',                        category: 'try-on', bonusPoints: 15 },
  { id: 'tryon-ten',     title: 'Look Architect',  desc: 'Complete 10 try-ons.',                                category: 'try-on', bonusPoints: 25 },
  { id: 'tryon-fifty',   title: 'Beauty Devotee',  desc: 'Complete 50 try-ons.',                                category: 'try-on', bonusPoints: 50 },
  { id: 'tryon-hundred', title: 'Try-On Master',   desc: 'Complete 100 try-ons.',                               category: 'try-on', bonusPoints: 100 },
  // Glow Score (5)
  { id: 'first-tick',    title: 'First Tick',      desc: 'Complete your first daily task.',                     category: 'glow',   bonusPoints: 5 },
  { id: 'glow-50',       title: 'Daily Glow',      desc: 'Reach a Glow Score of 50 in one day.',                category: 'glow',   bonusPoints: 15 },
  { id: 'glow-90',       title: 'Peak Glow',       desc: 'Reach a Glow Score of 90 in one day.',                category: 'glow',   bonusPoints: 25 },
  { id: 'glow-100',      title: 'Maximum Glow',    desc: 'Reach a Glow Score of 100 in one day.',               category: 'glow',   bonusPoints: 50 },
  { id: 'glow-90-seven', title: 'Consistent Glow', desc: 'Keep your Glow Score above 90 for 7 days in a row.', category: 'glow',   bonusPoints: 75 },
  // Streak (6)
  { id: 'streak-1',      title: 'Day One',           desc: 'Tick a task on your first day.',     category: 'streak', bonusPoints: 5 },
  { id: 'streak-3',      title: "Three's Company",   desc: 'Build a 3-day streak.',              category: 'streak', bonusPoints: 10 },
  { id: 'streak-7',      title: 'Week Warrior',      desc: 'Build a 7-day streak.',              category: 'streak', bonusPoints: 25 },
  { id: 'streak-14',     title: 'Fortnight Fierce',  desc: 'Build a 14-day streak.',             category: 'streak', bonusPoints: 50 },
  { id: 'streak-30',     title: 'Monthly Hero',      desc: 'Build a 30-day streak.',             category: 'streak', bonusPoints: 100 },
  { id: 'streak-100',    title: 'Century Streak',    desc: 'Build a 100-day streak.',            category: 'streak', bonusPoints: 250 },
  // Routine (5)
  { id: 'quiz-skin',      title: 'Skincare Smart',  desc: 'Complete a skincare quiz.',       category: 'routine', bonusPoints: 15 },
  { id: 'quiz-hair',      title: 'Haircare Hero',   desc: 'Complete a haircare quiz.',       category: 'routine', bonusPoints: 15 },
  { id: 'quiz-fragrance', title: 'Fragrance Finder',desc: 'Complete a fragrance quiz.',      category: 'routine', bonusPoints: 15 },
  { id: 'quiz-acne',      title: 'Acne Action',     desc: 'Complete an acne plan.',          category: 'routine', bonusPoints: 15 },
  { id: 'quiz-all',       title: 'Full Routine',    desc: 'Complete all four quizzes.',      category: 'routine', bonusPoints: 50 },
  // Misc (9)
  { id: 'wishlist-first', title: 'Wishlist Started',  desc: 'Save your first wishlist item.',           category: 'misc', bonusPoints: 5 },
  { id: 'wishlist-ten',   title: 'Curator',           desc: 'Save 10 wishlist items.',                  category: 'misc', bonusPoints: 20 },
  { id: 'scan-first',     title: 'Ingredient Insider',desc: 'Run your first ingredient scan.',          category: 'misc', bonusPoints: 10 },
  { id: 'scan-five',      title: 'Scan Specialist',   desc: 'Run 5 ingredient scans.',                  category: 'misc', bonusPoints: 20 },
  { id: 'task-custom',    title: 'Make It Yours',     desc: 'Add a custom task to Glow Score.',         category: 'misc', bonusPoints: 10 },
  { id: 'task-ten-active',title: 'Routine Builder',   desc: 'Maintain 10 active daily tasks.',          category: 'misc', bonusPoints: 15 },
  { id: 'pro-upgrade',    title: 'Glow Pro',          desc: 'Upgrade to Blendrr Pro.',                  category: 'misc', bonusPoints: 25 },
  { id: 'share-code',     title: 'Friend Sharer',     desc: 'Share your referral code.',                category: 'misc', bonusPoints: 10 },
  { id: 'all-star',       title: 'All-Star',          desc: 'Unlock 20 other achievements.',            category: 'misc', bonusPoints: 200 },
];

// ============================================================================
// Date helpers
// ============================================================================

/** YYYY-MM-DD in the user's local timezone. */
export function toLocalDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta);
  return toLocalDateStr(date);
}

// ============================================================================
// Storage
// ============================================================================

let cached: GlowState | null = null;
const listeners = new Set<(s: GlowState) => void>();

function notify() {
  if (!cached) return;
  const snapshot = cached;
  listeners.forEach((cb) => {
    try { cb(snapshot); } catch { /* ignore */ }
  });
}

/** Subscribe to state changes. Returns an unsubscribe function. */
export function subscribeGlow(cb: (s: GlowState) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function loadGlow(): Promise<GlowState> {
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GlowState>;
      cached = {
        tasks: Array.isArray(parsed.tasks) && parsed.tasks.length > 0 ? parsed.tasks : DEFAULT_TASKS,
        history: Array.isArray(parsed.history) ? parsed.history : [],
        achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
        streakLongest: typeof parsed.streakLongest === 'number' ? parsed.streakLongest : 0,
      };
      return cached;
    }
  } catch {
    // fall through to default
  }
  cached = DEFAULT_STATE;
  return cached;
}

async function persist(): Promise<void> {
  if (!cached) return;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  notify();
}

export function getCachedGlow(): GlowState {
  return cached ?? DEFAULT_STATE;
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Build a brand-new state object after mutation and swap the cache to it.
 * React's setState bails out when called with the same reference, so every
 * mutator MUST produce a fresh top-level object plus fresh arrays/objects
 * for anything we changed — otherwise the screens won't re-render.
 */
function commit(next: GlowState): GlowState {
  const withStreak: GlowState = {
    ...next,
    streakLongest: Math.max(next.streakLongest, getCurrentStreak(next)),
  };
  cached = withStreak;
  return withStreak;
}

export async function tickTask(taskId: string, date: string = toLocalDateStr()): Promise<GlowState> {
  const prev = await loadGlow();
  const task = prev.tasks.find((t) => t.id === taskId);
  if (!task) return prev;

  const existing = prev.history.find((d) => d.date === date);
  let history: GlowDay[];
  if (existing) {
    if (existing.completedTaskIds.includes(taskId)) return prev; // already ticked
    const completedTaskIds = [...existing.completedTaskIds, taskId];
    const updated: GlowDay = {
      ...existing,
      completedTaskIds,
      score: recomputeScore(prev.tasks, completedTaskIds),
    };
    history = prev.history.map((d) => (d.date === date ? updated : d));
  } else {
    history = [
      { date, completedTaskIds: [taskId], score: task.points },
      ...prev.history,
    ].slice(0, 365);
  }
  const next = commit({ ...prev, history });
  await persist();
  await checkAchievements();
  return next;
}

export async function untickTask(taskId: string, date: string = toLocalDateStr()): Promise<GlowState> {
  const prev = await loadGlow();
  const day = prev.history.find((d) => d.date === date);
  if (!day) return prev;
  const completedTaskIds = day.completedTaskIds.filter((id) => id !== taskId);
  let history: GlowDay[];
  if (completedTaskIds.length === 0) {
    // Drop the day entry so it doesn't break streaks.
    history = prev.history.filter((d) => d.date !== date);
  } else {
    const updated: GlowDay = {
      ...day,
      completedTaskIds,
      score: recomputeScore(prev.tasks, completedTaskIds),
    };
    history = prev.history.map((d) => (d.date === date ? updated : d));
  }
  const next = commit({ ...prev, history });
  await persist();
  return next;
}

export async function addCustomTask(label: string, points: number): Promise<GlowState> {
  const prev = await loadGlow();
  const trimmed = label.trim();
  if (!trimmed) return prev;
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const tasks = [
    ...prev.tasks,
    { id, label: trimmed, points: clampPoints(points), isDefault: false },
  ];
  const next = commit({ ...prev, tasks });
  await persist();
  await checkAchievements();
  return next;
}

export async function removeTask(taskId: string): Promise<GlowState> {
  const prev = await loadGlow();
  const tasks = prev.tasks.filter((t) => t.id !== taskId);
  // Strip the task from history and recompute each day's score.
  const history = prev.history
    .map((d) => {
      const completedTaskIds = d.completedTaskIds.filter((id) => id !== taskId);
      return {
        ...d,
        completedTaskIds,
        score: recomputeScore(tasks, completedTaskIds),
      };
    })
    .filter((d) => d.completedTaskIds.length > 0);
  const next = commit({ ...prev, tasks, history });
  await persist();
  return next;
}

function clampPoints(p: number): number {
  if (Number.isNaN(p)) return 10;
  return Math.max(1, Math.min(50, Math.round(p)));
}

function recomputeScore(tasks: GlowTask[], completedIds: string[]): number {
  const lookup = new Map(tasks.map((t) => [t.id, t.points]));
  return completedIds.reduce((sum, id) => sum + (lookup.get(id) ?? 0), 0);
}

// ============================================================================
// Derived values
// ============================================================================

export function getTodayScore(state: GlowState = getCachedGlow()): number {
  const today = toLocalDateStr();
  return state.history.find((d) => d.date === today)?.score ?? 0;
}

export function getTodayMaxScore(state: GlowState = getCachedGlow()): number {
  return state.tasks.reduce((sum, t) => sum + t.points, 0);
}

export function getTodayCompletedIds(state: GlowState = getCachedGlow()): string[] {
  const today = toLocalDateStr();
  return state.history.find((d) => d.date === today)?.completedTaskIds ?? [];
}

/** Current streak ending today or yesterday. 0 if neither day has activity. */
export function getCurrentStreak(state: GlowState = getCachedGlow()): number {
  const today = toLocalDateStr();
  const yesterday = addDays(today, -1);
  const dates = new Set(state.history.filter((d) => d.completedTaskIds.length > 0).map((d) => d.date));
  // Streak ends today if today has activity, otherwise yesterday. If neither, 0.
  let cursor: string;
  if (dates.has(today)) cursor = today;
  else if (dates.has(yesterday)) cursor = yesterday;
  else return 0;
  let count = 0;
  while (dates.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}


/** Number of consecutive days (ending today or yesterday) with score >= threshold. */
export function consecutiveDaysAtOrAbove(threshold: number, state: GlowState = getCachedGlow()): number {
  const today = toLocalDateStr();
  const byDate = new Map(state.history.map((d) => [d.date, d.score]));
  let cursor = today;
  // Allow today to be in-progress: only count it if it's already >= threshold.
  if ((byDate.get(cursor) ?? 0) < threshold) cursor = addDays(cursor, -1);
  let count = 0;
  while ((byDate.get(cursor) ?? 0) >= threshold) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

// ============================================================================
// Achievements
// ============================================================================

type AchievementContext = {
  state: GlowState;
  tryOnCount: number;
  uniqueProductsTriedOn: number;
  skincareDone: boolean;
  haircareDone: boolean;
  fragranceDone: boolean;
  acneDone: boolean;
  wishlistCount: number;
  scanCount: number;
  isPro: boolean;
  currentStreak: number;
  todayScore: number;
  unlockedCount: number;
};

function check(id: AchievementId, ctx: AchievementContext): boolean {
  switch (id) {
    case 'first-tryon':    return ctx.tryOnCount >= 1;
    case 'shade-five':     return ctx.uniqueProductsTriedOn >= 5;
    case 'tryon-ten':      return ctx.tryOnCount >= 10;
    case 'tryon-fifty':    return ctx.tryOnCount >= 50;
    case 'tryon-hundred':  return ctx.tryOnCount >= 100;
    case 'first-tick':     return getTodayCompletedIds(ctx.state).length >= 1 || ctx.state.history.length > 0;
    case 'glow-50':        return ctx.todayScore >= 50 || ctx.state.history.some((d) => d.score >= 50);
    case 'glow-90':        return ctx.todayScore >= 90 || ctx.state.history.some((d) => d.score >= 90);
    case 'glow-100':       return ctx.todayScore >= 100 || ctx.state.history.some((d) => d.score >= 100);
    case 'glow-90-seven':  return consecutiveDaysAtOrAbove(90, ctx.state) >= 7;
    case 'streak-1':       return ctx.currentStreak >= 1 || ctx.state.streakLongest >= 1;
    case 'streak-3':       return ctx.currentStreak >= 3 || ctx.state.streakLongest >= 3;
    case 'streak-7':       return ctx.currentStreak >= 7 || ctx.state.streakLongest >= 7;
    case 'streak-14':      return ctx.currentStreak >= 14 || ctx.state.streakLongest >= 14;
    case 'streak-30':      return ctx.currentStreak >= 30 || ctx.state.streakLongest >= 30;
    case 'streak-100':     return ctx.currentStreak >= 100 || ctx.state.streakLongest >= 100;
    case 'quiz-skin':      return ctx.skincareDone;
    case 'quiz-hair':      return ctx.haircareDone;
    case 'quiz-fragrance': return ctx.fragranceDone;
    case 'quiz-acne':      return ctx.acneDone;
    case 'quiz-all':       return ctx.skincareDone && ctx.haircareDone && ctx.fragranceDone && ctx.acneDone;
    case 'wishlist-first': return ctx.wishlistCount >= 1;
    case 'wishlist-ten':   return ctx.wishlistCount >= 10;
    case 'scan-first':     return ctx.scanCount >= 1;
    case 'scan-five':      return ctx.scanCount >= 5;
    case 'task-custom':    return ctx.state.tasks.some((t) => !t.isDefault);
    case 'task-ten-active':return ctx.state.tasks.length >= 10;
    case 'pro-upgrade':    return ctx.isPro;
    case 'share-code':     return false; // unlocked manually when user shares
    case 'all-star':       return ctx.unlockedCount >= 20;
  }
}

/**
 * Recompute the unlocked set from current app state. Call after any event
 * that could unlock a new achievement (try-on complete, quiz done, etc.).
 * Returns the list of newly-unlocked achievements (for "toast" UI later).
 */
export async function checkAchievements(): Promise<Achievement[]> {
  const prev = await loadGlow();
  const ctx = await buildContext(prev);
  const unlocked = new Set(prev.achievements.map((a) => a.id));
  const newly: Achievement[] = [];
  const additions: UnlockedAchievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (unlocked.has(a.id)) continue;
    if (check(a.id, { ...ctx, unlockedCount: unlocked.size + newly.length })) {
      additions.push({ id: a.id, unlockedAt: Date.now() });
      newly.push(a);
    }
  }
  if (additions.length > 0) {
    commit({ ...prev, achievements: [...prev.achievements, ...additions] });
    await persist();
  }
  return newly;
}

/** Manually unlock — used for events that aren't visible to check() like sharing. */
export async function unlockAchievement(id: AchievementId): Promise<Achievement | null> {
  const prev = await loadGlow();
  if (prev.achievements.some((a) => a.id === id)) return null;
  commit({
    ...prev,
    achievements: [...prev.achievements, { id, unlockedAt: Date.now() }],
  });
  await persist();
  return ACHIEVEMENTS.find((a) => a.id === id) ?? null;
}

async function buildContext(state: GlowState): Promise<Omit<AchievementContext, 'unlockedCount'>> {
  const [tryons, wishlist, analyses] = await Promise.all([
    loadHistory(),
    loadWishlist(),
    loadAnalyses(),
  ]);
  const uniqueProductsTriedOn = new Set(
    tryons.flatMap((t) => t.productUris ?? [t.productUri]).filter(Boolean),
  ).size;
  const user = getCachedUser();
  return {
    state,
    tryOnCount: tryons.length,
    uniqueProductsTriedOn,
    skincareDone: analyses.some((a) => a.category === 'skincare'),
    haircareDone: analyses.some((a) => a.category === 'haircare'),
    fragranceDone: analyses.some((a) => a.category === 'fragrance'),
    acneDone: analyses.some((a) => a.category === 'acne'),
    wishlistCount: wishlist.length,
    scanCount: analyses.filter((a) => a.category === 'ingredients').length,
    isPro: user?.tier === 'pro',
    currentStreak: getCurrentStreak(state),
    todayScore: getTodayScore(state),
  };
}

export function getUnlockedAchievements(state: GlowState = getCachedGlow()): Achievement[] {
  const set = new Set(state.achievements.map((a) => a.id));
  return ACHIEVEMENTS.filter((a) => set.has(a.id));
}

export function isUnlocked(id: AchievementId, state: GlowState = getCachedGlow()): boolean {
  return state.achievements.some((a) => a.id === id);
}
