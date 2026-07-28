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

export function describeExerciseSummary(
  topThisSession: { weight_kg: number; reps: number },
  memory: ExerciseMemory | undefined,
  units: Units,
): string {
  const last = memory?.last_session;
  const best = memory?.best_session;

  const isNewBest =
    best != null &&
    (topThisSession.weight_kg > best.weight_kg ||
      (topThisSession.weight_kg === best.weight_kg && topThisSession.reps > best.reps));
  if (isNewBest) {
    return `New personal best: ${formatWeight(topThisSession.weight_kg, units, 1)} × ${topThisSession.reps}. That's the strongest you've ever done this.`;
  }

  if (!last) {
    return `That's your first time logging this — ${formatWeight(topThisSession.weight_kg, units, 1)} × ${topThisSession.reps} is your new baseline.`;
  }

  const weightDelta = Math.round((topThisSession.weight_kg - last.weight_kg) * 10) / 10;
  const repsDelta = topThisSession.reps - last.reps;

  if (weightDelta > 0.01 && repsDelta >= 0) {
    return `You added ${formatWeight(weightDelta, units, 1)} while keeping every rep. Real progress.`;
  }
  if (weightDelta > 0.01) {
    return `You added ${formatWeight(weightDelta, units, 1)} today, though reps dipped a little — a fair trade-off.`;
  }
  if (weightDelta < -0.01) {
    return `You backed off ${formatWeight(Math.abs(weightDelta), units, 1)} from last time — sometimes that's exactly the right call.`;
  }
  if (repsDelta > 0) {
    return `Same weight as last time, but ${repsDelta} more rep${repsDelta === 1 ? '' : 's'} on your top set. Solid progress.`;
  }
  if (repsDelta < 0) {
    return `You lost ${Math.abs(repsDelta)} rep${Math.abs(repsDelta) === 1 ? '' : 's'} on your top set at the same weight — recovery may be limiting performance today.`;
  }
  return "You matched last time's performance exactly.";
}

export function describeMemoryIntro(memory: ExerciseMemory | undefined, units: Units): string | null {
  if (!memory?.has_history || !memory.last_session) return null;
  const { last_session, days_since_last } = memory;
  const whenPhrase =
    days_since_last === 0
      ? 'earlier today'
      : days_since_last === 1
        ? 'yesterday'
        : days_since_last != null && days_since_last <= 10
          ? `${days_since_last} days ago`
          : 'a while back';
  const feelPhrase = last_session.feel === 'clean' ? ', and it looked clean' : '';
  return `Last time (${whenPhrase}) you did ${formatWeight(last_session.weight_kg, units, 1)} × ${last_session.reps} across ${last_session.sets} set${last_session.sets === 1 ? '' : 's'}${feelPhrase}.`;
}
