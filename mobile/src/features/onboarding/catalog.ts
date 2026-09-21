// Single source of truth for the onboarding interview's option catalogs.
// Keys match the canonical values already used elsewhere in the app
// (PreferencesSegment.tsx, ProfileHeaderCard.tsx, coach_chat.py) so answers
// given here are the exact same values those screens already read/write --
// no separate onboarding-only vocabulary to keep in sync.

export interface OptionSpec<K extends string = string> {
  key: K;
  label: string;
  detail?: string;
  icon?: string; // Ionicons glyph name, kept as string to avoid importing the icon font here
}

export const PRIMARY_GOALS: OptionSpec[] = [
  { key: 'hypertrophy', label: 'Build muscle', detail: 'Add size, look and feel stronger', icon: 'barbell-outline' },
  { key: 'strength', label: 'Get stronger', detail: 'Push your top lifts up', icon: 'trending-up-outline' },
  { key: 'fat_loss', label: 'Lose fat', detail: 'Lean out while keeping muscle', icon: 'flame-outline' },
  { key: 'endurance', label: 'Improve endurance', detail: 'Run farther, recover faster', icon: 'walk-outline' },
  { key: 'general_fitness', label: 'General fitness', detail: 'Feel good, move well, stay consistent', icon: 'heart-outline' },
];

export function goalLabel(key: string | null | undefined): string {
  return PRIMARY_GOALS.find((g) => g.key === key)?.label ?? key ?? '—';
}

export const EXPERIENCE_LEVELS: OptionSpec[] = [
  { key: 'beginner', label: 'New to training', detail: "Never followed a program, or it's been years" },
  { key: 'intermediate', label: '1–5 years training', detail: 'Comfortable with the basics, ready to progress' },
  { key: 'advanced', label: '5+ years training', detail: 'Experienced — knows their lifts and limits' },
];

export const TRAINING_DAYS: OptionSpec<string>[] = [2, 3, 4, 5, 6].map((n) => ({
  key: String(n),
  label: `${n} days`,
}));

export const SESSION_LENGTHS: OptionSpec<string>[] = [
  { key: '30', label: '30 min', detail: 'Quick, focused sessions' },
  { key: '45', label: '45 min' },
  { key: '60', label: '60 min' },
  { key: '75', label: '75+ min', detail: 'No rush' },
];

export const EQUIPMENT_OPTIONS: OptionSpec[] = [
  { key: 'full_gym', label: 'Full gym', detail: 'Barbells, machines, everything', icon: 'business-outline' },
  { key: 'home_gym', label: 'Home gym', detail: 'Dumbbells, bands, a bench', icon: 'home-outline' },
  { key: 'bodyweight', label: 'Bodyweight only', detail: 'No equipment needed', icon: 'body-outline' },
];

export const SPLIT_PREFERENCES: OptionSpec[] = [
  { key: 'upper_lower', label: 'Upper / Lower', detail: 'Classic 4-day split' },
  { key: 'push_pull_legs', label: 'Push / Pull / Legs', detail: 'Great for higher frequency' },
  { key: 'full_body', label: 'Full body', detail: 'Everything, every session' },
  { key: 'coach_choice', label: "Let Toci decide", detail: "Based on your days and goal" },
];

export const ACTIVITY_LEVELS: OptionSpec[] = [
  { key: 'sedentary', label: 'Sedentary', detail: 'Little to no exercise outside training' },
  { key: 'lightly_active', label: 'Lightly active', detail: 'On your feet, light daily movement' },
  { key: 'active', label: 'Active', detail: 'Regularly active job or lifestyle' },
  { key: 'very_active', label: 'Very active', detail: 'Physically demanding day-to-day' },
];

export const RECOVERY_METHODS: OptionSpec[] = [
  { key: 'manual', label: 'Manual check-ins', detail: "I'll log soreness and sleep myself", icon: 'create-outline' },
  { key: 'wearable_later', label: 'Connect a wearable later', detail: 'WHOOP support is in Profile whenever you’re ready', icon: 'watch-outline' },
  { key: 'not_now', label: 'Not now', detail: "Skip adaptive recovery for now", icon: 'close-outline' },
];

// Weight-pace options, scoped to the primary goal so the question only shows
// up when it's actually relevant (fat_loss / hypertrophy) -- everyone else
// (strength / endurance / general_fitness) is set straight to "maintain"
// without being asked, matching the "one relevant question at a time" idea.
export function paceOptionsFor(primaryGoal: string | null): OptionSpec[] | null {
  if (primaryGoal === 'fat_loss') {
    return [
      { key: 'lose_0_5', label: 'Steady', detail: '~0.5 lb/week' },
      { key: 'lose_1', label: 'Moderate', detail: '~1 lb/week' },
      { key: 'lose_1_5', label: 'Aggressive', detail: '~1.5 lb/week' },
    ];
  }
  if (primaryGoal === 'hypertrophy') {
    return [
      { key: 'maintain', label: 'Maintain weight', detail: 'Recomposition — build muscle at the same weight' },
      { key: 'gain_0_5', label: 'Lean gain', detail: '~0.5 lb/week' },
      { key: 'gain_1', label: 'Faster gain', detail: '~1 lb/week' },
    ];
  }
  return null;
}

// primary-goal, secondary-goal, experience, schedule, session-length,
// equipment, preferences, body-profile, recovery, confirmation -- 10 steps.
// "building" and "reveal" after it aren't questions, so they don't advance
// this bar.
export const TOTAL_QUESTION_STEPS = 10;
