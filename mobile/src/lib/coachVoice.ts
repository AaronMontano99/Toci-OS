// Deterministic, explainable "coach reacted" lines -- the same philosophy as
// the backend's engine.py/coach.py (real numbers in, a plain sentence out,
// nothing fabricated). This is what makes the logging screen feel like a
// coach thinking out loud instead of a form silently accepting input.
import { ExerciseMemory, Feel } from '@/api/types';
import { formatWeight, Units } from '@/lib/units';

const PAIN_FEELS: Feel[] = ['pain'];
const ROUGH_FEELS: Feel[] = ['sloppy', 'partial', 'assisted'];

interface SetResult {
  weight_kg: number;
  reps: number;
  feel?: Feel | null;
}

export function describeSetReaction(current: SetResult, previous: SetResult | null, units: Units): string {
  if (current.feel && PAIN_FEELS.includes(current.feel)) {
    return "Noted the pain — let's not push through that. We'll adjust next time.";
  }

  if (!previous) {
    if (current.feel === 'clean') return 'Clean rep. Good start.';
    return 'Logged. Let’s see how the next one feels.';
  }

  const weightDelta = current.weight_kg - previous.weight_kg;
  const repsDelta = current.reps - previous.reps;

  if (current.feel && ROUGH_FEELS.includes(current.feel)) {
    return "That one felt rough — we'll hold steady rather than push further.";
  }

  if (weightDelta > 0.01) {
    return `+${formatWeight(weightDelta, units, 1)} from your last set — nice.`;
  }
  if (weightDelta < -0.01) {
    return `${formatWeight(Math.abs(weightDelta), units, 1)} lighter than your last set — smart if you're feeling it.`;
  }
  if (repsDelta > 0) {
    return `Same weight, ${repsDelta} more rep${repsDelta === 1 ? '' : 's'} than last set. Building.`;
  }
  if (repsDelta < 0) {
    return `${Math.abs(repsDelta)} fewer rep${Math.abs(repsDelta) === 1 ? '' : 's'} than your last set — still counts.`;
  }
  return 'Matched your last set exactly.';
}

export type ExerciseOutcome = 'pr' | 'improved' | 'matched' | 'regressed' | 'first_time';

interface ExercisePerformance {
  outcome: ExerciseOutcome;
  sentence: string;
}

// Single source of truth for "what happened this exercise, compared to
// history" -- both the per-exercise coach line (logging screen, Coach
// Review) and the whole-workout headline (Complete screen) read off the
// same classification so they can never disagree with each other.
export function evaluateExercisePerformance(
  topThisSession: { weight_kg: number; reps: number },
  memory: ExerciseMemory | undefined,
  units: Units,
): ExercisePerformance {
  const last = memory?.last_session;
  const best = memory?.best_session;

  const isNewBest =
    best != null &&
    (topThisSession.weight_kg > best.weight_kg ||
      (topThisSession.weight_kg === best.weight_kg && topThisSession.reps > best.reps));
  if (isNewBest) {
    return {
      outcome: 'pr',
      sentence: `New personal best: ${formatWeight(topThisSession.weight_kg, units)} × ${topThisSession.reps}. That's the strongest you've ever done this.`,
    };
  }

  if (!last) {
    return {
      outcome: 'first_time',
      sentence: `That's your first time logging this — ${formatWeight(topThisSession.weight_kg, units)} × ${topThisSession.reps} is your new baseline.`,
    };
  }

  const weightDelta = Math.round((topThisSession.weight_kg - last.weight_kg) * 10) / 10;
  const repsDelta = topThisSession.reps - last.reps;

  if (weightDelta > 0.01 && repsDelta >= 0) {
    return { outcome: 'improved', sentence: `You added ${formatWeight(weightDelta, units, 1)} while keeping every rep. Real progress.` };
  }
  if (weightDelta > 0.01) {
    return { outcome: 'improved', sentence: `You added ${formatWeight(weightDelta, units, 1)} today, though reps dipped a little — a fair trade-off.` };
  }
  if (weightDelta < -0.01) {
    return { outcome: 'regressed', sentence: `You backed off ${formatWeight(Math.abs(weightDelta), units, 1)} from last time — sometimes that's exactly the right call.` };
  }
  if (repsDelta > 0) {
    return { outcome: 'improved', sentence: `Same weight as last time, but ${repsDelta} more rep${repsDelta === 1 ? '' : 's'} on your top set. Solid progress.` };
  }
  if (repsDelta < 0) {
    return {
      outcome: 'regressed',
      sentence: `You lost ${Math.abs(repsDelta)} rep${Math.abs(repsDelta) === 1 ? '' : 's'} on your top set at the same weight — recovery may be limiting performance today.`,
    };
  }
  return { outcome: 'matched', sentence: "You matched last time's performance exactly." };
}

export function describeExerciseSummary(
  topThisSession: { weight_kg: number; reps: number },
  memory: ExerciseMemory | undefined,
  units: Units,
): string {
  return evaluateExercisePerformance(topThisSession, memory, units).sentence;
}

// The one-line takeaway for the whole workout -- Complete and Coach Review
// both open with this so the very first thing the user reads is the
// headline, not a stat block.
export function summarizeWorkoutHeadline(results: { name: string; outcome: ExerciseOutcome }[]): string {
  if (results.length === 0) return "Logged and in the books — nothing to compare yet.";

  const prs = results.filter((r) => r.outcome === 'pr');
  const improved = results.filter((r) => r.outcome === 'improved');
  const regressed = results.filter((r) => r.outcome === 'regressed');
  const firstTime = results.filter((r) => r.outcome === 'first_time');

  if (prs.length === 1) return `New personal best on ${prs[0].name} — that's the headline today.`;
  if (prs.length > 1) return `New personal bests on ${prs.length} lifts today. Strong session.`;
  if (firstTime.length === results.length) return "First time logging most of this — today becomes the baseline everything else builds from.";
  if (regressed.length > improved.length && regressed.length > 0) {
    const names = regressed.slice(0, 2).map((r) => r.name).join(' and ');
    return `${names} slipped a little today — recovery may be worth a look before the next session.`;
  }
  if (improved.length > 0) {
    const names = improved.slice(0, 2).map((r) => r.name).join(' and ');
    return improved.length > results.length / 2
      ? `Progress across ${improved.length} of ${results.length} exercises today — the plan is working.`
      : `Solid session — progress on ${names}${improved.length > 2 ? ' and more' : ''}.`;
  }
  return 'Matched last week across the board — steady, consistent work.';
}

// The forward-looking companion to describeMemoryIntro -- not "what happened
// last time" but "here's what I'd try today, and why." Read off the same
// memory the intro line uses (last session's reps-hit and feel), so it never
// invents a recommendation the app can't back up.
export function describeCoachNote(memory: ExerciseMemory | undefined, target: { reps: number; load_kg: number }, units: Units): string | null {
  if (!memory?.has_history || !memory.last_session) return null;
  const { last_session } = memory;

  const suggestion = `try ${formatWeight(target.load_kg, units)} for ${target.reps}`;

  if (last_session.feel === 'pain') {
    return `Last time this caused some discomfort. Let's ease back in — ${suggestion} and stop if anything feels off.`;
  }
  if (last_session.feel && ROUGH_FEELS.includes(last_session.feel)) {
    return `You got through it last time, but form slipped toward the end. ${suggestion.charAt(0).toUpperCase() + suggestion.slice(1)}, and focus on staying clean.`;
  }
  if (last_session.feel === 'clean') {
    return `You completed every set last time with good technique. If today's warm-ups feel smooth, ${suggestion}.`;
  }
  return `${suggestion.charAt(0).toUpperCase() + suggestion.slice(1)}, same as the plan for last time.`;
}
