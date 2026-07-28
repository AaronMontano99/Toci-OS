import { formatClock, formatDuration, greeting, sessionTypeLabel, titleCase, weekdayFull, weekdayLabel } from '@/lib/format';

describe('weekdayLabel / weekdayFull', () => {
  it('maps 0 to Monday', () => {
    expect(weekdayLabel(0)).toBe('Mon');
    expect(weekdayFull(0)).toBe('Monday');
  });

  it('maps 6 to Sunday', () => {
    expect(weekdayLabel(6)).toBe('Sun');
    expect(weekdayFull(6)).toBe('Sunday');
  });

  it('falls back to an empty string for an out-of-range index', () => {
    expect(weekdayLabel(7)).toBe('');
  });
});

describe('greeting', () => {
  it('greets by time of day', () => {
    expect(greeting(3)).toBe('Good night');
    expect(greeting(9)).toBe('Good morning');
    expect(greeting(14)).toBe('Good afternoon');
    expect(greeting(20)).toBe('Good evening');
  });
});

describe('formatDuration', () => {
  it('renders a dash for null or undefined', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
  });

  it('renders under an hour as minutes', () => {
    expect(formatDuration(45)).toBe('45 min');
  });

  it('renders an even hour without trailing minutes', () => {
    expect(formatDuration(60)).toBe('1h');
  });

  it('renders hours and minutes together', () => {
    expect(formatDuration(95)).toBe('1h 35m');
  });
});

describe('formatClock', () => {
  it('pads seconds under 10', () => {
    expect(formatClock(65)).toBe('1:05');
  });

  it('handles zero', () => {
    expect(formatClock(0)).toBe('0:00');
  });
});

describe('titleCase', () => {
  it('converts snake_case to Title Case', () => {
    expect(titleCase('active_recovery')).toBe('Active Recovery');
  });

  it('handles a single word', () => {
    expect(titleCase('rest')).toBe('Rest');
  });
});

describe('sessionTypeLabel', () => {
  it('maps known session types to friendly labels', () => {
    expect(sessionTypeLabel('lift')).toBe('Lift');
    expect(sessionTypeLabel('run')).toBe('Run');
    expect(sessionTypeLabel('recover')).toBe('Active Recovery');
    expect(sessionTypeLabel('rest')).toBe('Rest Day');
  });

  it('falls back to title-casing an unknown type', () => {
    expect(sessionTypeLabel('mystery_type')).toBe('Mystery Type');
  });
});
