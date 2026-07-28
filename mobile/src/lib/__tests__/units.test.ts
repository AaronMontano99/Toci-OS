import { cmToDisplayHeight, displayToKg, formatWeight, kgToDisplay, weightStep, weightUnitLabel } from '@/lib/units';

describe('kgToDisplay / displayToKg', () => {
  it('passes metric through unchanged', () => {
    expect(kgToDisplay(100, 'metric')).toBe(100);
    expect(displayToKg(100, 'metric')).toBe(100);
  });

  it('round-trips imperial back to (approximately) the original kg value', () => {
    const kg = 92.5;
    const roundTripped = displayToKg(kgToDisplay(kg, 'imperial'), 'imperial');
    expect(roundTripped).toBeCloseTo(kg, 6);
  });
});

describe('weightUnitLabel', () => {
  it('labels imperial as lb and metric as kg', () => {
    expect(weightUnitLabel('imperial')).toBe('lb');
    expect(weightUnitLabel('metric')).toBe('kg');
  });
});

describe('formatWeight', () => {
  it('renders a dash for null or undefined', () => {
    expect(formatWeight(null, 'metric')).toBe('—');
    expect(formatWeight(undefined, 'imperial')).toBe('—');
  });

  it('rounds to whole numbers by default', () => {
    expect(formatWeight(100, 'metric')).toBe('100 kg');
  });

  it('respects an explicit digit count', () => {
    expect(formatWeight(100, 'metric', 1)).toBe('100.0 kg');
  });

  it('converts kg to lb for imperial display', () => {
    // 100kg ~= 220.5lb
    expect(formatWeight(100, 'imperial')).toBe('220 lb');
  });
});

describe('weightStep', () => {
  it('uses a coarser step for imperial than metric', () => {
    expect(weightStep('imperial')).toBe(5);
    expect(weightStep('metric')).toBe(2.5);
  });
});

describe('cmToDisplayHeight', () => {
  it('renders a dash for null or undefined', () => {
    expect(cmToDisplayHeight(null, 'metric')).toBe('—');
  });

  it('rounds metric to whole centimeters', () => {
    expect(cmToDisplayHeight(180.4, 'metric')).toBe('180 cm');
  });

  it('converts to feet and inches for imperial', () => {
    expect(cmToDisplayHeight(180, 'imperial')).toBe("5'11\"");
  });
});
