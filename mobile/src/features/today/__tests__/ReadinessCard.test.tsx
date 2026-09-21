import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { ReadinessCard } from '@/features/today/ReadinessCard';
import { ThemeProvider } from '@/theme/ThemeContext';

function renderCard(props: Partial<React.ComponentProps<typeof ReadinessCard>> = {}) {
  render(
    <ThemeProvider>
      <ReadinessCard score={55} band="amber" checkedIn={false} {...props} />
    </ThemeProvider>,
  );
}

describe('ReadinessCard', () => {
  it("shows the ordinary amber copy when today's session is still a lift", () => {
    renderCard({ band: 'amber', sessionType: 'lift' });
    expect(screen.getByText('Energy is decent — solid day to train.')).toBeTruthy();
  });

  // Regression test: engine.py's readiness_trend() can escalate an amber day
  // to a full recovery swap after 3+ consecutive low-readiness days (see
  // app/tests/test_engine.py). Before this fix, this card only ever looked
  // at `band`, so it kept saying "solid day to train" right next to a Today
  // screen that had already swapped to Active Recovery -- a real
  // contradiction caught by actually running the app, not by any test.
  it('overrides the amber copy when a slump escalated the day to recovery', () => {
    renderCard({ band: 'amber', sessionType: 'recover' });
    expect(screen.getByText("A few rough days in a row — today's a full recovery day, not just a lighter one.")).toBeTruthy();
    expect(screen.queryByText('Energy is decent — solid day to train.')).toBeNull();
  });

  it('leaves red and green bands unaffected by sessionType', () => {
    renderCard({ band: 'red', sessionType: 'recover' });
    expect(screen.getByText('Energy is low — today leans toward active recovery.')).toBeTruthy();
  });
});
