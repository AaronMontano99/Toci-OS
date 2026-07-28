import { router } from 'expo-router';
import React, { useState } from 'react';

import { useProgram } from '@/api/hooks';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { CoachSegment } from '@/features/program/CoachSegment';
import { GoalsSegment } from '@/features/program/GoalsSegment';
import { OverviewSegment } from '@/features/program/OverviewSegment';
import { ProgramHeader } from '@/features/program/ProgramHeader';
import { ScheduleSegment } from '@/features/program/ScheduleSegment';

const SEGMENTS = [
  { key: 'overview', label: 'Overview' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'goals', label: 'Goals' },
  { key: 'coach', label: 'Coach' },
];

export default function ProgramScreen() {
  const { data: program, isLoading, isError, refetch, isRefetching } = useProgram();
  const [segment, setSegment] = useState('overview');

  if (isLoading) {
    return (
      <ScreenContainer>
        <Skeleton height={90} radius={12} />
        <Skeleton height={44} radius={14} />
        <Skeleton height={200} radius={20} />
      </ScreenContainer>
    );
  }

  if (isError || !program) {
    return (
      <ScreenContainer onRefresh={refetch} refreshing={isRefetching}>
        <EmptyState title="Can't load your program" detail="Pull down to try again." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer onRefresh={refetch} refreshing={isRefetching}>
      <ScreenHeader title="Program" rightIcon="notifications-outline" onRightPress={() => router.push('/checkin')} />
      <ProgramHeader identity={program.identity} progress={program.progress} />
      <SegmentedControl segments={SEGMENTS} selected={segment} onChange={setSegment} />
      {segment === 'overview' && <OverviewSegment program={program} onOpenCoach={() => setSegment('coach')} />}
      {segment === 'schedule' && <ScheduleSegment week={program.week} />}
      {segment === 'goals' && <GoalsSegment goals={program.goals} />}
      {segment === 'coach' && <CoachSegment observations={program.coach_observations} />}
    </ScreenContainer>
  );
}
