import React, { createContext, useContext, useMemo, useState } from 'react';

// Answers collected across the 11-question onboarding interview (see
// mobile/src/app/onboarding/), held here rather than in each screen's local
// state so they survive back/forward navigation between steps. Nothing here
// is persisted until the final "building" step submits it -- if the user
// quits mid-flow, nothing is written and they land back on question 1 next
// time (onboarding_completed only flips true at the very end).
export interface OnboardingAnswers {
  primaryGoal: string | null;
  secondaryGoal: string | null; // null once explicitly skipped, same as never answered -- fine, it's optional either way
  experienceLevel: string | null;
  daysPerWeek: number | null;
  sessionLengthMin: number | null;
  equipment: string | null;
  splitPreference: string | null;
  trainingNotes: string;
  age: string;
  sex: 'male' | 'female' | null;
  heightFeet: string;
  heightInches: string;
  currentWeightLb: string;
  goalWeightLb: string;
  activityLevel: string | null;
  goalPaceKey: string | null;
  recoveryMethod: string | null;
}

const initialAnswers: OnboardingAnswers = {
  primaryGoal: null,
  secondaryGoal: null,
  experienceLevel: null,
  daysPerWeek: null,
  sessionLengthMin: null,
  equipment: null,
  splitPreference: null,
  trainingNotes: '',
  age: '',
  sex: null,
  heightFeet: '',
  heightInches: '',
  currentWeightLb: '',
  goalWeightLb: '',
  activityLevel: null,
  goalPaceKey: null,
  recoveryMethod: null,
};

interface OnboardingContextValue {
  answers: OnboardingAnswers;
  update: (patch: Partial<OnboardingAnswers>) => void;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [answers, setAnswers] = useState<OnboardingAnswers>(initialAnswers);

  const value = useMemo(
    () => ({
      answers,
      update: (patch: Partial<OnboardingAnswers>) => setAnswers((prev) => ({ ...prev, ...patch })),
      reset: () => setAnswers(initialAnswers),
    }),
    [answers],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
