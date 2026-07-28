import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { ExerciseMemory, PrescriptionExercise } from '@/api/types';
import { ActiveExerciseCard } from '@/features/workout/ActiveExerciseCard';
import { ThemeProvider } from '@/theme/ThemeContext';

const EXERCISE: PrescriptionExercise = {
  exercise_id: 1,
  name: 'Back Squat',
  sets: 3,
  reps: 5,
  load_kg: 92.5,
  target_rir: 2,
};

const HISTORY: ExerciseMemory = {
  has_history: true,
  sessions_logged: 4,
  days_since_last: 7,
  last_session: { date: '2026-07-21', weight_kg: 90, reps: 5, sets: 4, feel: 'clean', rir: 2 },
  best_session: { date: '2026-07-21', weight_kg: 90, reps: 5 },
};

const NO_HISTORY: ExerciseMemory = { has_history: false, last_session: null, best_session: null, sessions_logged: 0, days_since_last: null };

function renderCard(props: Partial<React.ComponentProps<typeof ActiveExerciseCard>> = {}) {
  const onLogSet = jest.fn();
  const onUpdateSet = jest.fn();
  const onDeleteSet = jest.fn();
  render(
    <ThemeProvider>
      <ActiveExerciseCard
        exercise={EXERCISE}
        loggedSets={[]}
        units="metric"
        logging={false}
        onLogSet={onLogSet}
        onUpdateSet={onUpdateSet}
        onDeleteSet={onDeleteSet}
        {...props}
      />
    </ThemeProvider>,
  );
  return { onLogSet, onUpdateSet, onDeleteSet };
}

describe('ActiveExerciseCard', () => {
  it('shows Last/Best stats and a coach note when history exists', () => {
    renderCard({ memory: HISTORY });
    expect(screen.getByText(/Last: 90 kg × 5/)).toBeTruthy();
    expect(screen.getByText(/Best: 90 kg × 5/)).toBeTruthy();
    expect(screen.getByText(/good technique/i)).toBeTruthy();
  });

  it('falls back to a baseline message with no history', () => {
    renderCard({ memory: NO_HISTORY });
    expect(screen.getByText(/first time logging this one/i)).toBeTruthy();
    expect(screen.queryByText(/Last:/)).toBeNull();
  });

  it('prefers the backend-provided reasoning over the memory-derived note when both exist', () => {
    renderCard({ memory: HISTORY, exercise: { ...EXERCISE, why: 'Progressing +2.5kg from last session.' } });
    expect(screen.getByText('Progressing +2.5kg from last session.')).toBeTruthy();
    expect(screen.queryByText(/good technique/i)).toBeNull();
  });

  it('logs a set with the suggested weight and reps by default', () => {
    const { onLogSet } = renderCard();
    fireEvent.press(screen.getByText('Log it'));
    expect(onLogSet).toHaveBeenCalledWith(
      expect.objectContaining({ set_index: 1, actual_reps: 5, actual_load_kg: 92.5 }),
    );
  });

  it('carries forward the last logged set as the next suggestion, not the static prescription', () => {
    renderCard({ loggedSets: [{ id: 1, set_number: 1, weight_kg: 95, reps: 6, rest_seconds: null, feel: null }] });
    expect(screen.getByText('95')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
  });

  it('shows a completion summary once every set is logged', () => {
    renderCard({
      loggedSets: [
        { id: 1, set_number: 1, weight_kg: 95, reps: 5, rest_seconds: null, feel: null },
        { id: 2, set_number: 2, weight_kg: 95, reps: 5, rest_seconds: null, feel: null },
        { id: 3, set_number: 3, weight_kg: 95, reps: 5, rest_seconds: null, feel: null },
      ],
      memory: HISTORY,
    });
    expect(screen.getByText('Back Squat')).toBeTruthy();
    expect(screen.queryByText('Log it')).toBeNull();
  });

  it('shows a swap affordance before the first set is logged, and hides it once one is', () => {
    const onRequestSwap = jest.fn();
    const { rerender } = render(
      <ThemeProvider>
        <ActiveExerciseCard
          exercise={EXERCISE}
          loggedSets={[]}
          units="metric"
          logging={false}
          onLogSet={jest.fn()}
          onUpdateSet={jest.fn()}
          onDeleteSet={jest.fn()}
          onRequestSwap={onRequestSwap}
        />
      </ThemeProvider>,
    );
    fireEvent.press(screen.getByText('Swap movement'));
    expect(onRequestSwap).toHaveBeenCalled();

    rerender(
      <ThemeProvider>
        <ActiveExerciseCard
          exercise={EXERCISE}
          loggedSets={[{ id: 1, set_number: 1, weight_kg: 92.5, reps: 5, rest_seconds: null, feel: null }]}
          units="metric"
          logging={false}
          onLogSet={jest.fn()}
          onUpdateSet={jest.fn()}
          onDeleteSet={jest.fn()}
          onRequestSwap={onRequestSwap}
        />
      </ThemeProvider>,
    );
    expect(screen.queryByText('Swap movement')).toBeNull();
  });

  it('shows the logged set as an editable row and lets it be edited or deleted', () => {
    const { onUpdateSet, onDeleteSet } = renderCard({
      loggedSets: [{ id: 42, set_number: 1, weight_kg: 90, reps: 5, rest_seconds: null, feel: null }],
    });
    expect(screen.getByText(/Set 1: 90 kg × 5/)).toBeTruthy();

    fireEvent.press(screen.getByText(/Set 1: 90 kg × 5/));
    fireEvent.press(screen.getByText('Save'));
    expect(onUpdateSet).toHaveBeenCalledWith(42, { actual_reps: 5, actual_load_kg: 90 });

    fireEvent.press(screen.getByTestId('icon-button-trash-outline'));
    expect(onDeleteSet).toHaveBeenCalledWith(42);
  });
});
