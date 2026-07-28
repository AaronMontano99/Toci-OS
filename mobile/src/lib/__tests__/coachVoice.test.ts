import { ExerciseMemory } from '@/api/types';
import {
  describeCoachNote,
  describeExerciseSummary,
  describeSetReaction,
  evaluateExercisePerformance,
  summarizeWorkoutHeadline,
} from '@/lib/coachVoice';

const memoryWith = (overrides: Partial<NonNullable<ExerciseMemory['last_session']>>, best?: ExerciseMemory['best_session']): ExerciseMemory => ({
  has_history: true,
  sessions_logged: 3,
  days_since_last: 7,
  last_session: { date: '2026-07-21', weight_kg: 90, reps: 5, sets: 3, feel: 'clean', rir: 2, ...overrides },
  best_session: best ?? { date: '2026-07-21', weight_kg: 90, reps: 5 },
});

const NO_HISTORY: ExerciseMemory = { has_history: false, last_session: null, best_session: null, sessions_logged: 0, days_since_last: null };

describe('describeSetReaction', () => {
  it('flags pain regardless of the numbers', () => {
    const text = describeSetReaction({ weight_kg: 100, reps: 5, feel: 'pain' }, { weight_kg: 90, reps: 5 }, 'metric');
    expect(text).toMatch(/pain/i);
  });

  it('calls out an increase from the previous set', () => {
    const text = describeSetReaction({ weight_kg: 92.5, reps: 5 }, { weight_kg: 90, reps: 5 }, 'metric');
    expect(text).toMatch(/from your last set/i);
  });

  it('calls out a decrease from the previous set', () => {
    const text = describeSetReaction({ weight_kg: 87.5, reps: 5 }, { weight_kg: 90, reps: 5 }, 'metric');
    expect(text).toMatch(/lighter/i);
  });

  it('recognizes more reps at the same weight as building', () => {
    const text = describeSetReaction({ weight_kg: 90, reps: 6 }, { weight_kg: 90, reps: 5 }, 'metric');
    expect(text).toMatch(/more rep/i);
  });

  it('has no complaint about an exact match', () => {
    expect(describeSetReaction({ weight_kg: 90, reps: 5 }, { weight_kg: 90, reps: 5 }, 'metric')).toBe('Matched your last set exactly.');
  });

  it('handles a first set with no previous set to compare against', () => {
    const text = describeSetReaction({ weight_kg: 90, reps: 5 }, null, 'metric');
    expect(text).not.toMatch(/undefined|NaN/);
  });
});

describe('evaluateExercisePerformance', () => {
  it('recognizes a new personal best over the recorded best', () => {
    const result = evaluateExercisePerformance({ weight_kg: 100, reps: 5 }, memoryWith({}, { date: '2026-07-01', weight_kg: 90, reps: 5 }), 'metric');
    expect(result.outcome).toBe('pr');
  });

  it('does not call a repeat of the existing best a new PR', () => {
    // topThisSession equals best_session exactly -- must not be ">" a tie.
    const result = evaluateExercisePerformance({ weight_kg: 90, reps: 5 }, memoryWith({}, { date: '2026-07-01', weight_kg: 90, reps: 5 }), 'metric');
    expect(result.outcome).not.toBe('pr');
  });

  it('treats no history at all as first_time', () => {
    expect(evaluateExercisePerformance({ weight_kg: 90, reps: 5 }, NO_HISTORY, 'metric').outcome).toBe('first_time');
  });

  it('treats undefined memory the same as no history', () => {
    expect(evaluateExercisePerformance({ weight_kg: 90, reps: 5 }, undefined, 'metric').outcome).toBe('first_time');
  });

  it('recognizes more weight with the same or better reps as improved', () => {
    const memory = memoryWith({ weight_kg: 90, reps: 5 }, { date: '2026-07-01', weight_kg: 110, reps: 5 });
    expect(evaluateExercisePerformance({ weight_kg: 92.5, reps: 5 }, memory, 'metric').outcome).toBe('improved');
  });

  it('recognizes less weight than last time as regressed', () => {
    const memory = memoryWith({ weight_kg: 90, reps: 5 }, { date: '2026-07-01', weight_kg: 110, reps: 5 });
    expect(evaluateExercisePerformance({ weight_kg: 85, reps: 5 }, memory, 'metric').outcome).toBe('regressed');
  });

  it('recognizes fewer reps at the same weight as regressed', () => {
    const memory = memoryWith({ weight_kg: 90, reps: 5 }, { date: '2026-07-01', weight_kg: 110, reps: 8 });
    expect(evaluateExercisePerformance({ weight_kg: 90, reps: 3 }, memory, 'metric').outcome).toBe('regressed');
  });

  it('recognizes an exact repeat as matched', () => {
    const memory = memoryWith({ weight_kg: 90, reps: 5 }, { date: '2026-07-01', weight_kg: 110, reps: 8 });
    expect(evaluateExercisePerformance({ weight_kg: 90, reps: 5 }, memory, 'metric').outcome).toBe('matched');
  });

  it('describeExerciseSummary returns just the sentence half of the same result', () => {
    const memory = memoryWith({ weight_kg: 90, reps: 5 }, { date: '2026-07-01', weight_kg: 110, reps: 8 });
    const full = evaluateExercisePerformance({ weight_kg: 90, reps: 5 }, memory, 'metric');
    expect(describeExerciseSummary({ weight_kg: 90, reps: 5 }, memory, 'metric')).toBe(full.sentence);
  });
});

describe('summarizeWorkoutHeadline', () => {
  it('leads with a single PR by name', () => {
    const headline = summarizeWorkoutHeadline([
      { name: 'Back Squat', outcome: 'pr' },
      { name: 'Bench Press', outcome: 'matched' },
    ]);
    expect(headline).toContain('Back Squat');
  });

  it('leads with a PR count when there are several', () => {
    const headline = summarizeWorkoutHeadline([
      { name: 'Back Squat', outcome: 'pr' },
      { name: 'Bench Press', outcome: 'pr' },
    ]);
    expect(headline).toMatch(/2 lifts/);
  });

  it('calls out an all-first-time session as a baseline', () => {
    const headline = summarizeWorkoutHeadline([
      { name: 'Back Squat', outcome: 'first_time' },
      { name: 'Bench Press', outcome: 'first_time' },
    ]);
    expect(headline).toMatch(/baseline/i);
  });

  it('flags regression when more lifts slipped than improved', () => {
    const headline = summarizeWorkoutHeadline([
      { name: 'Back Squat', outcome: 'regressed' },
      { name: 'Bench Press', outcome: 'regressed' },
      { name: 'Deadlift', outcome: 'improved' },
    ]);
    expect(headline).toMatch(/recovery/i);
  });

  it('handles an empty workout without throwing', () => {
    expect(() => summarizeWorkoutHeadline([])).not.toThrow();
  });
});

describe('describeCoachNote', () => {
  const target = { reps: 5, load_kg: 92.5 };

  it('returns null with no history', () => {
    expect(describeCoachNote(NO_HISTORY, target, 'metric')).toBeNull();
  });

  it('returns null when memory is undefined', () => {
    expect(describeCoachNote(undefined, target, 'metric')).toBeNull();
  });

  it('leads with discomfort when last session recorded pain', () => {
    const note = describeCoachNote(memoryWith({ feel: 'pain' }), target, 'metric');
    expect(note).toMatch(/discomfort/i);
  });

  it('calls out technique praise when last session was clean', () => {
    const note = describeCoachNote(memoryWith({ feel: 'clean' }), target, 'metric');
    expect(note).toMatch(/good technique/i);
  });

  it('warns about form when last session was rough', () => {
    const note = describeCoachNote(memoryWith({ feel: 'sloppy' }), target, 'metric');
    expect(note).toMatch(/form slipped/i);
  });
});
