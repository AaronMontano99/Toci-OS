const KG_PER_LB = 0.45359237;

export type Units = 'imperial' | 'metric';

export function kgToDisplay(kg: number, units: Units): number {
  return units === 'imperial' ? kg / KG_PER_LB : kg;
}

export function displayToKg(value: number, units: Units): number {
  return units === 'imperial' ? value * KG_PER_LB : value;
}

export function weightUnitLabel(units: Units): string {
  return units === 'imperial' ? 'lb' : 'kg';
}

export function formatWeight(kg: number | null | undefined, units: Units, digits = 0): string {
  if (kg == null) return '—';
  const value = kgToDisplay(kg, units);
  return `${value.toFixed(digits)} ${weightUnitLabel(units)}`;
}

// The smallest sane increment to step a weight control by, in *display* units --
// 2.5kg (~5lb) is the app's standard plate-based increment (engine.py's
// SMALLEST_INCREMENT_KG), rounded to a clean number per unit system.
export function weightStep(units: Units): number {
  return units === 'imperial' ? 5 : 2.5;
}

export function cmToDisplayHeight(cm: number | null | undefined, units: Units): string {
  if (cm == null) return '—';
  if (units === 'metric') return `${Math.round(cm)} cm`;
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}
