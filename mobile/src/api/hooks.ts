import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import {
  CheckinPayload,
  Exercise,
  FoodItem,
  Goal,
  LogSummary,
  NutritionToday,
  PersonalRecord,
  ProgramResponse,
  RecipeSummary,
  Settings,
  SetInput,
  ShoppingItem,
  StrengthProgress,
  TodayResponse,
  WorkoutSessionDetail,
} from './types';

// -------------------------------------------------------------- today ----

export function useToday() {
  return useQuery({ queryKey: ['today'], queryFn: () => api.get<TodayResponse>('/api/today') });
}

export function useSubmitCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CheckinPayload) => api.post('/api/checkin', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today'] });
      qc.invalidateQueries({ queryKey: ['program'] });
    },
  });
}

// ------------------------------------------------------------- workout ----

export function useExercises() {
  return useQuery({ queryKey: ['exercises'], queryFn: () => api.get<Exercise[]>('/api/exercises') });
}

export function useStartWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (label?: string) => api.post<{ id: number }>('/api/workouts', { label }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['today'] }),
  });
}

export function useWorkoutSession(sessionId: number | null) {
  return useQuery({
    queryKey: ['workout', sessionId],
    queryFn: () => api.get<WorkoutSessionDetail>(`/api/workouts/${sessionId}`),
    enabled: sessionId != null,
    refetchInterval: 15000,
  });
}

export function useLogSet(sessionId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (set: SetInput) => api.post<{ id: number }>(`/api/workouts/${sessionId}/sets`, set),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workout', sessionId] }),
  });
}

export function useDeleteSet(sessionId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (setId: number) => api.delete(`/api/sets/${setId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workout', sessionId] }),
  });
}

export function useCompleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: number) => api.post(`/api/workouts/${sessionId}/complete`),
    onSuccess: (_data, sessionId) => {
      qc.invalidateQueries({ queryKey: ['workout', sessionId] });
      qc.invalidateQueries({ queryKey: ['today'] });
      qc.invalidateQueries({ queryKey: ['program'] });
      qc.invalidateQueries({ queryKey: ['logSummary'] });
    },
  });
}

export function useLogRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { duration_seconds: number; distance_meters: number; avg_hr?: number; perceived_effort?: number }) =>
      api.post<{ id: number }>('/api/runs', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today'] });
      qc.invalidateQueries({ queryKey: ['logSummary'] });
    },
  });
}

export function useLogSummary(period: 'this_week' | 'last_week' | 'last_4_weeks' = 'this_week') {
  return useQuery({
    queryKey: ['logSummary', period],
    queryFn: () => api.get<LogSummary>(`/api/log/summary?period=${period}`),
  });
}

export function useLogHistory(limit = 30, offset = 0) {
  return useQuery({
    queryKey: ['logHistory', limit, offset],
    queryFn: () => api.get<{ sessions: import('./types').RecentSession[]; has_more: boolean }>(`/api/log/history?limit=${limit}&offset=${offset}`),
  });
}

export function useLiftDays() {
  return useQuery({
    queryKey: ['liftDays'],
    queryFn: () =>
      api.get<{ weekday: number; date: string; label: string; exercise_count: number; is_today: boolean }[]>(
        '/api/log/lift-days',
      ),
  });
}

export function useLiftDayPrescription(weekday: number | null) {
  return useQuery({
    queryKey: ['liftDayPrescription', weekday],
    queryFn: () => api.get<{ label: string; exercises: import('./types').PrescriptionExercise[] }>(`/api/log/lift-days/${weekday}/prescription`),
    enabled: weekday != null,
  });
}

export interface ExerciseDecision {
  options: import('./types').ProgressionOption[];
  recommended_type: import('./types').ProgressionOption['type'];
  why: string;
}

export function useExerciseDecision(exerciseId: number | null) {
  return useQuery({
    queryKey: ['exerciseDecision', exerciseId],
    queryFn: () => api.get<ExerciseDecision>(`/api/exercises/${exerciseId}/decision`),
    enabled: exerciseId != null,
  });
}

export function useExerciseMemory(exerciseId: number | null) {
  return useQuery({
    queryKey: ['exerciseMemory', exerciseId],
    queryFn: () => api.get<import('./types').ExerciseMemory>(`/api/exercises/${exerciseId}/memory`),
    enabled: exerciseId != null,
  });
}

export function useExerciseDecisions(exerciseIds: number[]) {
  return useQueries({
    queries: exerciseIds.map((id) => ({
      queryKey: ['exerciseDecision', id],
      queryFn: () => api.get<ExerciseDecision>(`/api/exercises/${id}/decision`),
    })),
  });
}

// -------------------------------------------------------------- program ----

export function useProgram() {
  return useQuery({ queryKey: ['program'], queryFn: () => api.get<ProgramResponse>('/api/program') });
}

export function useGoals() {
  return useQuery({ queryKey: ['goals'], queryFn: () => api.get<Goal[]>('/api/goals') });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Goal> & { title: string }) => api.post<Goal>('/api/goals', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      qc.invalidateQueries({ queryKey: ['program'] });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<Goal> & { id: number }) => api.patch<Goal>(`/api/goals/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      qc.invalidateQueries({ queryKey: ['program'] });
    },
  });
}

// ------------------------------------------------------------- coach chat ----

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  proposal: Record<string, unknown> | null;
  proposal_status: 'pending' | 'applied' | 'discarded' | null;
}

export function useChatHistory() {
  return useQuery({ queryKey: ['chatHistory'], queryFn: () => api.get<ChatMessage[]>('/api/coach/chat') });
}

export function useSendChatMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => api.post('/api/coach/chat', { message }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chatHistory'] }),
  });
}

export function useApplyChatProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: number) => api.post(`/api/coach/chat/${messageId}/apply`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chatHistory'] });
      qc.invalidateQueries({ queryKey: ['program'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useDiscardChatProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: number) => api.post(`/api/coach/chat/${messageId}/discard`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chatHistory'] }),
  });
}

// -------------------------------------------------------------- progress ----

export function useStrengthProgress(exerciseId: number | null) {
  return useQuery({
    queryKey: ['strengthProgress', exerciseId],
    queryFn: () => api.get<StrengthProgress>(`/api/progress/strength/${exerciseId}`),
    enabled: exerciseId != null,
  });
}

export function usePRs() {
  return useQuery({ queryKey: ['prs'], queryFn: () => api.get<{ prs: PersonalRecord[] }>('/api/prs') });
}

export function useBodyWeightHistory(days = 30) {
  return useQuery({
    queryKey: ['bodyWeightHistory', days],
    queryFn: () => api.get<{ points: { date: string; weight_kg: number }[] }>(`/api/body-weight/history?days=${days}`),
  });
}

export function useWeeklySummary() {
  return useQuery({ queryKey: ['weeklySummary'], queryFn: () => api.get('/api/progress/weekly-summary') });
}

export function useBodyFat() {
  return useQuery({
    queryKey: ['bodyFat'],
    queryFn: () => api.get<{ body_fat_pct: number | null; date: string | null }>('/api/body-fat'),
  });
}

export function useLogBodyWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weight_kg: number) => api.post('/api/body-weight', { weight_kg }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bodyWeightHistory'] }),
  });
}

// -------------------------------------------------------------- settings ----

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => api.get<Settings>('/api/settings') });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Settings>) => api.patch('/api/settings', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}

export function useRecalculateCalories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ daily_calorie_goal_kcal: number }>('/api/settings/recalculate-calories'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}

export function useAddInjury() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { body_region: string; description?: string }) => api.post('/api/injuries', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useRemoveInjury() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/injuries/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

// ------------------------------------------------------------ nutrition ----

export function useNutritionToday(date?: string) {
  return useQuery({
    queryKey: ['nutritionToday', date],
    queryFn: () => api.get<NutritionToday>(`/api/nutrition/today${date ? `?date=${date}` : ''}`),
  });
}

export function useNutritionRecommendation(date?: string) {
  return useQuery({
    queryKey: ['nutritionRecommendation', date],
    queryFn: () =>
      api.get<import('./types').NutritionRecommendation>(`/api/nutrition/recommendation${date ? `?date=${date}` : ''}`),
  });
}

export function useSearchFoods(q: string) {
  return useQuery({
    queryKey: ['foods', q],
    queryFn: () => api.get<{ foods: FoodItem[] }>(`/api/nutrition/foods?q=${encodeURIComponent(q)}`),
  });
}

export function useLogFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { food_item_id: number; servings: number; meal_slot: string; date?: string }) =>
      api.post('/api/nutrition/log', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nutritionToday'] });
      qc.invalidateQueries({ queryKey: ['nutritionRecommendation'] });
    },
  });
}

export function useDeleteFoodLogEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: number) => api.delete(`/api/nutrition/log/${entryId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nutritionToday'] }),
  });
}

export function useQuickAddFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { label: string; calories: number; protein_g?: number; carbs_g?: number; fat_g?: number; meal_slot: string }) =>
      api.post('/api/nutrition/quick-add', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nutritionToday'] }),
  });
}

export function useLookupBarcode() {
  return useMutation({ mutationFn: (barcode: string) => api.get<FoodItem>(`/api/nutrition/lookup/${barcode}`) });
}

export interface SavedMeal {
  id: number;
  name: string;
  total_calories: number;
  items: { food_item_id: number; name: string; servings: number }[];
}

export function useSavedMeals() {
  return useQuery({ queryKey: ['savedMeals'], queryFn: () => api.get<{ meals: SavedMeal[] }>('/api/nutrition/meals') });
}

export function useLogSavedMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, multiplier = 1, date }: { id: number; multiplier?: number; date?: string }) =>
      api.post(`/api/nutrition/meals/${id}/log`, { multiplier, date }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nutritionToday'] }),
  });
}

export function useDeleteSavedMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/nutrition/meals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['savedMeals'] }),
  });
}

export function useRecentLoggedMeals(limit = 3) {
  return useQuery({
    queryKey: ['recentLoggedMeals', limit],
    queryFn: () =>
      api.get<{ meals: { log_entry_id: number; food_item_id: number; name: string; meal_slot: string; servings: number; date: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }[] }>(
        `/api/nutrition/recent-meals?limit=${limit}`,
      ),
  });
}

export function useRecipes(category = '') {
  return useQuery({
    queryKey: ['recipes', category],
    queryFn: () => api.get<{ recipes: RecipeSummary[] }>(`/api/recipes${category ? `?category=${category}` : ''}`),
  });
}

export function useRecipe(id: number | null) {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: () => api.get(`/api/recipes/${id}`),
    enabled: id != null,
  });
}

export function useShopping() {
  return useQuery({ queryKey: ['shopping'], queryFn: () => api.get<{ items: ShoppingItem[]; total_estimated: number }>('/api/shopping') });
}

export function useToggleShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_checked }: { id: number; is_checked: boolean }) =>
      api.patch(`/api/shopping/items/${id}`, { is_checked }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping'] }),
  });
}

export function useHydrationToday(date?: string) {
  return useQuery({
    queryKey: ['hydration', date],
    queryFn: () => api.get<{ date: string; ounces: number; goal_oz: number }>(`/api/hydration/today${date ? `?date=${date}` : ''}`),
  });
}

// ------------------------------------------------------------ progress photos ----

export interface ProgressPhoto {
  id: number;
  date: string;
  url: string;
  note: string | null;
  ai_impression: string | null;
}

export function useProgressPhotos() {
  return useQuery({ queryKey: ['progressPhotos'], queryFn: () => api.get<ProgressPhoto[]>('/api/progress/photos') });
}

export function useUploadProgressPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api.upload<ProgressPhoto>('/api/progress/photos', form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['progressPhotos'] }),
  });
}

// -------------------------------------------------------------- devices ----

export function useSpotifyStatus() {
  return useQuery({
    queryKey: ['spotifyStatus'],
    queryFn: () => api.get<{ client_id_configured: boolean; connected: boolean }>('/api/spotify/status'),
  });
}

export function useWearableStatus() {
  return useQuery({
    queryKey: ['wearableStatus'],
    queryFn: () => api.get<{ connected: boolean; client_id_configured: boolean }>('/api/wearable/status'),
  });
}

export function useLogHydration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ounces: number) => api.post('/api/hydration/today', { ounces }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hydration'] }),
  });
}
