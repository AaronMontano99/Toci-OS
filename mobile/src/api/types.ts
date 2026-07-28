// Mirrors app/toci/schemas.py and the response shapes assembled in app/toci/main.py.

export type ReadinessBand = 'green' | 'amber' | 'red';
export type SessionType = 'lift' | 'run' | 'recover' | 'rest';
export type DayType = 'lift' | 'run' | 'rest' | 'recover';
export type Feel = 'clean' | 'difficult' | 'sloppy' | 'partial' | 'assisted' | 'pain' | 'unsure';
export type ConfidenceNext = 'yes' | 'maybe' | 'no';

export interface ProgressionOption {
  type: 'repeat' | 'increase' | 'technique_focus';
  load_kg: number;
  reps: number;
  label: string;
  detail: string;
}

export interface PrescriptionExercise {
  exercise_id: number;
  name: string;
  sets: number;
  reps: number;
  load_kg: number;
  target_rir: number;
  progression_options?: ProgressionOption[];
  recommended_type?: ProgressionOption['type'];
  why?: string;
}

export interface LiftPrescription {
  label?: string;
  exercises: PrescriptionExercise[];
}

export interface RunPrescription {
  run_type?: string;
  duration_min?: number;
  zone?: number;
  note?: string;
}

export interface WeekDay {
  date: string;
  weekday: number;
  day_type: DayType;
  label: string;
  is_today: boolean;
  is_completed: boolean;
}

export interface WorkoutStatus {
  state: 'none' | 'active' | 'completed';
  session_id: number | null;
  completed_exercise_count: number | null;
  total_exercise_count: number | null;
  elapsed_min: number | null;
}

export interface TodayResponse {
  date: string;
  readiness: { score: number; band: ReadinessBand };
  recovery: { hrv_ms: number | null; resting_hr_bpm: number | null; sleep_duration_min: number | null };
  checked_in: boolean;
  recommendation: {
    session_type: SessionType;
    prescription: LiftPrescription | RunPrescription | Record<string, unknown>;
    reasoning: string[];
  };
  workout_status: WorkoutStatus;
  mobility_items: string[];
  conditioning_items: string[];
  week: WeekDay[];
  streak: number;
}

export interface CheckinPayload {
  hrv_ms: number;
  resting_hr_bpm: number;
  sleep_hours: number;
  soreness_1_5: number;
  stress_mood_1_5: number;
}

export interface Exercise {
  id: number;
  name: string;
  primary_muscle_group: string;
}

export interface LoggedSet {
  id: number;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rest_seconds: number | null;
}

export interface ExerciseWithSets {
  exercise_id: number;
  name: string;
  logged_sets: LoggedSet[];
}

export interface WorkoutSessionDetail {
  id: number;
  label: string | null;
  date: string;
  ended_at: string | null;
  duration_min: number | null;
  exercise_count: number;
  volume_kg: number;
  exercises_with_sets: ExerciseWithSets[];
}

export interface SetInput {
  exercise_id: number;
  set_index: number;
  prescribed_reps?: number | null;
  prescribed_load_kg?: number | null;
  actual_reps: number;
  actual_load_kg: number;
  rir?: number | null;
  rest_seconds?: number | null;
  feel?: Feel | null;
  confidence_next?: ConfidenceNext | null;
}

export interface RecentSession {
  id: number;
  type: 'lift' | 'run';
  title: string;
  date: string;
  duration_min: number;
  exercise_count?: number;
  volume_kg?: number;
  distance_km?: number | null;
  pace_per_km?: string | null;
}

export interface LogSummary {
  period: 'this_week' | 'last_week' | 'last_4_weeks';
  recent_sessions: RecentSession[];
  week: {
    lift_sessions: number;
    lift_goal: number;
    runs: number;
    run_goal: number;
    total_time_min: number;
    time_goal_min: number;
    est_calories: number;
    calorie_goal: number;
  };
  encouragement: string;
}

export interface ProgramIdentity {
  program_name: string;
  focus: string;
  current_week: number;
  total_weeks: number;
  deload_week: number | null;
  primary_goal: string;
  secondary_goals: string[];
  started_at: string;
  next_reassessment_date: string;
  days_to_reassessment: number;
}

export interface ProgramProgress {
  completion_pct: number;
  workouts_completed: number;
  workouts_planned_to_date: number;
  weekly_adherence_pct: number;
  streak: number;
  status: 'ahead' | 'on_track' | 'behind';
}

export interface WeekDetailDay extends WeekDay {
  exercises: { exercise_id: number; name: string; sets: number; reps: number; target_rir: number }[];
  run: { run_type?: string; duration_min?: number; zone?: number } | null;
  conditioning_items: string[];
  mobility_items: string[];
  note: string | null;
}

export interface Goal {
  id: number;
  title: string;
  kind: 'strength' | 'endurance' | 'consistency' | 'custom';
  unit: string;
  start_value: number | null;
  current_value: number | null;
  target_value: number | null;
  is_secondary: boolean;
  status: 'improving' | 'stable' | 'declining';
  progress_pct: number | null;
  target_date: string | null;
}

export interface ProgramResponse {
  identity: ProgramIdentity;
  progress: ProgramProgress;
  today: { session_type: SessionType; prescription: LiftPrescription | RunPrescription; reasoning: string[] };
  week: WeekDetailDay[];
  goals: Goal[];
  coach_observations: string[];
}

export interface StrengthProgressPoint {
  date: string;
  est_1rm_kg: number;
}

export interface StrengthProgress {
  exercise_id: number;
  points: StrengthProgressPoint[];
  best_lift_kg: number | null;
  pct_change_28d: number | null;
  trend: 'up' | 'down' | 'flat';
  consistency_pct: number;
}

export interface PersonalRecord {
  exercise: string;
  date: string;
  est_1rm_kg?: number;
  pace_per_km?: string;
  delta_kg: number | null;
}

export interface Settings {
  name: string;
  age: number | null;
  height_cm: number | null;
  goal: string;
  experience_level: string;
  equipment: string;
  units: 'imperial' | 'metric';
  has_password: boolean;
  notif_daily_recommendation: boolean;
  notif_readiness_alerts: boolean;
  injuries: { id: number; body_region: string; description: string | null }[];
  current_weight_kg: number | null;
  goal_weight_kg: number | null;
  goal_pace_key: string | null;
  activity_level: string | null;
  onboarding_completed: boolean;
  sex: string | null;
  daily_calorie_goal_kcal: number | null;
  is_premium: boolean;
  dietary_preferences: string[];
  food_restrictions: string[];
  household_size: number;
  shopping_weekly_budget: number | null;
}

export interface FoodItem {
  id: number;
  name: string;
  brand: string | null;
  serving_qty: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  source: string;
  barcode: string | null;
  restaurant: string | null;
  is_favorite: boolean;
}

export interface NutritionTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
}

export interface FoodLogEntryOut extends NutritionTotals {
  id: number;
  food_item_id: number;
  name: string;
  brand: string | null;
  servings: number;
  serving_qty: number;
  serving_unit: string;
  meal_slot: string;
  notes: string | null;
}

export interface NutritionToday {
  date: string;
  entries: FoodLogEntryOut[];
  totals: NutritionTotals;
  is_today: boolean;
  coaching: string[];
  logging_streak: number;
  longest_streak: number;
}

export interface RecipeSummary {
  id: number;
  name: string;
  diet_tags: string[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  prep_minutes: number;
  cook_minutes: number;
  difficulty: string;
  servings: number;
  icon_emoji: string;
  gradient_key: string;
}

export interface NutritionRecommendation {
  configured: boolean;
  headline: string;
  detail: string | null;
  recommendation: {
    type: 'recipe';
    id: number;
    name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    icon_emoji: string;
    gradient_key: string;
  } | null;
}

export interface ShoppingItem {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  estimated_price: number;
  purpose: string | null;
  is_checked: boolean;
  source: string;
}
