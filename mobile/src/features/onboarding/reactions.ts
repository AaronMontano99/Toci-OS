import { goalLabel } from '@/features/onboarding/catalog';
import { OnboardingAnswers } from '@/context/OnboardingContext';

// Short lines Toci "reacts" with, each keyed to whatever was just answered
// on the previous screen -- shown at the top of the next question so the
// interview feels like it's actually listening, not just collecting fields.
// Every function reads only the answers it needs and returns null when
// there isn't yet enough context for a specific reaction.

export function afterPrimaryGoal(answers: OnboardingAnswers): string | null {
  if (!answers.primaryGoal) return null;
  return `${goalLabel(answers.primaryGoal)} — got it. Let's shape the rest of your plan around that.`;
}

export function afterExperience(answers: OnboardingAnswers): string | null {
  if (!answers.experienceLevel) return null;
  if (answers.experienceLevel === 'beginner') return "Perfect starting point — we'll build good habits before adding load.";
  if (answers.experienceLevel === 'advanced') return "Good — we won't waste your time on the basics.";
  return "Solid base. We'll push your progression a bit harder.";
}

export function afterSchedule(answers: OnboardingAnswers): string | null {
  const days = answers.daysPerWeek;
  if (!days) return null;
  if (days <= 3) return `${days} days keeps this sustainable — every session will count.`;
  if (days === 4) return 'Four days gives us enough room to train everything twice without living in the gym.';
  return `${days} days — we'll spread the volume out so nothing gets stale.`;
}

export function afterEquipment(answers: OnboardingAnswers): string | null {
  if (!answers.equipment) return null;
  if (answers.equipment === 'bodyweight') return "No equipment, no problem — we'll lean on tempo and volume instead of load.";
  if (answers.equipment === 'home_gym') return "A home setup is plenty for what we're building.";
  return 'Full gym access opens up everything — nice.';
}

export function afterRecovery(answers: OnboardingAnswers): string | null {
  if (!answers.recoveryMethod) return null;
  if (answers.recoveryMethod === 'manual') return "Ten seconds a day is all it takes — we'll ask right when it matters.";
  if (answers.recoveryMethod === 'wearable_later') return "Whenever you're ready, WHOOP is one tap away in Profile.";
  return "No problem — you can turn on adaptive recovery anytime from Profile.";
}
