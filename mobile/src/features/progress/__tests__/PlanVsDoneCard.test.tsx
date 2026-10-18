import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { PlanVsDone } from '@/api/types';
import { PlanVsDoneView } from '@/features/progress/PlanVsDoneCard';
import { ThemeProvider } from '@/theme/ThemeContext';

const base: PlanVsDone = {
  start: '2026-09-21',
  end: '2026-10-18',
  days: [],
  summary: { planned_training_days: 12, trained: 9, adherence: 0.75, as_prescribed: 0.5, extra_sessions: 1, days_without_a_plan: 2, scheduled_without_a_plan: 2, trained_without_a_plan: 1 },
  calibration: { increase: { n: 6, hit: 5, rate: 0.83, verdict: 'collecting' } },
  strength: [{ exercise_id: 1, name: 'Barbell Back Squat', sessions: 6, first_e1rm_kg: 120, last_e1rm_kg: 124.8, change_pct: 0.04 }],
};

function renderView(data: PlanVsDone) {
  render(
    <ThemeProvider>
      <PlanVsDoneView data={data} />
    </ThemeProvider>,
  );
}

describe('PlanVsDoneView', () => {
  it('shows adherence, prescription fidelity, strength and the no-plan caveat', () => {
    renderView(base);
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByText(/9 of 12 planned training days trained/)).toBeTruthy();
    expect(screen.getByText(/50% of lift days done as prescribed/)).toBeTruthy();
    expect(screen.getByText('Barbell Back Squat')).toBeTruthy();
    expect(screen.getByText(/2 scheduled training days without opening Toci/)).toBeTruthy();
  });

  it("doesn't claim a calibration verdict before there's enough data", () => {
    renderView(base);
    expect(screen.getByText(/5 of 6 fully completed so far/)).toBeTruthy();
  });

  it('gives the verdict once there is enough data', () => {
    renderView({ ...base, calibration: { increase: { n: 24, hit: 12, rate: 0.5, verdict: 'pushing too hard' } } });
    expect(screen.getByText(/50% fully completed \(24 tries\) — Toci may be pushing too hard/)).toBeTruthy();
  });

  it('handles a brand-new user', () => {
    renderView({ ...base, summary: { ...base.summary, planned_training_days: 0, trained: 0, adherence: null, as_prescribed: null, days_without_a_plan: 0, scheduled_without_a_plan: 0, trained_without_a_plan: 0 }, calibration: {}, strength: [] });
    expect(screen.getByText(/No plans to measure yet/)).toBeTruthy();
    expect(screen.getByText('No weight increases tried yet.')).toBeTruthy();
  });
});
