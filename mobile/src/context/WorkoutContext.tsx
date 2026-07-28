import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface WorkoutContextValue {
  restSecondsLeft: number | null;
  restTotal: number | null;
  startRest: (seconds: number) => void;
  addRestSeconds: (seconds: number) => void;
  skipRest: () => void;
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

// A single, app-wide rest timer -- compact, non-blocking, survives navigating
// between the active exercise card and the workout outline sheet.
// design-system.md §12 "Rest Timer".
export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startRest = useCallback(
    (seconds: number) => {
      clearTimer();
      setRestTotal(seconds);
      setRestSecondsLeft(seconds);
      intervalRef.current = setInterval(() => {
        setRestSecondsLeft((prev) => {
          if (prev == null || prev <= 1) {
            clearTimer();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [clearTimer],
  );

  const addRestSeconds = useCallback((seconds: number) => {
    setRestSecondsLeft((prev) => (prev == null ? seconds : prev + seconds));
    setRestTotal((prev) => (prev == null ? seconds : prev + seconds));
  }, []);

  const skipRest = useCallback(() => {
    clearTimer();
    setRestSecondsLeft(null);
    setRestTotal(null);
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return (
    <WorkoutContext.Provider value={{ restSecondsLeft, restTotal, startRest, addRestSeconds, skipRest }}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkoutContext() {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkoutContext must be used within WorkoutProvider');
  return ctx;
}
