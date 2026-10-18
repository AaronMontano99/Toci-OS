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

  // Regression test, updated for Update 4: 3+ amber days in a row no longer
  // swap the day to recovery -- engine.py keeps a lift at ~60% of the sets.
  // Before, this card kept saying "solid day to train" next to a cut-down
  // session (and earlier still, next to a recovery swap).
  it('says the session is shorter during a slump', () => {
    renderCard({ band: 'amber', sessionType: 'lift', lowStreak: 3 });
    expect(screen.getByText('A few rough days in a row — today is a shorter session, about 60% of the sets.')).toBeTruthy();
    expect(screen.queryByText('Energy is decent — solid day to train.')).toBeNull();
  });

  it('keeps the ordinary amber copy for a single rough day', () => {
    renderCard({ band: 'amber', sessionType: 'lift', lowStreak: 1 });
    expect(screen.getByText('Energy is decent — solid day to train.')).toBeTruthy();
  });

  it('leaves red and green bands unaffected by sessionType', () => {
    renderCard({ band: 'red', sessionType: 'recover' });
    expect(screen.getByText('Energy is low — today leans toward active recovery.')).toBeTruthy();
  });
});
