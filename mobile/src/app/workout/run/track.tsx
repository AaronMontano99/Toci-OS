import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';

import { useLogRun, useSettings } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

interface RoutePoint {
  lat: number;
  lng: number;
  t: string;
}

const EARTH_RADIUS_M = 6371000;

function haversineMeters(a: RoutePoint, b: RoutePoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatPace(distanceMeters: number, elapsedSeconds: number, isImperial: boolean): string {
  if (distanceMeters < 50 || elapsedSeconds < 10) return '—';
  const unitDistance = isImperial ? distanceMeters / 1609.344 : distanceMeters / 1000;
  const secPerUnit = elapsedSeconds / unitDistance;
  if (!isFinite(secPerUnit) || secPerUnit <= 0) return '—';
  const m = Math.floor(secPerUnit / 60);
  const s = Math.round(secPerUnit % 60);
  return `${m}:${String(s).padStart(2, '0')} /${isImperial ? 'mi' : 'km'}`;
}

type PermState = 'checking' | 'granted' | 'denied';

export default function TrackRunScreen() {
  const { colors } = useTheme();
  const { data: settings } = useSettings();
  const isImperial = (settings?.units ?? 'imperial') === 'imperial';
  const logRun = useLogRun();

  const [permState, setPermState] = useState<PermState>('checking');
  const [isPaused, setIsPaused] = useState(false);
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      setPermState(status === 'granted' ? 'granted' : 'denied');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (permState !== 'granted' || isPaused) return;

    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    let cancelled = false;
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
      (loc) => {
        const point: RoutePoint = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          t: new Date(loc.timestamp).toISOString(),
        };
        setRoute((prev) => {
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            setDistanceMeters((d) => d + haversineMeters(last, point));
          }
          return [...prev, point];
        });
        mapRef.current?.animateCamera({ center: { latitude: point.lat, longitude: point.lng } }, { duration: 300 });
      }
    ).then((sub) => {
      if (cancelled) {
        sub.remove();
      } else {
        watcherRef.current = sub;
      }
    });

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      watcherRef.current?.remove();
      watcherRef.current = null;
    };
  }, [permState, isPaused]);

  const onFinish = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    watcherRef.current?.remove();
    setFinishing(true);
    await logRun.mutateAsync({
      duration_seconds: elapsedSeconds,
      distance_meters: Math.round(distanceMeters),
      run_type: 'outdoor',
      route,
    });
    router.back();
  };

  if (permState === 'checking') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text variant="body" tone="secondary">
          Requesting location access…
        </Text>
      </View>
    );
  }

  if (permState === 'denied') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, gap: SPACING.md, paddingHorizontal: SPACING.xl }]}>
        <Ionicons name="location-outline" size={40} color={colors.textTertiary} />
        <Text variant="cardTitle" style={{ textAlign: 'center' }}>
          Location access needed
        </Text>
        <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
          Toci needs location access to track your outdoor run. Enable it in Settings to continue.
        </Text>
        <Button label="Close" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const coords = route.map((p) => ({ latitude: p.lat, longitude: p.lng }));

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <MapView
        ref={mapRef}
        style={styles.flex}
        showsUserLocation
        followsUserLocation
        initialRegion={
          coords.length > 0
            ? { latitude: coords[0].latitude, longitude: coords[0].longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
            : undefined
        }
      >
        {coords.length > 1 && <Polyline coordinates={coords} strokeColor={colors.accent} strokeWidth={5} />}
      </MapView>

      <View style={[styles.topBar, { top: SPACING.xxxl }]}>
        <IconButton name="close" onPress={() => router.back()} background />
      </View>

      <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text variant="caption" tone="tertiary">
              TIME
            </Text>
            <Text variant="displayLarge">{formatElapsed(elapsedSeconds)}</Text>
          </View>
        </View>
        <View style={[styles.statRow, { marginTop: SPACING.sm }]}>
          <View style={styles.statItem}>
            <Text variant="caption" tone="tertiary">
              DISTANCE
            </Text>
            <Text variant="cardTitle">
              {isImperial ? (distanceMeters / 1609.344).toFixed(2) + ' mi' : (distanceMeters / 1000).toFixed(2) + ' km'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text variant="caption" tone="tertiary">
              PACE
            </Text>
            <Text variant="cardTitle">{formatPace(distanceMeters, elapsedSeconds, isImperial)}</Text>
          </View>
        </View>

        <View style={[styles.buttonRow, { marginTop: SPACING.lg }]}>
          <Button
            label={isPaused ? 'Resume' : 'Pause'}
            variant="secondary"
            onPress={() => setIsPaused((p) => !p)}
            style={{ flex: 1 }}
          />
          <Button label="Finish" onPress={onFinish} loading={finishing} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { position: 'absolute', left: SPACING.base },
  statsCard: {
    position: 'absolute',
    left: SPACING.base,
    right: SPACING.base,
    bottom: SPACING.xl,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', gap: 2 },
  buttonRow: { flexDirection: 'row', gap: SPACING.sm },
});
